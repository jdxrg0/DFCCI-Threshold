const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Schedule = require('../models/Schedule');
const github = require('../services/github');

/**
 * The reader bot posts here from a GitHub Actions runner, so there is no
 * session to check — it authenticates with a shared secret instead.
 *
 * A report that completes a lineup dispatches a workflow, so an open endpoint
 * meant an anonymous POST could cause a real Messenger post. The guard is
 * deliberately fail-closed: until BOT_WEBHOOK_SECRET is configured this server
 * (and the repository secret the bot sends as x-bot-secret) cannot be
 * deployed on the same set. Without a configured secret nobody, not even the
 * legitimate bot, gets through.
 */
const requireBotSecret = (req, res, next) => {
  const expected = process.env.BOT_WEBHOOK_SECRET;

  if (!expected) {
    console.error(
      '[Submissions API] BOT_WEBHOOK_SECRET is not set — rejecting all reports. ' +
      'Set it here and as a repository secret on the bot, then restart.'
    );
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const header = req.get('x-bot-secret')
    || (req.get('authorization') || '').replace(/^Bearer\s+/i, '');

  if (header !== expected) {
    console.warn('[Submissions API] Rejected a report with a missing or wrong bot secret.');
    return res.status(401).json({ error: 'Invalid bot credentials' });
  }
  return next();
};

// This route receives data from the Puppeteer Reader Bot
// POST /api/submissions/report
router.post('/report', requireBotSecret, async (req, res) => {
  try {
    // Expected payload: { referenceCode: 'DFCCI-S-LU-071926', content: '...', role: 'Song Leader' }
    const { referenceCode, content, role } = req.body;

    if (!referenceCode || !content || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Find which schedule this code belongs to
    // We search through all schedules' messageQueues for the weeklyConfirmationCode matching this referenceCode
    const schedules = await Schedule.find();
    let targetSchedule = null;
    let targetQueueItem = null;

    for (const schedule of schedules) {
      const match = schedule.messageQueue.find(q => q.weeklyConfirmationCode === referenceCode);
      if (match) {
        targetSchedule = schedule;
        targetQueueItem = match;
        break;
      }
    }

    if (!targetSchedule) {
      console.warn(`[Submissions API] Received report for unknown code: ${referenceCode}`);
      return res.status(404).json({ error: 'Code not found in any active schedule' });
    }

    // 2. Find or create the Submission aggregator for this code
    let submission = await Submission.findOne({ referenceCode });
    if (!submission) {
      submission = new Submission({
        referenceCode,
        scheduleId: targetSchedule._id,
        partsReceived: new Map()
      });
    }

    // 3. Save this part
    submission.partsReceived.set(role, content);
    await submission.save();

    console.log(`[Submissions API] Received part for ${referenceCode} -> Role: ${role}`);

    // 4. Check if we have all the required parts to complete the aggregator
    // The rule lives on the model so the reader bot, this endpoint and the
    // confirmations read can never disagree about what "complete" means, and
    // so an item with no parsedRoles (PATCH /queue makes those) cannot 500.
    const requiredRoles = Schedule.requiredRolesFor(targetQueueItem);

    let isComplete = true;
    for (const reqRole of requiredRoles) {
      if (!submission.partsReceived.has(reqRole)) {
        isComplete = false;
        break;
      }
    }

    if (isComplete && !submission.isComplete) {
      submission.isComplete = true;
      await submission.save();

      console.log(`[Submissions API] Code ${referenceCode} is fully assembled! Triggering final dispatch...`);
      
      // Assemble the final message
      let finalMessage = `${targetQueueItem.targetDate}\n\n`;
      
      if (submission.partsReceived.has('Opening Song')) {
        finalMessage += `Officiant: ${Schedule.roleValue(targetQueueItem.parsedRoles, 'Opening Song')}\n`;
        finalMessage += `Opening Song:\n${submission.partsReceived.get('Opening Song')}\n\n`;
      }

      if (submission.partsReceived.has('Song Leader')) {
        finalMessage += `Officiant: ${Schedule.roleValue(targetQueueItem.parsedRoles, 'Song Leader')}\n`;
        finalMessage += `${submission.partsReceived.get('Song Leader')}\n`;
      }

      // The assembled lineup goes back out through the schedule's own workflow.
      // A failure here used to be invisible: the reply was banked, the caller
      // got a 200, and the post that should have followed simply never happened.
      const dispatch = await github.dispatchWorkflow(targetSchedule.githubFileName, {
        dynamic_message: finalMessage,
        code_message: "",
        reminder_tasks: "[]"
      });

      if (!dispatch.ok) {
        console.error(`[Submissions API] Final dispatch for ${referenceCode} failed: ${dispatch.detail}`);
      }
    }

    res.status(200).json({ success: true, isComplete: submission.isComplete });

  } catch (error) {
    console.error('[Submissions API] Error:', error);
    res.status(500).json({ error: 'Server error processing submission' });
  }
});

module.exports = router;
