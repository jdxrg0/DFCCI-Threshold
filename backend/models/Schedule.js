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
  advanceWeeks: {
    type: Number,
    default: 0
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
  // Paused schedules stay in the database and keep their GitHub workflow file,
  // but no cron timer is registered for them and manual runs are refused.
  isActive: {
    type: Boolean,
    default: true
  },
  // Denormalised copy of the newest runHistory entry so the dashboard can show
  // "last run" without pulling the whole history array.
  lastRun: {
    at: Date,
    status: String,        // success | skipped | error
    actionType: String,    // MAIN | REMINDER | CODE
    trigger: String,       // cron | manual
    detail: String,
    recipients: Number
  },
  // Capped at the 25 most recent entries by the $slice in recordRun().
  runHistory: [{
    at: { type: Date, default: Date.now },
    status: String,
    actionType: String,
    trigger: String,
    detail: String,
    recipients: Number
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Schedule', scheduleSchema);
