const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const sendEmail = require('../utils/sendEmail');
const { requireAuth } = require('../middleware/authMiddleware');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Map to track resend-otp rate limits (email -> timestamp)
const resendRateLimits = new Map();

router.post('/signup', async (req, res) => {
  try {
    const { displayName, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await PendingUser.findOneAndUpdate(
      { email },
      { displayName, email, password: hashedPassword, otp, otpExpires, createdAt: Date.now() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send email asynchronously in the background so the user doesn't wait
    sendEmail(
      email, 
      'Your DFCCI Threshold Verification Code', 
      `<p>Your verification code is: <strong>${otp}</strong></p><p>It will expire in 15 minutes.</p>`
    );

    res.status(201).json({ message: 'Registration successful. Please check your email for the OTP.' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    const pendingUser = await PendingUser.findOne({ email });

    if (!pendingUser) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User is already verified' });
      }
      return res.status(404).json({ message: 'Pending registration not found or expired. Please sign up again.' });
    }

    if (pendingUser.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (pendingUser.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Your verification code has expired. Please request a new one.' });
    }

    const user = new User({
      displayName: pendingUser.displayName,
      email: pendingUser.email,
      password: pendingUser.password,
      isVerified: true
    });
    
    await user.save();
    await PendingUser.deleteOne({ email });

    res.json({ message: 'Account verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Rate limit: 1 per 60 seconds
    const lastSent = resendRateLimits.get(email);
    if (lastSent && Date.now() - lastSent < 60000) {
      return res.status(429).json({ message: 'Please wait a minute before requesting another code.' });
    }

    const pendingUser = await PendingUser.findOne({ email });
    
    if (!pendingUser) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User is already verified' });
      }
      return res.status(404).json({ message: 'Pending registration not found. Please sign up again.' });
    }

    const newOtp = generateOTP();
    pendingUser.otp = newOtp;
    pendingUser.otpExpires = new Date(Date.now() + 15 * 60 * 1000);
    pendingUser.createdAt = Date.now();
    await pendingUser.save();

    resendRateLimits.set(email, Date.now());

    // Send email asynchronously
    sendEmail(
      email, 
      'Your New DFCCI Threshold Verification Code', 
      `<p>Your new verification code is: <strong>${newOtp}</strong></p><p>It will expire in 15 minutes.</p>`
    );

    res.json({ message: 'A new verification code has been sent to your email.' });
  } catch (error) {
    console.error('Resend OTP error:', error);
    res.status(500).json({ message: 'Server error while resending OTP' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Logged in successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email // sending email to frontend helps with logic but UI must hide it
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Always respond generically to avoid email enumeration
    if (!user || !user.isVerified) {
      return res.json({ message: 'If an account with that email exists, a reset code has been sent.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // Send email asynchronously
    sendEmail(
      email,
      'DFCCI Threshold — Password Reset Code',
      `<p>You requested a password reset.</p>
       <p>Your reset code is: <strong>${otp}</strong></p>
       <p>It will expire in 15 minutes. If you did not request this, please ignore this email.</p>`
    );

    res.json({ message: 'If an account with that email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (!user.otp || user.otp !== otp) return res.status(400).json({ message: 'Invalid reset code.' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  });
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      _id: req.user._id,
      displayName: req.user.displayName,
      role: req.user.role,
      email: req.user.email
    }
  });
});

module.exports = router;
