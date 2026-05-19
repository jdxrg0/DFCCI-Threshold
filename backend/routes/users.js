const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Affirmation = require('../models/Affirmation');
const Transaction = require('../models/Transaction');
const Devotional = require('../models/Devotional');
const { requireAuth, requireRole, requireVerified } = require('../middleware/authMiddleware');
const { cloudinary } = require('../utils/cloudinary');
const sendEmail = require('../utils/sendEmail');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    return {
      folder: 'profile_pictures',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }],
      public_id: `profile-${req.user._id}-${uniqueSuffix}`,
    };
  },
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

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
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile name & profile picture (Authenticated user)
router.put('/me/update-profile', requireAuth, uploadProfile.single('profilePicture'), async (req, res) => {
  try {
    const { displayName, presetAvatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (displayName !== undefined) {
      if (displayName.trim() === '') {
        return res.status(400).json({ message: 'Display name cannot be empty' });
      }
      user.displayName = displayName.trim();
      user.nameChangeRequested = false;
    }

    if (req.file) {
      if (user.profilePictureCloudinaryId) {
        try {
          await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
      user.profilePicture = req.file.path;
      user.profilePictureCloudinaryId = req.file.filename;
    } else if (presetAvatar !== undefined) {
      if (user.profilePictureCloudinaryId) {
        try {
          await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
      user.profilePicture = presetAvatar;
      user.profilePictureCloudinaryId = '';
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// Update email (Authenticated user - triggers verification code to new email)
router.put('/me/update-email', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || email.trim() === '') {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'This email is already taken by another user.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email === normalizedEmail) {
      return res.status(400).json({ message: 'This is already your current email address.' });
    }

    // Generate 6-digit verification code and save it
    const otp = generateOTP();
    user.pendingEmail = normalizedEmail;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Send code to the NEW email address
    await sendEmail(
      normalizedEmail,
      'Verify Your New Email Address - DFCCI Threshold',
      `<h3>Email Verification Code</h3>
       <p>You requested to change your email to this address on your DFCCI Threshold account.</p>
       <p>Your 6-digit verification code is: <strong>${otp}</strong></p>
       <p>This code will expire in 15 minutes.</p>
       <p>If you did not request this change, please ignore this email.</p>`
    );

    res.json({
      requiresVerification: true,
      pendingEmail: normalizedEmail,
      message: 'A verification code has been sent to your new email. Please verify to complete the update.',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        pendingEmail: user.pendingEmail
      }
    });
  } catch (error) {
    console.error('Error initiating email update:', error);
    res.status(500).json({ message: 'Server error while initiating email update' });
  }
});

// Verify Email Verification Code (Authenticated user)
router.post('/me/verify-email-otp', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ message: 'No pending email update found.' });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Double check unique constraint one last time
    const existingUser = await User.findOne({ email: user.pendingEmail });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'This email is already taken by another user.' });
    }

    // Finalize update
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      message: 'Email updated successfully!',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    res.status(500).json({ message: 'Server error while verifying email verification code' });
  }
});

// Resend Email Verification Code (Authenticated user)
router.post('/me/resend-email-otp', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ message: 'No pending email update found.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    await sendEmail(
      user.pendingEmail,
      'Verify Your New Email Address - DFCCI Threshold',
      `<h3>New Email Verification Code</h3>
       <p>You requested to change your email to this address on your DFCCI Threshold account.</p>
       <p>Your new 6-digit verification code is: <strong>${otp}</strong></p>
       <p>This code will expire in 15 minutes.</p>
       <p>If you did not request this change, please ignore this email.</p>`
    );

    res.json({ message: 'A new verification code has been sent to your pending email address.' });
  } catch (error) {
    console.error('Error resending email OTP:', error);
    res.status(500).json({ message: 'Server error while resending verification code' });
  }
});

// Cancel Pending Email Update (Authenticated user)
router.post('/me/cancel-email-update', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.pendingEmail = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      message: 'Email update request cancelled successfully.',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        pendingEmail: undefined
      }
    });
  } catch (error) {
    console.error('Error cancelling email update:', error);
    res.status(500).json({ message: 'Server error while cancelling email update' });
  }
});

// Update password (Authenticated user)
router.put('/me/update-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.trim() === '') {
      return res.status(400).json({ message: 'New password is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error while updating password' });
  }
});

// Remove profile picture (Authenticated user)
router.delete('/me/remove-profile-picture', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profilePictureCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
      } catch (err) {
        console.error('Failed to delete profile picture from Cloudinary:', err);
      }
    }

    user.profilePicture = '';
    user.profilePictureCloudinaryId = '';
    await user.save();

    res.json({
      message: 'Profile picture removed successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({ message: 'Server error while removing profile picture' });
  }
});

// ─── Dashboard Stats (Authenticated, Verified) ─────────────────────────────
router.get('/me/dashboard-stats', requireAuth, requireVerified, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Active Gentle Mirrors (threads where user is sender or receiver and not resolved)
    const activeMirrors = await Thread.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $ne: 'Resolved' },
      deletedAt: null,
    });

    // 2. Received Shining Lights (affirmations where user is receiver)
    const receivedLights = await Affirmation.countDocuments({
      receiver: userId,
    });

    // 3. Global Youth Fund Balance
    const incomeAgg = await Transaction.aggregate([
      { $match: { type: 'INCOME' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const expenseAgg = await Transaction.aggregate([
      { $match: { type: 'EXPENSE' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const fundBalance = totalIncome - totalExpense;

    // 4. Devotional Day Streak
    const devotionals = await Devotional.find({ member: userId })
      .sort({ date: -1 })
      .select('date')
      .lean();

    let devotionStreak = 0;
    if (devotionals.length > 0) {
      const dateSet = new Set(
        devotionals.map((d) => {
          const dt = new Date(d.date);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        })
      );

      const today = new Date();
      // Start from today or yesterday (if no entry today yet, the streak still counts)
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      let cursor = new Date(today);
      if (!dateSet.has(todayStr)) {
        cursor.setDate(cursor.getDate() - 1);
      }

      for (let i = 0; i < 400; i++) {
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        if (dateSet.has(key)) {
          devotionStreak++;
          cursor.setDate(cursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    res.json({ activeMirrors, receivedLights, fundBalance, devotionStreak });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
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

// Get platform limits & usage stats (Admin only)
router.get('/admin/platform-limits', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const mongoose = require('mongoose');
    const EmailLog = require('../models/EmailLog');

    // 1. Fetch MongoDB statistics
    let dbStats = { dataSize: 0, storageSize: 0, collectionsCount: 0, objectsCount: 0 };
    let collectionsList = [];

    try {
      if (mongoose.connection.readyState === 1) {
        const stats = await mongoose.connection.db.command({ dbStats: 1 });
        dbStats = {
          dataSize: stats.dataSize || 0,
          storageSize: stats.storageSize || 0,
          collectionsCount: stats.collections || 0,
          objectsCount: stats.objects || 0
        };

        // Query individual collection stats
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
          if (col.type && col.type !== 'collection') continue;
          try {
            const colStats = await mongoose.connection.db.command({ collStats: col.name });
            collectionsList.push({
              name: col.name,
              count: colStats.count || 0,
              size: colStats.size || 0,
              storageSize: colStats.storageSize || 0
            });
          } catch (colErr) {
            console.error(`Error fetching stats for collection ${col.name}:`, colErr);
            // Fallback: count documents using collection countDocuments
            try {
              const count = await mongoose.connection.db.collection(col.name).countDocuments();
              collectionsList.push({
                name: col.name,
                count: count,
                size: 0,
                storageSize: 0
              });
            } catch (_) {}
          }
        }
        // Sort collections by size descending, then count descending
        collectionsList.sort((a, b) => (b.size || b.count) - (a.size || a.count));
      }
    } catch (dbErr) {
      console.error('Error fetching MongoDB stats:', dbErr);
    }

    // 2. Fetch Email daily usage stats (Gmail free tier limits to 500 emails/day)
    let emailStats = { sentLast24h: 0, limit: 500 };
    try {
      const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sentCount = await EmailLog.countDocuments({
        status: 'sent',
        sentAt: { $gte: past24Hours }
      });
      emailStats.sentLast24h = sentCount;
    } catch (emailErr) {
      console.error('Error fetching EmailLog stats:', emailErr);
    }

    // 3. Fetch Cloudinary usage statistics
    let cloudinaryStats = null;
    try {
      const usage = await cloudinary.api.usage();
      if (usage) {
        cloudinaryStats = {
          plan: usage.plan || 'Free',
          lastUpdated: usage.last_updated || new Date().toISOString(),
          credits: usage.credits ? { usage: usage.credits.usage, limit: usage.credits.limit, usedPercent: usage.credits.used_percent } : null,
          transformations: usage.transformations ? { 
            usage: usage.transformations.usage, 
            limit: usage.transformations.limit || 25000, 
            usedPercent: usage.transformations.used_percent !== undefined ? usage.transformations.used_percent : ((usage.transformations.usage / 25000) * 100) 
          } : null,
          storage: usage.storage ? { 
            usage: usage.storage.usage, 
            limit: usage.storage.limit || (25 * 1024 * 1024 * 1024), 
            usedPercent: usage.storage.used_percent !== undefined ? usage.storage.used_percent : ((usage.storage.usage / (25 * 1024 * 1024 * 1024)) * 100) 
          } : null,
          bandwidth: usage.bandwidth ? { 
            usage: usage.bandwidth.usage, 
            limit: usage.bandwidth.limit || (25 * 1024 * 1024 * 1024), 
            usedPercent: usage.bandwidth.used_percent !== undefined ? usage.bandwidth.used_percent : ((usage.bandwidth.usage / (25 * 1024 * 1024 * 1024)) * 100) 
          } : null
        };
      }
    } catch (cloudinaryErr) {
      console.error('Error fetching Cloudinary usage stats:', cloudinaryErr.message);
    }

    res.json({
      success: true,
      database: {
        ...dbStats,
        collections: collectionsList,
        limitBytes: 512 * 1024 * 1024 // 512 MB Hobby Limit
      },
      emails: emailStats,
      cloudinary: cloudinaryStats
    });
  } catch (error) {
    console.error('Error fetching platform limits:', error);
    res.status(500).json({ message: 'Server error fetching platform limits' });
  }
});

module.exports = router;
