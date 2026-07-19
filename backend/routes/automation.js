const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const automationScheduler = require('../services/automationScheduler');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Apply auth and admin role check to all automation routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// POST /api/automation/schedule
router.post('/schedule', async (req, res) => {
  try {
    const { scheduleName, cronTime, codeCronTime, enableCodeBroadcast, codeTemplate, chatUrl = '', targetRole = '', advanceWeeks = 0, message, messageQueue = [], roleReminders = [] } = req.body;

    if (!scheduleName || !cronTime || (!chatUrl && !targetRole) || !message) {
      return res.status(400).json({ msg: 'Please provide all required fields (Target Chat URL or Target Role is required)' });
    }

    // 1. Generate the correct Puppeteer GitHub Actions YAML string
    const yamlContent = `name: "Messenger Reminder: ${scheduleName}"

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
          CHAT_URL: '${chatUrl}'
          CHAT_MESSAGE: |
            \${{ github.event.inputs.dynamic_message }}
          CHAT_CODE_MESSAGE: |
            \${{ github.event.inputs.code_message }}
          REMINDER_TASKS: |
            \${{ github.event.inputs.reminder_tasks }}
          FB_E2EE_PIN: \${{ secrets.FB_E2EE_PIN }}
        run: node index.js
`;

    // Convert the YAML string into Base64 format
    const base64Content = Buffer.from(yamlContent).toString('base64');

    // Define GitHub Variables (Fill these in!)
    const owner = 'd0ul0s';
    const repo = 'Residential-Proxy-Method';
    const fileName = `schedule-${Date.now()}.yml`;

    // Make PUT request to GitHub API to create the file
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/${fileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Create schedule: ${scheduleName}`,
        content: base64Content,
        branch: 'main'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create schedule on GitHub');
    }

    if (messageQueue.length > 0) {
      messageQueue.forEach(q => {
        if (!q.weeklyConfirmationCode) {
          q.weeklyConfirmationCode = '#' + Math.floor(100000 + Math.random() * 900000);
        }
      });
    }

    // Save to DB
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
      githubFileName: fileName,
      githubFileSha: data.content.sha
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

    const yamlContent = `name: "Messenger Reminder: ${scheduleName}"

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

    const base64Content = Buffer.from(yamlContent).toString('base64');
    const owner = 'd0ul0s';
    const repo = 'Residential-Proxy-Method';

    // Always fetch the latest SHA from GitHub to prevent mismatch errors
    let currentSha = schedule.githubFileSha;
    try {
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/${schedule.githubFileName}`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileData = await getRes.json();
        currentSha = fileData.sha;
      }
    } catch (e) {
      console.warn('Failed to fetch latest sha, using cached', e);
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/${schedule.githubFileName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${process.env.GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Update schedule: ${scheduleName}`,
        content: base64Content,
        sha: currentSha,
        branch: 'main'
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to update schedule on GitHub');
    }

    // Update DB
    schedule.scheduleName = scheduleName;
    schedule.cronTime = cronTime;
    schedule.codeCronTime = codeCronTime;
    schedule.enableCodeBroadcast = enableCodeBroadcast;
    schedule.codeTemplate = codeTemplate;
    schedule.chatUrl = chatUrl;
    schedule.targetRole = targetRole;
    schedule.advanceWeeks = advanceWeeks;
    schedule.message = message;
    schedule.messageQueue = messageQueue;
    schedule.roleReminders = roleReminders;
    if (messageQueue.length > 0) {
      messageQueue.forEach(q => {
        if (!q.weeklyConfirmationCode) {
          const dateObj = new Date(q.targetDate || Date.now());
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');
          const yy = String(dateObj.getFullYear()).slice(-2);
          q.weeklyConfirmationCode = (codeTemplate || 'DFCCI-S-LU-{DATE}').replace(/{DATE}/gi, `${mm}${dd}${yy}`);
        }
      });
      schedule.messageQueue = messageQueue;
    }
    schedule.githubFileSha = data.content.sha;

    const savedSchedule = await schedule.save();
    
    // Update in-memory scheduler
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

// DELETE /api/automation/schedule/:id
router.delete('/schedule/:id', async (req, res) => {
  try {
    const schedule = await Schedule.findById(req.params.id);
    if (!schedule) {
      return res.status(404).json({ msg: 'Schedule not found' });
    }

    const owner = 'd0ul0s';
    const repo = 'Residential-Proxy-Method';

    // Delete from GitHub Actions
    const ghResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/.github/workflows/${schedule.githubFileName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `token ${process.env.GITHUB_PAT}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Delete schedule: ${schedule.scheduleName}`,
        sha: schedule.githubFileSha,
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
