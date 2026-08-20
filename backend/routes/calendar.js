const express = require('express');
const router = express.Router();
const CalendarAssignment = require('../models/CalendarAssignment');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

// Every role-targeted schedule resolves against this calendar, and /clear
// empties it outright, so the whole router is admin-only. Both pages that read
// it — the Automation Hub and the Serving Calendar — are already admin views.
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// Get all calendar assignments (optionally filter by month/year in future)
router.get('/', async (req, res) => {
  try {
    const assignments = await CalendarAssignment.find().sort({ targetDate: 1 });
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching calendar assignments:', error);
    res.status(500).json({ error: 'Server error fetching assignments.' });
  }
});

// Update or create assignment for a specific date
router.put('/:targetDate', async (req, res) => {
  try {
    const { targetDate } = req.params;
    const { roles } = req.body; // Expects an object { "Presider": "Name", etc }

    if (!targetDate || !roles) {
      return res.status(400).json({ error: 'targetDate and roles are required.' });
    }

    const assignment = await CalendarAssignment.findOneAndUpdate(
      { targetDate },
      { $set: { roles } },
      { new: true, upsert: true }
    );

    res.json(assignment);
  } catch (error) {
    console.error('Error saving calendar assignment:', error);
    res.status(500).json({ error: 'Server error saving assignment.' });
  }
});

// Bulk populate assignments (e.g. from Excel)
router.post('/populate', async (req, res) => {
  try {
    const { assignments } = req.body; // Expects { "YYYY-MM-DD": { "Role": "Name" } }

    if (!assignments || typeof assignments !== 'object') {
      return res.status(400).json({ error: 'Invalid assignments format.' });
    }

    const bulkOps = Object.keys(assignments).map(dateKey => {
      return {
        updateOne: {
          filter: { targetDate: dateKey },
          update: { $set: { roles: assignments[dateKey] } },
          upsert: true
        }
      };
    });

    if (bulkOps.length > 0) {
      await CalendarAssignment.bulkWrite(bulkOps);
    }

    res.json({ message: `Successfully processed ${bulkOps.length} dates.` });
  } catch (error) {
    console.error('Error bulk populating assignments:', error);
    res.status(500).json({ error: 'Server error populating calendar.' });
  }
});

// Clear all calendar assignments
router.delete('/clear', async (req, res) => {
  try {
    await CalendarAssignment.deleteMany({});
    res.json({ message: 'Calendar cleared successfully.' });
  } catch (error) {
    console.error('Error clearing calendar:', error);
    res.status(500).json({ error: 'Server error clearing calendar.' });
  }
});

module.exports = router;
