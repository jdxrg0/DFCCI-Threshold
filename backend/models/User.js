const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  displayName: {
    type: String,
    required: true,
  },
  profilePicture: {
    type: String,
    default: '',
  },
  profilePictureCloudinaryId: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
  },
  googleId: {
    type: String,
    sparse: true,
  },
  role: {
    type: String,
    enum: ['MEMBER', 'COUNSELOR', 'ADMIN', 'YOUTH_TREASURER'],
    default: 'MEMBER',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
  pendingEmail: {
    type: String,
    lowercase: true,
    trim: true,
  },
  subscribedToDuesReminders: {
    type: Boolean,
    default: false,
  },
  nameChangeRequested: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
