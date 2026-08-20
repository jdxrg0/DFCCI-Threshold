const cron = require('node-cron');
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const AppSetting = require('../models/AppSetting');
const github = require('../services/github');
const { WEEKLY_CODE_WORKFLOW, ensureWeeklyCodeWorkflow } = require('../services/weeklyCodeWorkflow');
const { enrichRunLinks, markAlerted } = require('../services/runLinks');
const alerts = require('../services/automationAlerts');

/* A queue item's `parsedRoles` is a Mongoose Map when it comes off a document
   and a plain object when it comes off a lean query or a request body. These
   two readers keep the resolver indifferent to which one it got. */
const roleEntries = (parsedRoles) => {
  if (!parsedRoles) return [];
  if (typeof parsedRoles.entries === 'function') return Array.from(parsedRoles.entries());
  return Object.entries(parsedRoles);
};

const roleValue = (parsedRoles, role) => {
  if (!parsedRoles || !role) return undefined;
  if (typeof parsedRoles.get === 'function') return parsedRoles.get(role);
  return parsedRoles[role];
};

/* Role names are Excel column headers — arbitrary admin text — so one stray
   metacharacter would throw out of the replace loop and abort the whole run. */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* A YYYY-MM-DD key is a calendar date, not an instant: it parses to UTC
   midnight and then reads back through the host's zone, so a host behind UTC
   announces the previous day. Parse it and read it in UTC throughout, and take
   "today" from the Manila calendar — the clock every cutoff here is stated in. */
const parseDateKey = (key) => {
  const [y, m, d] = String(key).split('-').map(Number);
  if (!y || !m || !d) return new Date(key);
  return new Date(Date.UTC(y, m - 1, d));
};

const shiftDays = (dateObj, days) => new Date(dateObj.getTime() + days * 86400000);

const manilaDateKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());

const formatServiceDate = (dateObj) => dateObj
  .toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: '2-digit', year: 'numeric' })
  .toUpperCase();

/* How far back a missed run is still worth mentioning. Beyond this the message
   is so stale that sending it late would confuse more than it helps. */
const MISSED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/* The most recent moment this cron should have fired, at or before `from`.
 *
 * node-cron can say when a task runs next but not when it last should have,
 * and that is the only question that reveals a run lost while the process was
 * down. Candidate times come from the parsed hour/minute fields — a handful
 * per day — and the real matcher decides which of them the pattern accepts, so
 * day-of-week and day-of-month semantics stay node-cron's problem, not ours.
 * All timers here are registered in UTC, so the arithmetic is UTC throughout. */
const previousFireTime = (pattern, from = new Date()) => {
  if (!cron.validate(pattern)) return null;

  let fields;
  try {
    fields = cron.parse(pattern);
  } catch (e) {
    return null;
  }

  const hours = fields.hour || [];
  const minutes = fields.minute || [];
  if (hours.length === 0 || minutes.length === 0) return null;

  const probe = cron.createTask(pattern, () => {}, { timezone: 'UTC' });
  try {
    for (let back = 0; back <= 8; back++) {
      const day = new Date(Date.UTC(
        from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - back));
      let best = null;
      for (const hour of hours) {
        for (const minute of minutes) {
          const when = new Date(Date.UTC(
            day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute, 0, 0));
          if (when > from) continue;
          if (!probe.match(when)) continue;
          if (!best || when > best) best = when;
        }
      }
      if (best) return best;
    }
  } finally {
    if (typeof probe.destroy === 'function') probe.destroy();
  }
  return null;
};

class AutomationScheduler {
  constructor() {
    // Map to hold running cron jobs by their MongoDB _id
    this.jobs = new Map();
  }

  /* Best-effort debug log. A read-only filesystem (container, serverless) must
     not be able to take the scheduler down, so the file write is guarded. */
  log(msg) {
    console.log(msg);
    try {
      require('fs').appendFileSync('scheduler_debug.log', `[${new Date().toISOString()}] ${msg}
`);
    } catch (e) { /* console output is enough */ }
  }

  async init() {
    try {
      // The single most common reason this module goes quiet. Every timer below
      // still registers — they simply have nothing to dispatch to — so this is
      // a warning at startup rather than a refusal to start.
      if (!github.hasPat()) {
        console.warn(
          '[Scheduler] GITHUB_PAT is not set. Timers will run, but every dispatch will fail ' +
          'and no schedule can be created or edited. See GET /api/automation/health.'
        );
      }

      const schedules = await Schedule.find();
      const activeCount = schedules.filter(s => s.isActive !== false).length;
      console.log(`[Scheduler] Found ${schedules.length} schedules (${activeCount} active). Starting timers...`);

      schedules.forEach(schedule => {
        try {
          this.addJob(schedule);
        } catch (e) {
          // One unparseable cronTime must not cost every other schedule its
          // timers, nor the global crons registered below.
          console.error(`[Scheduler] Could not start "${schedule.scheduleName}" (${schedule._id}): ${e.message}`);
        }
      });

      // Global Reader Bot Cron Job (Runs every 2 hours)
      if (!this.readerCron) {
        this.readerCron = cron.schedule('0 */2 * * *', async () => {
          console.log('[Scheduler] Running global Reader Bot check...');
          await this.triggerReaderBot();
        }, { scheduled: true, timezone: "UTC" });
        console.log('[Scheduler] Global Reader Bot cron initialized (every 2 hours).');
      }

      // Weekly Code Generator Cron Job (Runs every Sunday at 12:00 PM PHT)
      if (!this.weeklyCodeCron) {
        this.weeklyCodeCron = cron.schedule('0 12 * * 0', async () => {
          console.log('[Scheduler] Running Weekly Code Generator...');
          await this.generateWeeklyCode();
        }, { scheduled: true, timezone: "Asia/Manila" });
        console.log('[Scheduler] Weekly Code Generator cron initialized (every Sunday 12:00 PM PHT).');
      }

      // Watch what GitHub actually did with each dispatch.
      //
      // A dispatch records itself a success the moment GitHub accepts it, but
      // the run that sends the message finishes minutes later and can fail —
      // expired Facebook cookies being the usual reason. Resolving outcomes
      // only when an admin opened the history meant that failure was never
      // noticed unless somebody went looking.
      if (!this.runWatcherCron) {
        this.runWatcherCron = cron.schedule('*/15 * * * *', async () => {
          await this.checkRunOutcomes();
        }, { scheduled: true, timezone: "UTC" });
        console.log('[Scheduler] Run outcome watcher initialized (every 15 minutes).');
      }

      // Cron timers only fire in a live process and nothing catches up, so a
      // run due while the server was asleep or deploying is simply lost. This
      // is the only place that will ever mention it.
      await this.reportMissedRuns(schedules);

      // Initialize Weekly Code Dispatch Cron Job
      await this.reloadWeeklyCodeDispatch();
    } catch (error) {
      console.error('[Scheduler] Failed to initialize schedules:', error);
    }
  }

  /**
   * Runs that were due while this process was not running.
   *
   * Only the most recent missed occurrence per schedule is reported: after a
   * long outage the list would otherwise be pages of history nobody can act
   * on, and the actionable question is only ever "did today's go out?".
   */
  async reportMissedRuns(schedules) {
    const now = new Date();
    const missed = [];

    for (const schedule of schedules) {
      if (schedule.isActive === false) continue;

      const expected = previousFireTime(schedule.cronTime, now);
      if (!expected) continue;

      // A schedule cannot have missed a time that predates it.
      const createdAt = schedule.createdAt ? new Date(schedule.createdAt) : new Date(0);
      if (expected <= createdAt) continue;
      if (now - expected > MISSED_LOOKBACK_MS) continue;

      // recordRun lands a second or two after the timer fires, so allow a
      // minute of slack before calling a run absent.
      const grace = new Date(expected.getTime() - 60000);
      const ran = (schedule.runHistory || []).some(
        entry => entry.actionType === 'MAIN' && new Date(entry.at) >= grace);
      if (ran) continue;

      missed.push({
        scheduleId: String(schedule._id),
        scheduleName: schedule.scheduleName,
        expectedAt: expected
      });
    }

    if (missed.length === 0) return;

    missed.forEach(m => console.warn(
      `[Scheduler] MISSED RUN: "${m.scheduleName}" was due at ${m.expectedAt.toISOString()} and never ran.`));

    try {
      await alerts.alertMissedRuns(missed);
    } catch (e) {
      console.error('[Scheduler] Could not send the missed-run alert:', e.message);
    }
  }

  /**
   * Resolve the GitHub run behind each recent dispatch and alert on the ones
   * that finished badly. Each failure is emailed at most once.
   */
  async checkRunOutcomes() {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const schedules = await Schedule.find({
        runHistory: { $elemMatch: { at: { $gte: since }, status: 'success' } }
      });

      for (const schedule of schedules) {
        let failed = [];
        try {
          failed = await enrichRunLinks(schedule);
        } catch (e) {
          // A lookup that cannot reach GitHub is not a delivery failure; the
          // rows stay pending and the next pass tries again.
          console.warn(`[Scheduler] Run lookup failed for "${schedule.scheduleName}": ${e.message}`);
          continue;
        }

        for (const row of failed) {
          console.error(
            `[Scheduler] RUN FAILED: "${schedule.scheduleName}" ${row.actionType} finished ${row.ghRunConclusion}.`);
          try {
            await alerts.alertRunFailure(schedule, row);
          } finally {
            // Marked even if the email could not be sent, so a broken mailer
            // cannot turn one failed run into an alert every 15 minutes.
            await markAlerted(schedule._id, row._id);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Run outcome watcher failed:', error.message);
    }
  }

  async triggerReaderBot() {
    try {
      const Submission = require('../models/Submission');
      const Member = require('../models/Member');

      const pendingSubmissions = await Submission.find({ isComplete: false }).populate('scheduleId');
      if (pendingSubmissions.length === 0) {
        console.log('[Scheduler] No pending submissions found. Skipping Reader Bot.');
        return;
      }

      console.log(`[Scheduler] Found ${pendingSubmissions.length} pending submissions. Preparing to dispatch Reader Bot...`);

      const allMembers = await Member.find();

      for (const submission of pendingSubmissions) {
        const schedule = submission.scheduleId;
        if (!schedule) continue;

        // Find the targetQueueItem
        const targetQueueItem = schedule.messageQueue.find(q => q.weeklyConfirmationCode === submission.referenceCode);
        if (!targetQueueItem) continue;

        const chatsToCheck = [];

        // The same rule the report endpoint completes against, so the bot never
        // reads a chat whose reply could not count towards completion.
        const requiredRoles = Schedule.requiredRolesFor(targetQueueItem);

        for (const role of requiredRoles) {
          const assignedName = roleValue(targetQueueItem.parsedRoles, role);
          const member = allMembers.find(m => m.name.toLowerCase() === String(assignedName).toLowerCase());
          if (member && member.facebookChatUrl) {
            chatsToCheck.push({ url: member.facebookChatUrl, role });
          }
        }

        if (chatsToCheck.length > 0) {
          console.log(`[Scheduler] Dispatching check-replies.yml for ${submission.referenceCode}...`);

          const result = await github.dispatchWorkflow('check-replies.yml', {
            reference_code: submission.referenceCode,
            chats_to_check: JSON.stringify(chatsToCheck)
          });
          // The reader bot has no run history of its own, so a failure that is
          // not logged here is a confirmation that silently never gets read.
          if (!result.ok) {
            console.error(`[Scheduler] Reader bot dispatch failed for ${submission.referenceCode}: ${result.detail}`);
          }
        }
      }
    } catch (error) {
      console.error('[Scheduler] Failed to trigger reader bot:', error);
    }
  }

  async generateWeeklyCode() {
    try {
      let setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      if (!setting) {
        setting = new AppSetting({ key: 'weekly_code_config', value: { template: 'DFCCI-S-LU-{DATE}' } });
      }
      const value = { ...setting.value };

      // Calculate MMDDYY based on next Sunday's date. This cron fires on Manila
      // time, so the Sunday it means is the one on the Manila calendar.
      const today = parseDateKey(manilaDateKey());
      const daysUntilNextSunday = today.getUTCDay() === 0 ? 7 : 7 - today.getUTCDay();
      const date = shiftDays(today, daysUntilNextSunday);

      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      const yy = String(date.getUTCFullYear()).slice(-2);
      const code = (value.template || 'DFCCI-S-LU-{DATE}').replace(/{DATE}/gi, `${mm}${dd}${yy}`);

      value.currentCode = code;
      value.lastGeneratedDate = new Date();
      setting.value = value;
      setting.updatedAt = new Date();
      await setting.save();
      console.log(`[Scheduler] Weekly Code updated to: ${code}`);
    } catch (error) {
      console.error('[Scheduler] Failed to generate weekly code:', error);
    }
  }

  addJob(schedule) {
    const id = schedule._id.toString();

    // Clear existing job if it exists (for updates)
    if (this.jobs.has(id)) {
      this.log(`[Scheduler] Removing existing job for id: ${id}`);
      this.removeJob(id);
    }

    // Paused schedules keep their database row and their GitHub workflow file,
    // they simply get no timers until someone resumes them.
    if (schedule.isActive === false) {
      this.log(`[Scheduler] Schedule ${id} ("${schedule.scheduleName}") is paused — no timers registered.`);
      return;
    }

    // node-cron throws on a malformed pattern. Checking first turns "the whole
    // schedule silently has no timers" into a message naming the bad field,
    // and keeps a bad codeCronTime from costing the main job its timer too.
    if (!cron.validate(schedule.cronTime)) {
      throw new Error(`cronTime "${schedule.cronTime}" is not a valid cron expression`);
    }

    this.log(`[Scheduler] addJob called for scheduleId: ${id} with cronTime: ${schedule.cronTime}`);

    // 1. Main Group Chat Job
    const mainJob = cron.schedule(schedule.cronTime, () => {
      this.log(`[Scheduler] CRON FIRED for ${id} (Main Group Chat)`);
      this.triggerGitHubAction(id, 'MAIN');
    }, { scheduled: true, timezone: "UTC" });

    // 2. Daily Reminder Job (same clock time as the main job, but every day)
    const timeParts = schedule.cronTime.split(' ');
    const dailyCron = `${timeParts[0]} ${timeParts[1]} * * *`;
    const reminderJob = cron.schedule(dailyCron, () => {
      this.triggerGitHubAction(id, 'REMINDER');
    }, { scheduled: true, timezone: "UTC" });

    // 3. Confirmation Code Job (if enabled)
    let codeJob = null;
    if (schedule.enableCodeBroadcast && schedule.codeCronTime) {
      if (cron.validate(schedule.codeCronTime)) {
        codeJob = cron.schedule(schedule.codeCronTime, () => {
          this.triggerGitHubAction(id, 'CODE');
        }, { scheduled: true, timezone: "UTC" });
      } else {
        this.log(`[Scheduler] codeCronTime "${schedule.codeCronTime}" on ${id} is invalid — code broadcast not registered.`);
      }
    }

    this.jobs.set(id, { mainJob, reminderJob, codeJob });
    console.log(`[Scheduler] Added jobs for ${id} (Main, Reminder, Code enabled: ${!!codeJob})`);
  }

  /* Which schedules actually hold timers in this process. An active schedule
     missing from this list is the signature of a cronTime rejected at startup,
     and is otherwise invisible until the run that never happens. */
  registeredJobIds() {
    return Array.from(this.jobs.keys());
  }

  removeJob(id) {
    const jobs = this.jobs.get(id);
    if (jobs) {
      // A stopped task stays registered with node-cron; destroy() releases it.
      const release = (job) => {
        if (!job) return;
        if (typeof job.destroy === 'function') job.destroy();
        else job.stop();
      };
      release(jobs.mainJob);
      release(jobs.reminderJob);
      release(jobs.codeJob);
      this.jobs.delete(id);
      console.log(`[Scheduler] Removed jobs for ${id}`);
    }
  }

  /**
   * Work out exactly what a run would send — without sending anything.
   *
   * Both the cron path and the dashboard's "Preview" button go through here,
   * so the text an admin previews is the same string the workflow receives.
   *
   * @returns {{shouldDispatch: boolean, reason: string, message: string,
   *            codeMessage: string, reminderTasks: object[], items: string[]}}
   */
  async resolveDispatch(schedule, actionType = 'MAIN') {
    const skip = (reason) => ({
      shouldDispatch: false, reason,
      message: '', codeMessage: '', reminderTasks: [], items: []
    });

    const sortedQueue = [...(schedule.messageQueue || [])]
      .sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)));

    // Both of these are Manila calendar dates. The cutoff just below is a Manila
    // wall-clock decision, and a UTC date disagrees with it for the eight hours
    // Manila is already on the next day — long enough to pull a lineup that has
    // already happened back into scope and to count every reminder a day out.
    const todayStr = manilaDateKey(); // role-reminder diff math

    // Past noon on a Sunday (Manila) that day's lineup has already happened, so
    // the window starts tomorrow instead of today.
    const nowManila = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }));
    const cutoffDateStr = (nowManila.getDay() === 0 && nowManila.getHours() >= 12)
      ? shiftDays(parseDateKey(todayStr), 1).toISOString().split('T')[0]
      : todayStr;

    // How many upcoming lineups a single run processes.
    const limit = schedule.advanceWeeks && schedule.advanceWeeks > 0 ? schedule.advanceWeeks : 1;
    const upcomingItems = sortedQueue
      .filter(q => !q.isSent && q.targetDate >= cutoffDateStr)
      .slice(0, limit);

    if (schedule.targetRole && upcomingItems.length === 0) {
      return skip(`No unsent lineup on or after ${cutoffDateStr} for role "${schedule.targetRole}".`);
    }

    let weeklyCode = 'NOT_GENERATED';
    try {
      const setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      if (setting && setting.value && setting.value.currentCode) {
        weeklyCode = setting.value.currentCode;
      }
    } catch (e) {
      console.error('[Scheduler] Error fetching weekly code', e);
    }

    // ── Confirmation-code broadcast ──────────────────────────────────────
    // Code runs post the code line only. They deliberately carry no main
    // message: the group chat already received that on the MAIN run.
    if (actionType === 'CODE') {
      const withCode = upcomingItems.find(q => q.weeklyConfirmationCode);
      if (!withCode) return skip('No confirmation code on the upcoming lineup.');
      return {
        shouldDispatch: true,
        reason: '',
        message: '',
        codeMessage: `📌 Here's our code for this week's passing of lineups: ${withCode.weeklyConfirmationCode}`,
        reminderTasks: [],
        items: [withCode.targetDate]
      };
    }

    const Member = require('../models/Member');
    const allMembers = await Member.find();
    const findMember = (name) => allMembers.find(m => m.name.toLowerCase() === String(name).toLowerCase());

    const reminderTasks = [];
    let lastFinalMessage = schedule.message;

    if (upcomingItems.length > 0) {
      for (const queuedItem of upcomingItems) {
        let finalMessage = queuedItem.messageText || schedule.message;

        const targetDateObj = parseDateKey(queuedItem.targetDate);
        const dateFormatted = formatServiceDate(targetDateObj);

        finalMessage = finalMessage.replace(/{Date Next Sunday}/gi, dateFormatted);
        finalMessage = finalMessage.replace(/{Date}/gi, dateFormatted);
        finalMessage = finalMessage.replace(/{DATE_NEXT_SUNDAY}/gi, dateFormatted);
        finalMessage = finalMessage.replace(/{WeeklyCode}/gi, queuedItem.weeklyConfirmationCode || weeklyCode);

        // Dynamic role tags — {Presider}, {Song Leader}, …
        for (const [roleName, assignedMember] of roleEntries(queuedItem.parsedRoles)) {
          finalMessage = finalMessage.replace(new RegExp(`{${escapeRegex(roleName)}}`, 'gi'), assignedMember);
        }

        // Role-targeted delivery: the message goes to one person's inbox
        // instead of the group chat.
        if (actionType === 'MAIN' && schedule.targetRole && queuedItem.parsedRoles) {
          if (queuedItem.overrideChatUrl) {
            reminderTasks.push({
              url: queuedItem.overrideChatUrl,
              message: finalMessage,
              expectedCode: queuedItem.weeklyConfirmationCode
            });
          } else {
            const assignedName = roleValue(queuedItem.parsedRoles, schedule.targetRole);
            const member = assignedName ? findMember(assignedName) : null;
            if (member && member.facebookChatUrl) {
              reminderTasks.push({
                url: member.facebookChatUrl,
                message: finalMessage,
                expectedCode: queuedItem.weeklyConfirmationCode
              });
              this.log(`[Scheduler] Added task for ${assignedName} at ${member.facebookChatUrl}`);
            } else if (assignedName) {
              this.log(`[Scheduler] Member "${assignedName}" (${schedule.targetRole}) is missing a Facebook chat URL.`);
            } else {
              this.log(`[Scheduler] Nobody assigned to ${schedule.targetRole} on ${queuedItem.targetDate}.`);
            }
          }
          // Role schedules never fall back to the group chat.
          finalMessage = '';
        }

        // Role reminders — extra nudges N days before the target date. REMINDER
        // runs only: the daily reminder cron and the main cron share a clock
        // minute, so evaluating this on MAIN too sent every nudge that fell due
        // on the main run's weekday twice, from two independent dispatches.
        const diffDays = Math.ceil((targetDateObj - parseDateKey(todayStr)) / (1000 * 60 * 60 * 24));
        if (actionType === 'REMINDER' && schedule.roleReminders && schedule.roleReminders.length > 0 && queuedItem.parsedRoles) {
          schedule.roleReminders.forEach(reminder => {
            if (!reminder.daysPrior || !reminder.daysPrior.includes(diffDays)) return;
            const assignedName = roleValue(queuedItem.parsedRoles, reminder.role);
            if (!assignedName) return;
            const member = findMember(assignedName);
            if (!member || !member.facebookChatUrl) return;

            let msg = (reminder.messageTemplate || '')
              .replace(/{Name}/gi, assignedName)
              .replace(/{Role}/gi, reminder.role);
            for (const [rName, mName] of roleEntries(queuedItem.parsedRoles)) {
              msg = msg.replace(new RegExp(`{${escapeRegex(rName)}}`, 'gi'), mName);
            }
            // The member has to be told the code the reader bot scans their chat
            // for, which is this item's own code rather than the global one.
            msg = msg.replace(/{WeeklyCode}/gi, queuedItem.weeklyConfirmationCode || weeklyCode);

            reminderTasks.push({
              url: member.facebookChatUrl,
              message: msg,
              expectedCode: queuedItem.weeklyConfirmationCode
            });
          });
        }

        // A REMINDER run only ever produces direct messages.
        if (actionType === 'REMINDER') finalMessage = '';

        lastFinalMessage = finalMessage;
      }
    } else {
      // ── No queue items: generic schedule falling back to the raw template ──
      const dateFormatted = formatServiceDate(shiftDays(parseDateKey(todayStr), 1));

      lastFinalMessage = lastFinalMessage
        .replace(/{DATE_TOMORROW}/gi, dateFormatted)
        .replace(/{DATE_TODAY}/gi, dateFormatted)
        .replace(/{Date Next Sunday}/gi, dateFormatted)
        .replace(/{Date}/gi, dateFormatted)
        .replace(/{DATE_NEXT_SUNDAY}/gi, dateFormatted)
        .replace(/{WeeklyCode}/gi, weeklyCode);

      // With no lineup to resolve role tags against, anything still in braces
      // would go to the whole chat verbatim — and be logged as a success.
      const unresolved = lastFinalMessage.match(/{[^{}]+}/g);
      if (unresolved) {
        return skip(`Queue is empty and the template still has unresolved placeholders: ${[...new Set(unresolved)].join(', ')}.`);
      }
    }

    // Reminders are gated to REMINDER runs above, so on a MAIN run this array
    // can only hold role-target tasks: empty here really does mean "nobody
    // reachable", never "no nudge happened to be due today".
    if (actionType === 'MAIN' && schedule.targetRole && reminderTasks.length === 0) {
      return skip(`No reachable member for role "${schedule.targetRole}" — check the Member Directory.`);
    }

    if (actionType === 'REMINDER' && reminderTasks.length === 0) {
      return skip('No role reminders fall due today.');
    }

    // Two rules can resolve to the same person for the same lineup — a role
    // reminder plus a role-target, or overlapping daysPrior — and the workflow
    // sends one message per task, so an undeduped list is a duplicate nudge.
    const seenTasks = new Set();
    const uniqueTasks = reminderTasks.filter(task => {
      const key = `${task.url}\u0000${task.message}`;
      if (seenTasks.has(key)) return false;
      seenTasks.add(key);
      return true;
    });

    return {
      shouldDispatch: true,
      reason: '',
      message: lastFinalMessage,
      codeMessage: '',
      reminderTasks: uniqueTasks,
      items: upcomingItems.map(q => q.targetDate)
    };
  }

  /**
   * Resolve a schedule without dispatching — powers the dashboard preview.
   */
  async previewDispatch(id, actionType = 'MAIN') {
    const schedule = await Schedule.findById(id);
    if (!schedule) return null;

    const resolved = await this.resolveDispatch(schedule, actionType);
    return {
      scheduleName: schedule.scheduleName,
      isActive: schedule.isActive !== false,
      actionType,
      chatUrl: schedule.chatUrl,
      targetRole: schedule.targetRole,
      ...resolved
    };
  }

  /**
   * Append a run outcome to the schedule's history (capped at 25 entries) and
   * mirror it onto lastRun so lists render without loading the whole array.
   */
  async recordRun(id, entry) {
    // Its own id up front so a later run-link lookup can address this exact row.
    const record = { _id: new mongoose.Types.ObjectId(), at: new Date(), recipients: 0, ...entry };
    try {
      await Schedule.findByIdAndUpdate(id, {
        $set: { lastRun: record },
        $push: { runHistory: { $each: [record], $slice: -25 } }
      });
    } catch (e) {
      console.error('[Scheduler] Failed to record run outcome:', e.message);
    }
    return record;
  }

  async triggerGitHubAction(id, actionType = 'MAIN', options = {}) {
    const trigger = options.trigger || 'cron';
    try {
      this.log(`[Scheduler] triggerGitHubAction started for id: ${id}, actionType: ${actionType}, trigger: ${trigger}`);
      const schedule = await Schedule.findById(id);

      if (!schedule) {
        this.log('[Scheduler] Schedule not found in DB!');
        return { ok: false, status: 'error', detail: 'Schedule not found' };
      }

      if (schedule.isActive === false) {
        this.log(`[Scheduler] "${schedule.scheduleName}" is paused. Skipping ${actionType}.`);
        return { ok: false, status: 'skipped', detail: 'Schedule is paused' };
      }

      const resolved = await this.resolveDispatch(schedule, actionType);

      if (!resolved.shouldDispatch) {
        this.log(`[Scheduler] ${schedule.scheduleName} / ${actionType} skipped: ${resolved.reason}`);
        // Only the daily REMINDER cron is routine noise — it is a no-op on most
        // days, and recording each one buries the dispatch that did happen. A
        // MAIN or CODE run that skipped is a real event worth keeping.
        if (trigger === 'manual' || actionType !== 'REMINDER') {
          await this.recordRun(id, { status: 'skipped', actionType, trigger, detail: resolved.reason });
        }
        return { ok: false, status: 'skipped', detail: resolved.reason, resolved };
      }

      this.log(`[Scheduler] Dispatching to GitHub API: ${schedule.githubFileName} (${resolved.reminderTasks.length} direct message(s))`);

      const response = await github.dispatchWorkflow(schedule.githubFileName, {
        dynamic_message: resolved.message || "NO_MESSAGE",
        code_message: resolved.codeMessage || "NO_MESSAGE",
        reminder_tasks: JSON.stringify(resolved.reminderTasks)
      });

      if (!response.ok) {
        this.log(`[Scheduler] Failed to trigger ${schedule.githubFileName}. ${response.detail}`);
        const record = await this.recordRun(id, { status: 'error', actionType, trigger, detail: response.detail });
        // Nothing was sent and nothing retries on its own — say so out loud.
        alerts.alertDispatchFailure(schedule, record)
          .catch(e => console.error('[Scheduler] Alert failed:', e.message));
        return { ok: false, status: 'error', detail: response.detail, resolved };
      }

      this.log(`[Scheduler] Successfully triggered GitHub workflow for ${schedule.scheduleName}`);
      // Queue items are not marked isSent here — an item stops being "the next
      // upcoming one" organically once its date passes.
      const recipients = resolved.reminderTasks.length + (resolved.message ? 1 : 0) + (resolved.codeMessage ? 1 : 0);
      const detail = resolved.items.length
        ? `Dispatched for ${resolved.items.join(', ')}`
        : 'Dispatched from the raw template';
      // GitHub's own clock, taken off the 204's header, so the run lookup's
      // created floor needs no allowance for skew.
      await this.recordRun(id, {
        status: 'success', actionType, trigger, detail, recipients,
        ghWorkflowFile: schedule.githubFileName,
        ghDispatchedAt: response.date,
        ghLookupState: 'pending'
      });

      return { ok: true, status: 'success', detail, resolved };
    } catch (error) {
      this.log(`[Scheduler] Error triggering workflow: ${error.message}`);
      console.error(error);
      const record = await this.recordRun(id, { status: 'error', actionType, trigger, detail: error.message });
      try {
        const schedule = await Schedule.findById(id).select('scheduleName').lean();
        if (schedule) {
          alerts.alertDispatchFailure(schedule, record)
            .catch(e => console.error('[Scheduler] Alert failed:', e.message));
        }
      } catch (e) {
        console.error('[Scheduler] Could not alert on the dispatch error:', e.message);
      }
      return { ok: false, status: 'error', detail: error.message };
    }
  }

  async reloadWeeklyCodeDispatch() {
    try {
      const AppSetting = require('../models/AppSetting');
      const setting = await AppSetting.findOne({ key: 'weekly_code_config' });

      if (this.weeklyCodeDispatchCronJob) {
        this.weeklyCodeDispatchCronJob.stop();
        this.weeklyCodeDispatchCronJob = null;
        console.log('[Scheduler] Stopped existing Weekly Code Dispatch Cron.');
      }

      if (setting && setting.value && setting.value.enableDispatch && setting.value.dispatchCron && setting.value.dispatchUrl) {
        this.weeklyCodeDispatchCronJob = cron.schedule(setting.value.dispatchCron, async () => {
          console.log('[Scheduler] Running Weekly Code Dispatch...');
          await this.dispatchWeeklyCode();
        }, { scheduled: true, timezone: "Asia/Manila" });
        console.log(`[Scheduler] Weekly Code Dispatch cron initialized (${setting.value.dispatchCron}).`);
      }
    } catch (e) {
      console.error('[Scheduler] Error reloading Weekly Code Dispatch Cron:', e.message);
    }
  }

  async dispatchWeeklyCode() {
    try {
      const AppSetting = require('../models/AppSetting');
      const setting = await AppSetting.findOne({ key: 'weekly_code_config' });
      if (!setting || !setting.value || !setting.value.enableDispatch || !setting.value.dispatchUrl) {
        return;
      }

      const { currentCode, dispatchUrl, dispatchMessage } = setting.value;
      const codeToUse = currentCode || 'NOT_GENERATED';
      let message = dispatchMessage || 'Here is the code: {WeeklyCode}';

      message = message.replace(/{WeeklyCode}/gi, codeToUse);

      // This workflow was never part of the bot repository, so the dispatch
      // below used to 404 every single week. Create it if it is not there.
      const ensured = await ensureWeeklyCodeWorkflow();
      if (!ensured.ok) {
        console.error(`[Scheduler] Cannot dispatch the weekly code: ${ensured.detail}`);
        return;
      }

      const response = await github.dispatchWorkflow(WEEKLY_CODE_WORKFLOW, {
        target_url: dispatchUrl,
        message
      });

      if (!response.ok) {
        console.error(`[Scheduler] Failed to trigger ${WEEKLY_CODE_WORKFLOW}: ${response.detail}`);
        if (ensured.created) {
          console.error('[Scheduler] The workflow was created moments ago; GitHub may need a minute before it accepts a dispatch for it.');
        }
      } else {
        console.log(`[Scheduler] Successfully dispatched Weekly Code to ${dispatchUrl}`);
      }
    } catch (e) {
      console.error('[Scheduler] Error dispatching Weekly Code:', e.message);
    }
  }
}

// Export a singleton instance
module.exports = new AutomationScheduler();
