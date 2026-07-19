const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const Member = require('../models/Member');

// Apply auth and admin role check to all member routes
router.use(requireAuth);
router.use(requireRole(['ADMIN']));

// GET /api/members
router.get('/', async (req, res) => {
  try {
    const members = await Member.find().sort({ name: 1 });
    res.json(members);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/members
router.post('/', async (req, res) => {
  try {
    const { name, facebookChatUrl } = req.body;
    let member = await Member.findOne({ name });
    if (member) return res.status(400).json({ msg: 'Member already exists' });

    member = new Member({ name, facebookChatUrl });
    await member.save();
    res.json(member);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// PUT /api/members/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, facebookChatUrl } = req.body;
    const member = await Member.findByIdAndUpdate(req.params.id, { name, facebookChatUrl }, { new: true });
    res.json(member);
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

// DELETE /api/members/:id
router.delete('/:id', async (req, res) => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Member deleted' });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
