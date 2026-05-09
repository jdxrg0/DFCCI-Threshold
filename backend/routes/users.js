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

// Assign/remove roles (Admin only)
router.put('/:id/role', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { role } = req.body;
    
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (!['MEMBER', 'COUNSELOR', 'ADMIN', 'YOUTH_TREASURER'].includes(role)) {
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

// Toggle dues reminders subscription (Admin only)
router.put('/:id/toggle-reminders', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.subscribedToDuesReminders = !user.subscribedToDuesReminders;
    await user.save();

    res.json({ 
      message: `Dues reminders ${user.subscribedToDuesReminders ? 'enabled' : 'disabled'} for ${user.displayName}`,
      subscribedToDuesReminders: user.subscribedToDuesReminders 
    });
  } catch (error) {
    console.error('Error toggling reminders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request Name Change (Admin only)
router.put('/:id/request-name-change', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.nameChangeRequested = !user.nameChangeRequested;
    await user.save();

    res.json({ 
      message: `Name change request ${user.nameChangeRequested ? 'sent to' : 'revoked for'} ${user.displayName}`,
      nameChangeRequested: user.nameChangeRequested 
    });
  } catch (error) {
    console.error('Error toggling name change request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update own name (Authenticated user)
router.put('/me/update-name', requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim() === '') {
      return res.status(400).json({ message: 'Display name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.displayName = displayName.trim();
    user.nameChangeRequested = false;
    await user.save();

    res.json({ 
      message: 'Name updated successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested
      }
    });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all verified members for selection (Authenticated, Verified MEMBER or above)
router.get('/members', requireAuth, requireVerified, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true
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
    })
    .select('_id displayName role')
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete yourself.' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
