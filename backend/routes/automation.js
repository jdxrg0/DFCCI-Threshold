const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const Submission = require('../models/Submission');
const AppSetting = require('../models/AppSetting');
const automationScheduler = require('../services/automationScheduler');
const { enrichRunLinks } = require('../services/runLinks');
const github = require('../services/github');
const { WEEKLY_CODE_WORKFLOW } = require('../services/weeklyCodeWorkflow');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Apply auth and admin role check to all automation routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

/* A missing or rejected token is a server configuration fault, not a bad
   request, and it is the single most common reason this module stops working.
   Answering 503 with the reason lets the dashboard show something actionable
   instead of GitHub's own "Bad credentials". */
const githubFailure = (res, error, fallbackMsg) => {
  if (error.isMissingPat) {
    return res.status(503).json({ msg: error.message, error: 'GITHUB_PAT_MISSING' });
  }
  return res.status(500).json({ msg: fallbackMsg, error: error.message });
};

/**
 * The Puppeteer workflow that actually posts to Messenger. One file per
 * schedule, dispatched by the scheduler with the resolved message as input.
 */
const buildWorkflowYaml = (scheduleName, chatUrl) => `name: "Messenger Reminder: ${scheduleName}"

on:
  workflow_dispatch:
    inputs:
      dynamic_message:
        description: 'The message to send'
        required: true
        default: ''
      code_message:
        description: 'Optional secondary message containing confirmation codes'
        required: false
        default: ''
      reminder_tasks:
        description: 'JSON string of tasks to execute for targeted reminders'
        required: false
        default: '[]'

jobs:
  deploy-message:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - name: Execute Script
        env:
          FACEBOOK_COOKIES: \${{ secrets.FACEBOOK_COOKIES }}
          PROXY_SERVER: \${{ secrets.PROXY_SERVER }}
          PROXY_USERNAME: \${{ secrets.PROXY_USERNAME }}
          PROXY_PASSWORD: \${{ secrets.PROXY_PASSWORD }}
          CHAT_URL: '${chatUrl}'
          CHAT_MESSAGE: |
            \${{ github.event.inputs.dynamic_message }}
          CHAT_CODE_MESSAGE: |
            \${{ github.event.inputs.code_message }}
          REMINDER_TASKS: |
            \${{ github.event.inputs.reminder_tasks }}
          FB_E2EE_PIN: \${{ secrets.FB_E2EE_PIN }}
        run: node index.js
      - name: Upload Debug Screenshot
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: debug-screenshot
          path: debug.png
          retention-days: 1
`;

/** Create the workflow file on GitHub. Returns the new file's SHA. */
const pushWorkflow = (fileName, scheduleName, chatUrl, commitMessage, sha) =>
  github.putWorkflow(fileName, buildWorkflowYaml(scheduleName, chatUrl), commitMessage, sha);

/** GitHub rejects a write whose SHA is stale, so always read the live one. */
const latestSha = async (fileName, fallback) => (await github.getWorkflowSha(fileName)) || fallback;

/** Stamp every queue item that is missing a confirmation code with one. */
const fillConfirmationCodes = (messageQueue, codeTemplate) => {
  messageQueue.forEach(q => {
    if (q.weeklyConfirmationCode) return;
    // A YYYY-MM-DD key parses to UTC midnight, so reading it back with local
    // getters stamps the previous day's code on any host behind UTC. Parse and
    // read in UTC, and fall back to the Manila date this app schedules against.
    const key = /^\d{4}-\d{2}-\d{2}$/.test(String(q.targetDate || ''))
      ? q.targetDate
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
    const [year, month, day] = key.split('-').map(Number);
    const dateObj = new Date(Date.UTC(year, month - 1, day));
    const mm = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getUTCDate()).padStart(2, '0');
    const yy = String(dateObj.getUTCFullYear()).slice(-2);
    q.weeklyConfirmationCode = (codeTemplate || 'DFCCI-S-LU-{DATE}').replace(/{DATE}/gi, `${mm}${dd}${yy}`);
  });
  return messageQueue;
};

// POST /api/automation/schedule
router.post('/schedule', async (req, res) => {
  try {
    const { scheduleName, cronTime, codeCronTime, enableCodeBroadcast, codeTemplate, chatUrl = '', targetRole = '', advanceWeeks = 0, message, messageQueue = [], roleReminders = [] } = req.body;

    if (!scheduleName || !cronTime || (!chatUrl && !targetRole) || !message) {
      return res.status(400).json({ msg: 'Please provide all required fields (Target Chat URL or Target Role is required)' });
    }

    const fileName = `schedule-${Date.now()}.yml`;
    const sha = await pushWorkflow(fileName, scheduleName, chatUrl, `Create schedule: ${scheduleName}`);

    fillConfirmationCodes(messageQueue, codeTemplate);

    const newSchedule = new Schedule({
      scheduleName,
      cronTime,
      codeCronTime,
      enableCodeBroadcast,
      codeTemplate,
      chatUrl,
      targetRole,
      advanceWeeks,
      message,
      messageQueue,
      roleReminders,
      isActive: true,
      githubFileName: fileName,
      githubFileSha: sha
    });
    const savedSchedule = await newSchedule.save();

    // Add to in-memory scheduler
    automationScheduler.addJob(savedSchedule);

    res.status(201).json({ msg: 'Schedule created successfully', data: savedSchedule });

  } catch (error) {
    console.error('GitHub API Error:', error.message);
    githubFailure(res, error, 'Failed to push schedule to GitHub');
  }
});

// GET /api/automation/schedules
router.get('/schedules', async (req, res) => {
  try {
    const schedules = await Schedule.find().sort({ createdAt: -1 });
    res.json(schedules);
  } catch (error) {
    console.error('Fetch Schedules Error:', error.message);
    res.status(500).json({ msg: 'Server error fetching schedules' });
  }
});

// PUT /api/automation/schedule/:id
router.put('/schedule/:id', async (req, res) => {
  try {
    const { scheduleName, cronTime, message } = req.body;

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ msg: 'Schedule not found' });
    }

    // Validated against the merged document, not the request body. A client that
    // omits chatUrl or targetRole is leaving it alone rather than clearing it,
    // and checking the body alone rejected every role-targeted schedule.
    const nextChatUrl = req.body.chatUrl !== undefined ? req.body.chatUrl : (schedule.chatUrl || '');
    const nextTargetRole = req.body.targetRole !== undefined ? req.body.targetRole : (schedule.targetRole || '');

    if (!scheduleName || !cronTime || (!nextChatUrl && !nextTargetRole) || !message) {
      return res.status(400).json({ msg: 'Please provide all required fields (Target Chat URL or Target Role is required)' });
    }

    schedule.scheduleName = scheduleName;
    schedule.cronTime = cronTime;
    schedule.chatUrl = nextChatUrl;
    schedule.message = message;

    // Omitted means unchanged, for every optional field. Defaulting them here
    // let a client that only knows part of the form wipe the rest of it: a save
    // from the main editor erased every role reminder, and a save from the
    // reminder editor turned a role schedule back into a group one.
    ['codeCronTime', 'enableCodeBroadcast', 'codeTemplate', 'targetRole', 'advanceWeeks', 'roleReminders']
      .forEach(field => {
        if (req.body[field] !== undefined) schedule[field] = req.body[field];
      });

    if (req.body.messageQueue !== undefined) {
      const codeTemplate = req.body.codeTemplate !== undefined ? req.body.codeTemplate : schedule.codeTemplate;
      schedule.messageQueue = fillConfirmationCodes(req.body.messageQueue, codeTemplate);
    }

    // Validate before writing to GitHub. A malformed reminder rule should be a
    // 400 the editor can show, not a rewritten workflow file for a save that
    // then fails on the way to the database.
    try {
      await schedule.validate();
    } catch (validationError) {
      return res.status(400).json({ msg: validationError.message });
    }

    const sha = await latestSha(schedule.githubFileName, schedule.githubFileSha);
    schedule.githubFileSha = await pushWorkflow(
      schedule.githubFileName, scheduleName, nextChatUrl, `Update schedule: ${scheduleName}`, sha
    );

    const savedSchedule = await schedule.save();

    // Update in-memory scheduler (a paused schedule simply gets no timers)
    automationScheduler.addJob(savedSchedule);

    res.json({ msg: 'Schedule updated successfully', data: savedSchedule });

  } catch (error) {
    console.error('Update Schedule Error:', error.message);
    githubFailure(res, error, 'Failed to update schedule on GitHub');
  }
});

// PATCH /api/automation/schedule/:id/active — pause or resume without deleting
router.patch('/schedule/:id/active', async (req, res) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ msg: 'isActive must be a boolean' });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ msg: 'Schedule not found' });

    schedule.isActive = isActive;
    await schedule.save();

    if (isActive) {
      automationScheduler.addJob(schedule);
    } else {
      automationScheduler.removeJob(req.params.id);
    }

    res.json({ msg: isActive ? 'Schedule resumed' : 'Schedule paused', data: schedule });
  } catch (error) {
    console.error('Toggle Schedule Error:', error.message);
    res.status(500).json({ msg: 'Server error updating schedule state' });
  }
});

// POST /api/automation/schedule/:id/run — dispatch now, or resolve a preview
// Body: { actionType: 'MAIN' | 'REMINDER' | 'CODE', dryRun: boolean }
router.post('/schedule/:id/run', async (req, res) => {
  try {
    const { actionType = 'MAIN', dryRun = false } = req.body;
    if (!['MAIN', 'REMINDER', 'CODE'].includes(actionType)) {
      return res.status(400).json({ msg: 'actionType must be MAIN, REMINDER or CODE' });
    }

    if (dryRun) {
      const preview = await automationScheduler.previewDispatch(req.params.id, actionType);
      if (!preview) return res.status(404).json({ msg: 'Schedule not found' });
      return res.json({ msg: 'Preview resolved', data: preview });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) return res.status(404).json({ msg: 'Schedule not found' });
    if (schedule.isActive === false) {
      return res.status(409).json({ msg: 'Schedule is paused — resume it before running.' });
    }

    const result = await automationScheduler.triggerGitHubAction(req.params.id, actionType, { trigger: 'manual' });
    const updated = await Schedule.findById(req.params.id);

    res.json({
      msg: result.ok ? 'Workflow dispatched' : `Run ${result.status}: ${result.detail}`,
      data: { result, schedule: updated }
    });
  } catch (error) {
    console.error('Manual Run Error:', error.message);
    res.status(500).json({ msg: 'Server error running schedule', error: error.message });
  }
});

// POST /api/automation/schedule/:id/duplicate — clone, paused, with its own
// workflow file so editing the copy never touches the original.
router.post('/schedule/:id/duplicate', async (req, res) => {
  try {
    const source = await Schedule.findById(req.params.id);
    if (!source) return res.status(404).json({ msg: 'Schedule not found' });

    const scheduleName = `${source.scheduleName} (Copy)`;
    const fileName = `schedule-${Date.now()}.yml`;
    const sha = await pushWorkflow(fileName, scheduleName, source.chatUrl, `Duplicate schedule: ${scheduleName}`);

    const copy = new Schedule({
      scheduleName,
      cronTime: source.cronTime,
      codeCronTime: source.codeCronTime,
      enableCodeBroadcast: source.enableCodeBroadcast,
      codeTemplate: source.codeTemplate,
      chatUrl: source.chatUrl,
      targetRole: source.targetRole,
      advanceWeeks: source.advanceWeeks,
      message: source.message,
      messageQueue: source.messageQueue,
      roleReminders: source.roleReminders,
      // Copies start paused so a duplicate never double-posts by accident.
      isActive: false,
      githubFileName: fileName,
      githubFileSha: sha
    });

    const saved = await copy.save();
    res.status(201).json({ msg: 'Schedule duplicated (paused)', data: saved });
  } catch (error) {
    console.error('Duplicate Schedule Error:', error.message);
    githubFailure(res, error, 'Failed to duplicate schedule');
  }
});

// GET /api/automation/schedule/:id/runs — newest first
router.get('/schedule/:id/runs', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).select('scheduleName runHistory lastRun githubFileName');
    if (!schedule) return res.status(404).json({ msg: 'Schedule not found' });

    try {
      await enrichRunLinks(schedule);
    } catch (e) {
      // Run links are a nicety; the history itself must always render.
      console.warn('Run link enrichment failed:', e.message);
    }

    const runs = [...(schedule.runHistory || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ scheduleName: schedule.scheduleName, lastRun: schedule.lastRun, runs });
  } catch (error) {
    console.error('Fetch Runs Error:', error.message);
    res.status(500).json({ msg: 'Server error fetching run history' });
  }
});

// GET /api/automation/schedule/:id/confirmations — who has replied, per lineup
router.get('/schedule/:id/confirmations', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id)
      .select('scheduleName messageQueue').lean();
    if (!schedule) return res.status(404).json({ msg: 'Schedule not found' });

    const queue = schedule.messageQueue || [];

    // Scoped to the stored foreign key, never to the codes. Confirmation codes
    // are a pure function of the lineup date, so two schedules sharing a
    // template and a Sunday hold identical ones — matching on those would let a
    // duplicated schedule that has messaged nobody claim the original's replies.
    const submissions = await Submission.find({ scheduleId: schedule._id }).lean();
    const byRef = new Map(submissions.map(s => [s.referenceCode, s]));

    const byDate = {};
    const byCode = {};

    queue.forEach(item => {
      // PATCH /queue creates items with neither a code nor roles, so nothing
      // here may assume either exists — including the date itself.
      if (!item.targetDate) return;
      const referenceCode = item.weeklyConfirmationCode || null;
      const submission = referenceCode ? byRef.get(referenceCode) : null;
      const required = Schedule.requiredRolesFor(item);
      const received = required.filter(role =>
        Schedule.roleValue(submission && submission.partsReceived, role) !== undefined);
      const missing = required.filter(role => !received.includes(role));

      if (referenceCode) byCode[referenceCode] = item.targetDate;
      byDate[item.targetDate] = {
        targetDate: item.targetDate,
        referenceCode,
        required,
        received,
        missing,
        receivedCount: received.length,
        requiredCount: required.length,
        isComplete: Boolean(submission) && missing.length === 0,
        hasSubmission: Boolean(submission),
        submissionId: submission ? String(submission._id) : null,
        firstReceivedAt: submission ? submission.createdAt : null
      };
    });

    // Replies filed under a code the queue no longer carries — the lineup was
    // re-uploaded, or its code regenerated, after the member answered.
    const orphans = submissions
      .filter(s => !byCode[s.referenceCode])
      .map(s => ({
        referenceCode: s.referenceCode,
        submissionId: String(s._id),
        isComplete: Boolean(s.isComplete),
        received: Schedule.roleKeys(s.partsReceived),
        createdAt: s.createdAt
      }));

    // The reader bot writes on its own two-hourly cadence, so a cached view
    // would show a confirmation that has already landed as still missing.
    res.set('Cache-Control', 'no-store');
    res.json({
      scheduleId: String(schedule._id),
      scheduleName: schedule.scheduleName,
      trackedRoles: Schedule.TRACKED_ROLES,
      byDate,
      byCode,
      orphans
    });
  } catch (error) {
    console.error('Fetch Confirmations Error:', error.message);
    res.status(500).json({ msg: 'Server error fetching confirmations' });
  }
});

// DELETE /api/automation/schedule/:id
router.delete('/schedule/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ msg: 'Schedule not found' });
    }

    // Delete from GitHub Actions. A workflow file that cannot be removed is
    // worth a warning, never a failed delete: leaving the row behind because
    // its file lingers would strand the schedule in the dashboard forever.
    try {
      const ghResponse = await github.deleteWorkflow(
        schedule.githubFileName,
        `Delete schedule: ${schedule.scheduleName}`,
        await latestSha(schedule.githubFileName, schedule.githubFileSha)
      );
      if (!ghResponse.ok) {
        const errorData = await ghResponse.json().catch(() => ({}));
        console.warn('GitHub deletion warning:', errorData.message);
      }
    } catch (e) {
      console.warn('GitHub deletion skipped:', e.message);
    }

    // Delete from DB
    await Schedule.findByIdAndDelete(req.params.id);

    // Remove from in-memory scheduler
    automationScheduler.removeJob(req.params.id);

    res.json({ msg: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete Schedule Error:', error.message);
    res.status(500).json({ msg: 'Server error deleting schedule' });
  }
});

// PATCH /api/automation/schedule/:id/queue
router.patch('/schedule/:id/queue', async (req, res) => {
  try {
    const { targetDate, messageText, overrideChatUrl } = req.body;
    const schedule = await Schedule.findById(req.params.id);

    if (!schedule) {
      return res.status(404).json({ msg: 'Schedule not found' });
    }

    const queueItem = schedule.messageQueue.find(q => q.targetDate === targetDate);
    if (queueItem) {
      queueItem.messageText = messageText;
      if (overrideChatUrl !== undefined) queueItem.overrideChatUrl = overrideChatUrl;
    } else {
      schedule.messageQueue.push({ targetDate, messageText, overrideChatUrl, isSent: false });
    }

    await schedule.save();
    res.json({ msg: 'Queue updated successfully', data: schedule });
  } catch (error) {
    console.error('Update Queue Error:', error.message);
    res.status(500).json({ msg: 'Server error updating queue' });
  }
});

// GET /api/automation/health — why is the hub not sending?
//
// Every dependency this module has, probed live and reported as plain facts:
// the token, the repo, the timers actually registered in this process, and
// whether each schedule's workflow file still exists on GitHub. It exists so
// "nothing is going out" can be answered without reading server logs.
router.get('/health', async (req, res) => {
  try {
    const gh = await github.probe();
    const schedules = await Schedule.find().select('scheduleName cronTime isActive githubFileName lastRun').lean();
    const registered = automationScheduler.registeredJobIds();

    // Two lists, because they demand different things of the reader. A problem
    // means messages are not going out and someone must act now; a warning
    // means something is misconfigured or untidy but delivery is unaffected.
    // Reporting both as "stopping this from working" trains people to ignore
    // the banner, which costs exactly the outage it exists to prevent.
    const problems = [...gh.problems];
    const warnings = [];

    const scheduleRows = schedules.map(s => {
      const active = s.isActive !== false;
      const timersRunning = registered.includes(String(s._id));
      // null, not false: with no Actions read the file list is unknown, and
      // reporting "missing" would send an admin chasing a file that is there.
      const workflowPresent = gh.workflowFiles ? gh.workflowFiles.includes(s.githubFileName) : null;

      if (active && !timersRunning) {
        problems.push(`"${s.scheduleName}" is active but has no timer in this process — its cronTime ("${s.cronTime}") was most likely rejected at startup.`);
      }
      if (workflowPresent === false) {
        problems.push(`"${s.scheduleName}" points at ${s.githubFileName}, which is not on ${gh.owner}/${gh.repo}. Re-save the schedule to recreate it.`);
      }

      return {
        id: String(s._id),
        scheduleName: s.scheduleName,
        cronTime: s.cronTime,
        isActive: active,
        timersRunning,
        githubFileName: s.githubFileName,
        workflowPresent,
        lastRun: s.lastRun || null
      };
    });

    const setting = await AppSetting.findOne({ key: 'weekly_code_config' }).lean();
    const weeklyCode = setting && setting.value ? setting.value : null;
    if (weeklyCode && weeklyCode.enableDispatch) {
      // Enabled with no target reads as configured everywhere in the UI, but
      // the cron is never even registered — the dispatcher returns early.
      if (!weeklyCode.dispatchUrl) {
        warnings.push('Weekly code auto-dispatch is switched on but has no target chat URL, so it never runs. Set one in the weekly-code panel, or switch it off.');
      } else if (gh.workflowFiles && !gh.workflowFiles.includes(WEEKLY_CODE_WORKFLOW)) {
        // Only worth saying once dispatch could actually happen. Without a URL
        // the missing file is a consequence of the line above, not news.
        warnings.push(`Weekly code auto-dispatch is on, but ${WEEKLY_CODE_WORKFLOW} is not on the repo yet. It is created automatically on the first dispatch.`);
      }
    }

    // A delete that could not reach GitHub — no token, most often — removes the
    // row and leaves the workflow file. Harmless, but it accumulates and makes
    // the repo's workflow list impossible to reconcile with the dashboard.
    const claimed = new Set(schedules.map(s => s.githubFileName));
    const orphanWorkflows = (gh.workflowFiles || [])
      .filter(f => /^schedule-\d+\.yml$/.test(f) && !claimed.has(f));
    if (orphanWorkflows.length > 0) {
      warnings.push(`${orphanWorkflows.length} workflow file(s) on the repo belong to no schedule: ${orphanWorkflows.join(', ')}. Safe to delete on GitHub.`);
    }

    res.set('Cache-Control', 'no-store');
    res.json({
      ok: problems.length === 0,
      github: gh,
      scheduler: {
        registeredJobs: registered.length,
        schedules: scheduleRows.length,
        active: scheduleRows.filter(s => s.isActive).length
      },
      weeklyCode: weeklyCode
        ? {
          currentCode: weeklyCode.currentCode || null,
          lastGeneratedDate: weeklyCode.lastGeneratedDate || null,
          enableDispatch: Boolean(weeklyCode.enableDispatch),
          dispatchCron: weeklyCode.dispatchCron || null,
          hasDispatchUrl: Boolean(weeklyCode.dispatchUrl)
        }
        : null,
      schedules: scheduleRows,
      orphanWorkflows,
      problems,
      warnings
    });
  } catch (error) {
    console.error('Automation Health Error:', error.message);
    res.status(500).json({ msg: 'Server error probing automation health', error: error.message });
  }
});

module.exports = router;
