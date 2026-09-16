const rateLimit = require('express-rate-limit');

// A single IP should never need to touch the API more than this in a window.
// The per-route limiters below do the real work; this is just the backstop
// that keeps a firehose from reaching the database at all.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again in a minute.' },
});

// OTP verification is brute-forceable: six digits, no rate limit lets an
// attacker walk the whole space inside the 15-minute code lifetime.
const otpVerifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please try again in a minute.' },
});

// Signup, resend-otp and forgot-password all hand the attacker an email send,
// so they get the tightest window: five per IP per hour.
const emailSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again in an hour.' },
});

module.exports = { apiLimiter, loginLimiter, otpVerifyLimiter, emailSendLimiter };