const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const PendingUser = require('../models/PendingUser');
const sendEmail = require('../utils/sendEmail');
const { requireAuth } = require('../middleware/authMiddleware');
const { loginLimiter, otpVerifyLimiter, emailSendLimiter } = require('../middleware/rateLimiters');
const { safeEqualNum } = require('../utils/timingSafe');
const { validatePassword } = require('../utils/passwordPolicy');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Signed with the configured secret only — never a fallback. The server
// refuses to boot without JWT_SECRET, so a missing value is a boot-time
// failure, not a silently downgraded signature.
const JWT_SECRET = process.env.JWT_SECRET;

// Map to track resend-otp rate limits (email -> timestamp)
const resendRateLimits = new Map();

// Per-email OTP attempt tracking (flow + email -> { count, windowStart }).
// The IP-relevant work is done by otpVerifyLimiter; this layer stops a fast
// attacker from rotating IPs to brute-force one victim's six-digit code, and
// from hammering reset-password once the code is known to exist.
const OTP_ATTEMPT_WINDOW = 15 * 60 * 1000; // matches the code lifetime
const OTP_ATTEMPT_MAX = 10;
const otpAttempts = new Map();

const otpLocked = (flow, email) => {
  const entry = otpAttempts.get(`${flow}:${email}`);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > OTP_ATTEMPT_WINDOW) {
    otpAttempts.delete(`${flow}:${email}`);
    return false;
  }
  return entry.count >= OTP_ATTEMPT_MAX;
};

const registerOtpFailure = (flow, email) => {
  const key = `${flow}:${email}`;
  const entry = otpAttempts.get(key);
  if (!entry || Date.now() - entry.windowStart > OTP_ATTEMPT_WINDOW) {
    otpAttempts.set(key, { count: 1, windowStart: Date.now() });
  } else {
    entry.count += 1;
  }

  // Prune stale entries so the map cannot grow without bound.
  if (otpAttempts.size > 5000) {
    const cutoff = Date.now() - OTP_ATTEMPT_WINDOW;
    for (const [key, entry] of otpAttempts) {
      if (entry.windowStart < cutoff) otpAttempts.delete(key);
    }
  }
};

const clearOtpAttempts = (flow, email) => {
  otpAttempts.delete(`${flow}:${email}`);
};

// Per-account login failure tracking. loginLimiter already caps attempts by
// IP; this layer prevents a distributed attacker from rotating IPs to guess
// one victim's password, and protects the unverified-member paths above /
// before the bcrypt.compare call.
const LOGIN_ATTEMPT_WINDOW = 15 * 60 * 1000;
const LOGIN_ATTEMPT_MAX = 5;
const loginAttempts = new Map();

const loginLocked = (email) => {
  const entry = loginAttempts.get(email);
  if (!entry) return false;
  if (Date.now() - entry.windowStart > LOGIN_ATTEMPT_WINDOW) {
    loginAttempts.delete(email);
    return false;
  }
  return entry.count >= LOGIN_ATTEMPT_MAX;
};

const registerLoginFailure = (email) => {
  const entry = loginAttempts.get(email);
  if (!entry || Date.now() - entry.windowStart > LOGIN_ATTEMPT_WINDOW) {
    loginAttempts.set(email, { count: 1, windowStart: Date.now() });
  } else {
    entry.count += 1;
  }
  if (loginAttempts.size > 5000) {
    const cutoff = Date.now() - LOGIN_ATTEMPT_WINDOW;
    for (const [key, entry] of loginAttempts) {
      if (entry.windowStart < cutoff) loginAttempts.delete(key);
    }
  }
};

const clearLoginAttempts = (email) => {
  loginAttempts.delete(email);
};

router.post('/signup', emailSendLimiter, async (req, res) => {
  try {
    const { displayName, email, password } = req.body;

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

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

router.post('/verify-otp', otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }
    if (otpLocked('verify', normalizedEmail)) {
      return res.status(429).json({ message: 'Too many verification attempts. Try again in 15 minutes.' });
    }

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });

    if (!pendingUser) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        // An admin can re-issue an OTP straight onto an existing unverified row, which leaves
        // no PendingUser to match. A pendingEmail code belongs to the email-change flow, so it
        // must never be redeemable as a signup verification.
        if (
          !existingUser.isVerified &&
          !existingUser.pendingEmail &&
          existingUser.otp &&
          safeEqualNum(existingUser.otp, otp) &&
          existingUser.otpExpires &&
          existingUser.otpExpires > Date.now()
        ) {
          existingUser.isVerified = true;
          existingUser.otp = undefined;
          existingUser.otpExpires = undefined;
          await existingUser.save();

          clearOtpAttempts('verify', normalizedEmail);
          return res.json({ message: 'Account verified successfully. You can now log in.' });
        }
        registerOtpFailure('verify', normalizedEmail);
        return res.status(400).json({ message: 'User is already verified' });
      }
      return res.status(404).json({ message: 'Pending registration not found or expired. Please sign up again.' });
    }

    if (!safeEqualNum(pendingUser.otp, otp)) {
      registerOtpFailure('verify', normalizedEmail);
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
    await PendingUser.deleteOne({ email: normalizedEmail });
    clearOtpAttempts('verify', normalizedEmail);

    res.json({ message: 'Account verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ message: 'Server error during OTP verification' });
  }
});

router.post('/resend-otp', emailSendLimiter, async (req, res) => {
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

    // Prune stale entries so the map cannot grow without bound. Entries warm
    // for one rate-limit window, then drop away.
    if (resendRateLimits.size > 1000) {
      const cutoff = Date.now() - 60000;
      for (const [key, sentAt] of resendRateLimits) {
        if (sentAt < cutoff) resendRateLimits.delete(key);
      }
    }

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

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ message: 'Email is required' });
    }

    if (loginLocked(normalizedEmail)) {
      return res.status(429).json({ message: 'Too many failed attempts. Try again in 15 minutes.' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      registerLoginFailure(normalizedEmail);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Please verify your email before logging in.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      registerLoginFailure(normalizedEmail);
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    clearLoginAttempts(normalizedEmail);

    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server error' });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Logged in successfully',
      token, // Send token in body for mobile/Vercel support
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires,
        hasPassword: true
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.post('/google', loginLimiter, async (req, res) => {
  try {
    const { credential, confirmedName } = req.body;
    
    // Fallback audience is fine if env not set immediately, but recommend setting GOOGLE_CLIENT_ID
    const audience = process.env.GOOGLE_CLIENT_ID || undefined;
    
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: audience,
    });
    
    const payload = ticket.getPayload();
    const { email, name, sub: googleId } = payload;

    let user = await User.findOne({ email });

    if (!user) {
      if (!confirmedName) {
        return res.json({ requireNameConfirmation: true, googleName: name, email, credential });
      }
      user = new User({
        displayName: confirmedName,
        email: email,
        googleId: googleId,
        isVerified: true
      });
      await user.save();
    } else if (!user.googleId) {
      // Link Google account to existing user
      user.googleId = googleId;
      if (!user.isVerified) {
        user.isVerified = true;
      }
      await user.save();
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ message: 'Server error' });
    }
    const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Logged in successfully with Google',
      token, // Send token in body for mobile/Vercel support
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires,
        hasPassword: !!user.password
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ message: 'Google authentication failed' });
  }
});

router.post('/forgot-password', emailSendLimiter, async (req, res) => {
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

router.post('/reset-password', otpVerifyLimiter, async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) return res.status(400).json({ message: 'Email is required' });
    if (!newPassword || String(newPassword).trim() === '') {
      return res.status(400).json({ message: 'New password is required' });
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }
    if (otpLocked('reset', normalizedEmail)) {
      return res.status(429).json({ message: 'Too many reset attempts. Try again in 15 minutes.' });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (!user.otp) return res.status(400).json({ message: 'Invalid reset code.' });
    if (!safeEqualNum(user.otp, otp)) {
      registerOtpFailure('reset', normalizedEmail);
      return res.status(400).json({ message: 'Invalid reset code.' });
    }
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'Reset code has expired. Please request a new one.' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    clearOtpAttempts('reset', normalizedEmail);
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

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('password');
    const hasPassword = !!(user && user.password);

    res.json({
      user: {
        _id: req.user._id,
        displayName: req.user.displayName,
        role: req.user.role,
        email: req.user.email,
        nameChangeRequested: req.user.nameChangeRequested,
        profilePicture: req.user.profilePicture,
        customDatePowerExpires: req.user.customDatePowerExpires,
        hasPassword: hasPassword,
        pendingEmail: req.user.pendingEmail
      }
    });
  } catch (error) {
    console.error('Error in /me:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
