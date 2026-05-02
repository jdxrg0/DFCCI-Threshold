const express = require('express');
const router = express.Router();
const FruitEndorsement = require('../models/FruitEndorsement');
const { requireAuth } = require('../middleware/authMiddleware');

// POST /api/fruits/endorse
// Create or update an endorsement for a user
router.post('/endorse', requireAuth, async (req, res) => {
  try {
    const { endorseeId, fruits } = req.body;
    const endorserId = req.user.id;

    if (!endorseeId) {
      return res.status(400).json({ message: 'Endorsee ID is required' });
    }
    if (endorserId === endorseeId) {
      return res.status(400).json({ message: 'You cannot endorse yourself' });
    }

    // Upsert the endorsement
    const endorsement = await FruitEndorsement.findOneAndUpdate(
      { endorser: endorserId, endorsee: endorseeId },
      { fruits },
      { new: true, upsert: true }
    );

    res.json(endorsement);
  } catch (error) {
    console.error('Error endorsing user:', error);
    res.status(500).json({ message: 'Server error endorsing user' });
  }
});

// GET /api/fruits/me
// Get aggregated fruit counts for the current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const endorsements = await FruitEndorsement.find({ endorsee: req.user.id });
    
    // Aggregate fruits
    const fruitCounts = {
      'Love': 0, 'Joy': 0, 'Peace': 0, 'Patience': 0, 'Kindness': 0,
      'Goodness': 0, 'Faithfulness': 0, 'Gentleness': 0, 'Self-control': 0
    };

    endorsements.forEach(end => {
      end.fruits.forEach(fruit => {
        if (fruitCounts[fruit] !== undefined) {
          fruitCounts[fruit]++;
        }
      });
    });

    res.json(fruitCounts);
  } catch (error) {
    console.error('Error fetching my fruits:', error);
    res.status(500).json({ message: 'Server error fetching fruits' });
  }
});

// GET /api/fruits/given/:userId
// Get the current user's endorsement for a specific user
router.get('/given/:userId', requireAuth, async (req, res) => {
  try {
    const endorsement = await FruitEndorsement.findOne({
      endorser: req.user.id,
      endorsee: req.params.userId
    });
    res.json(endorsement ? endorsement.fruits : []);
  } catch (error) {
    console.error('Error fetching given endorsement:', error);
    res.status(500).json({ message: 'Server error fetching given endorsement' });
  }
});

module.exports = router;
