const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth, requireRole, requireVerified } = require('../middleware/authMiddleware');

// Get all users (Admin only)
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const users = await User.find({}).select('-password');
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign/remove COUNSELOR role (Admin only)
router.put('/:id/role', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { role } = req.body;
    
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (!['MEMBER', 'COUNSELOR', 'ADMIN'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.role = role;
    await user.save();

    res.json({ message: `User role updated to ${role}`, user: { _id: user._id, displayName: user.displayName, role: user.role } });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all verified members for selection (Authenticated, Verified MEMBER or above)
router.get('/members', requireAuth, requireVerified, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true,
      role: { $ne: 'ADMIN' }
    })
    .select('_id displayName role')
    .sort({ displayName: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by display name (Authenticated, Verified MEMBER or above)
router.get('/search', requireAuth, requireVerified, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      displayName: { $regex: q, $options: 'i' },
      _id: { $ne: req.user._id } // exclude current user
    })
    .select('_id displayName role')
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
