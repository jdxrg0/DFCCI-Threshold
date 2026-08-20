const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const Submission = require('../models/Submission');
const automationScheduler = require('../services/automationScheduler');
const { GH_OWNER, GH_REPO, ghHeaders, floorSec, listRunsSince } = require('../services/githubRuns');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Apply auth and admin role check to all automation routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/.github/workflows`;

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
const pushWorkflow = async (fileName, scheduleName, chatUrl, commitMessage, sha) => {
  const body = {
    message: commitMessage,
    content: Buffer.from(buildWorkflowYaml(scheduleName, chatUrl)).toString('base64'),
    branch: 'main'
  };
  if (sha) body.sha = sha;

  const response = await fetch(`${GH_API}/${fileName}`, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to write schedule to GitHub');
  return data.content.sha;
};

/** GitHub rejects a write whose SHA is stale, so always read the live one. */
const latestSha = async (fileName, fallback) => {
  try {
    const res = await fetch(`${GH_API}/${fileName}`, { headers: ghHeaders() });
    if (res.ok) {
      const fileData = await res.json();
      return fileData.sha;
    }
  } catch (e) {
    console.warn('Failed to fetch latest sha, using cached', e.message);
  }
  return fallback;
};

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
    res.status(500).json({
      msg: 'Failed to push schedule to GitHub',
      error: error.message
    });
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
    res.status(500).json({
      msg: 'Failed to update schedule on GitHub',
      error: error.message
    });
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
    res.status(500).json({ msg: 'Failed to duplicate schedule', error: error.message });
  }
});

// A run that has not surfaced within a day never will, so stop asking for it.
const GH_PENDING_TTL_MS = 24 * 60 * 60 * 1000;
const GH_RUNS_CACHE_MS = 15 * 1000;
const ghRunsCache = new Map();

/* Opening the history modal twice in a row must not cost two GitHub calls. */
const cachedRunsSince = async (workflowFile, since) => {
  const key = `${workflowFile}|${since.toISOString()}`;
  const hit = ghRunsCache.get(key);
  if (hit && Date.now() - hit.at < GH_RUNS_CACHE_MS) return hit.result;

  const result = await listRunsSince(workflowFile, since);
  for (const [cached, entry] of ghRunsCache) {
    if (Date.now() - entry.at >= GH_RUNS_CACHE_MS) ghRunsCache.delete(cached);
  }
  ghRunsCache.set(key, { at: Date.now(), result });
  return result;
};

/**
 * Attach GitHub Actions run links to a schedule's history, lazily.
 *
 * A dispatch only records that it fired and when — the run it produced is not
 * visible for seconds to tens of seconds afterwards — so the matching happens
 * here, on the admin's first look, and costs at most one GitHub request.
 * Mutates the loaded document so the response carries whatever was resolved.
 */
const enrichRunLinks = async (schedule) => {
  const history = schedule.runHistory || [];
  if (!schedule.githubFileName || history.length === 0) return;

  const writes = [];
  const stage = (row, fields) => {
    Object.assign(row, fields);
    writes.push({ row, fields });
  };

  const pending = [];
  const refreshing = [];
  const now = Date.now();

  for (const row of history) {
    if (row.ghRunId && row.ghRunStatus !== 'completed') { refreshing.push(row); continue; }
    if (row.ghLookupState !== 'pending' || !row.ghDispatchedAt) continue;
    if (now - new Date(row.ghDispatchedAt).getTime() > GH_PENDING_TTL_MS) {
      stage(row, { ghLookupState: 'not_found' });
      continue;
    }
    pending.push(row);
  }

  const needed = [...pending, ...refreshing];
  if (needed.length > 0) {
    const since = new Date(Math.min(...needed.map(r => new Date(r.ghDispatchedAt || r.at).getTime())));
    const { state, runs } = await cachedRunsSince(schedule.githubFileName, since);

    if (state === 'unavailable') {
      // The token cannot read Actions. A dispatch that worked must not start
      // looking like a failure because its link could not be fetched.
      pending.forEach(row => stage(row, { ghLookupState: 'unavailable' }));
    } else if (state === 'ok') {
      const byRunId = new Map(runs.map(r => [r.id, r]));
      for (const row of refreshing) {
        const run = byRunId.get(row.ghRunId);
        if (!run) continue;
        stage(row, { ghRunStatus: run.status, ghRunConclusion: run.conclusion || '' });
      }

      // Run ids increase monotonically per repository, so demanding an id above
      // every one already claimed makes it impossible to hand a row last week's
      // run — every schedule reuses one workflow file for years.
      let minRunId = history.reduce((max, r) => (r.ghRunId > max ? r.ghRunId : max), 0);
      const oldestFirst = [...pending].sort((a, b) => new Date(a.at) - new Date(b.at));

      for (const row of oldestFirst) {
        const floor = floorSec(row.ghDispatchedAt);
        const match = runs
          .filter(r => new Date(r.created_at) >= floor && r.id > minRunId)
          .sort((a, b) => a.id - b.id)[0];
        // No match means "not visible yet", never a guess: it stays pending and
        // resolves the next time the history is opened.
        if (!match) continue;
        minRunId = match.id;
        stage(row, {
          ghRunId: match.id,
          ghRunUrl: match.html_url,
          ghRunStatus: match.status,
          ghRunConclusion: match.conclusion || '',
          ghLookupState: 'resolved'
        });
      }
    }
  }

  const addressable = writes.filter(write => write.row._id);
  if (addressable.length === 0) return;

  // Positional filters rather than a whole-array write, so a dispatch landing
  // mid-enrichment is not clobbered.
  const $set = {};
  const arrayFilters = [];
  addressable.forEach((write, i) => {
    const alias = `r${i}`;
    arrayFilters.push({ [`${alias}._id`]: write.row._id });
    Object.entries(write.fields).forEach(([field, value]) => {
      $set[`runHistory.$[${alias}].${field}`] = value;
    });
  });

  const newest = history.reduce((a, b) => (new Date(b.at) > new Date(a.at) ? b : a));
  const newestWrite = addressable.find(write => write.row === newest);
  if (newestWrite) {
    Object.entries(newestWrite.fields).forEach(([field, value]) => {
      $set[`lastRun.${field}`] = value;
      schedule.set(`lastRun.${field}`, value);
    });
  }

  await Schedule.updateOne({ _id: schedule._id }, { $set }, { arrayFilters });
};

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

    // Delete from GitHub Actions
    const ghResponse = await fetch(`${GH_API}/${schedule.githubFileName}`, {
      method: 'DELETE',
      headers: ghHeaders(),
      body: JSON.stringify({
        message: `Delete schedule: ${schedule.scheduleName}`,
        sha: await latestSha(schedule.githubFileName, schedule.githubFileSha),
        branch: 'main'
      })
    });

    if (!ghResponse.ok) {
      const errorData = await ghResponse.json();
      console.warn('GitHub deletion warning:', errorData.message);
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

module.exports = router;
