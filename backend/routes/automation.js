const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const automationScheduler = require('../services/automationScheduler');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Apply auth and admin role check to all automation routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

const GH_OWNER = 'd0ul0s';
const GH_REPO = 'Residential-Proxy-Method';
const GH_API = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/.github/workflows`;

const ghHeaders = () => ({
  'Authorization': `token ${process.env.GITHUB_PAT}`,
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json'
});

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
    const dateObj = new Date(q.targetDate || Date.now());
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const yy = String(dateObj.getFullYear()).slice(-2);
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
    const { scheduleName, cronTime, codeCronTime, enableCodeBroadcast, codeTemplate, chatUrl = '', targetRole = '', advanceWeeks = 0, message, messageQueue = [], roleReminders = [] } = req.body;

    if (!scheduleName || !cronTime || (!chatUrl && !targetRole) || !message) {
      return res.status(400).json({ msg: 'Please provide all required fields (Target Chat URL or Target Role is required)' });
    }

    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ msg: 'Schedule not found' });
    }

    const sha = await latestSha(schedule.githubFileName, schedule.githubFileSha);
    const newSha = await pushWorkflow(schedule.githubFileName, scheduleName, chatUrl, `Update schedule: ${scheduleName}`, sha);

    schedule.scheduleName = scheduleName;
    schedule.cronTime = cronTime;
    schedule.codeCronTime = codeCronTime;
    schedule.enableCodeBroadcast = enableCodeBroadcast;
    schedule.codeTemplate = codeTemplate;
    schedule.chatUrl = chatUrl;
    schedule.targetRole = targetRole;
    schedule.advanceWeeks = advanceWeeks;
    schedule.message = message;
    schedule.messageQueue = fillConfirmationCodes(messageQueue, codeTemplate);
    schedule.roleReminders = roleReminders;
    schedule.githubFileSha = newSha;

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

// GET /api/automation/schedule/:id/runs — newest first
router.get('/schedule/:id/runs', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id).select('scheduleName runHistory lastRun');
    if (!schedule) return res.status(404).json({ msg: 'Schedule not found' });

    const runs = [...(schedule.runHistory || [])].sort((a, b) => new Date(b.at) - new Date(a.at));
    res.json({ scheduleName: schedule.scheduleName, lastRun: schedule.lastRun, runs });
  } catch (error) {
    console.error('Fetch Runs Error:', error.message);
    res.status(500).json({ msg: 'Server error fetching run history' });
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
