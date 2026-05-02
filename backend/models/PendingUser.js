const mongoose = require('mongoose');

const pendingUserSchema = new mongoose.Schema({
  displayName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  otp: { type: String, required: true },
  otpExpires: { type: Date, required: true },
  createdAt: { type: Date, expires: '15m', default: Date.now }
});

module.exports = mongoose.model('PendingUser', pendingUserSchema);
