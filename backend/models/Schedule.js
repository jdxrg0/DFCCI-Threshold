const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  scheduleName: {
    type: String,
    required: true,
    trim: true
  },
  cronTime: {
    type: String,
    required: true,
  },
  codeCronTime: {
    type: String,
    default: ''
  },
  enableCodeBroadcast: {
    type: Boolean,
    default: false
  },
  codeTemplate: {
    type: String,
    default: ''
  },
  chatUrl: {
    type: String,
    required: false,
    default: ''
  },
  targetRole: {
    type: String,
    default: ''
  },
  message: {
    type: String,
    required: true,
  },
  githubFileName: {
    type: String,
    required: true,
  },
  githubFileSha: {
    type: String,
    required: true,
  },
  messageQueue: [{
    targetDate: String, // format YYYY-MM-DD
    messageText: String,
    overrideChatUrl: String,
    isSent: { type: Boolean, default: false },
    parsedRoles: { type: Map, of: String },
    weeklyConfirmationCode: String
  }],
  roleReminders: [{
    role: String,
    daysPrior: [Number],
    messageTemplate: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
