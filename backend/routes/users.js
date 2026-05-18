const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const User = require('../models/User');
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
