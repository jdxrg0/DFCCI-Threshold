const express = require('express');
const router = express.Router();
const Submission = require('../models/Submission');
const Schedule = require('../models/Schedule');

// This route receives data from the Puppeteer Reader Bot
// POST /api/submissions/report
router.post('/report', async (req, res) => {
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
    // For now, we hardcode the required roles based on the user's example, 
    // or we can deduce them from the Schedule's configuration.
    // The user mentioned: "Song Leader" (Praise/Worship) and "Opening Song".
    // If the queue item has people assigned to these roles, we expect submissions from them.
    
    // Determine which roles are actually assigned in this week's lineup
    const requiredRoles = [];
    if (targetQueueItem.parsedRoles.get('Song Leader')) requiredRoles.push('Song Leader');
    if (targetQueueItem.parsedRoles.get('Opening Song')) requiredRoles.push('Opening Song');
    // You could expand this list based on the user's needs.

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
        finalMessage += `Officiant: ${targetQueueItem.parsedRoles.get('Opening Song')}\n`;
        finalMessage += `Opening Song:\n${submission.partsReceived.get('Opening Song')}\n\n`;
      }

      if (submission.partsReceived.has('Song Leader')) {
        finalMessage += `Officiant: ${targetQueueItem.parsedRoles.get('Song Leader')}\n`;
        finalMessage += `${submission.partsReceived.get('Song Leader')}\n`;
      }

      // Trigger the github action (we can reuse the automationScheduler trigger)
      const automationScheduler = require('../services/automationScheduler');
      // For this, we might need a direct way to trigger GitHub Action with a custom payload
      // But for now, we can just hit the API ourselves or trigger a custom dispatch
      
      const owner = 'd0ul0s';
      const repo = 'Residential-Proxy-Method';
      
      await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${targetSchedule.githubFileName}/dispatches`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_PAT}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: {
            dynamic_message: finalMessage,
            code_message: "",
            reminder_tasks: "[]"
          }
        })
      });
    }

    res.status(200).json({ success: true, isComplete: submission.isComplete });

  } catch (error) {
    console.error('[Submissions API] Error:', error);
    res.status(500).json({ error: 'Server error processing submission' });
  }
});

module.exports = router;
