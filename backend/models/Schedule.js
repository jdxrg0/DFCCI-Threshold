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
    role: { type: String, required: true, trim: true },
    daysPrior: {
      type: [Number],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0 &&
          v.every(n => Number.isInteger(n) && n >= 0 && n <= 28),
        message: 'daysPrior must be a non-empty list of whole days between 0 and 28'
      }
    },
    messageTemplate: { type: String, required: true, trim: true }
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
    recipients: Number,
    ghWorkflowFile: String,
    ghDispatchedAt: Date,
    ghRunId: Number,
    ghRunUrl: String,
    ghRunStatus: String,
    ghRunConclusion: String,
    // No default here: a default on a nested path makes Mongoose materialise the
    // parent, so every schedule that had never run came back with a truthy
    // lastRun and the dashboard rendered "Last run" with a blank date.
    ghLookupState: String
  },
  // Capped at the 25 most recent entries by the $slice in recordRun().
  // A dispatch only records that it fired and when, on GitHub's clock; the run
  // it produced is matched to the row later, on demand, so nothing on the live
  // dispatch path can fail because of run-link work.
  runHistory: [{
    at: { type: Date, default: Date.now },
    status: String,
    actionType: String,
    trigger: String,
    detail: String,
    recipients: Number,
    ghWorkflowFile: String,
    ghDispatchedAt: Date,
    ghRunId: Number,
    ghRunUrl: String,
    ghRunStatus: String,
    ghRunConclusion: String,
    ghLookupState: { type: String, default: 'none' }  // none | pending | resolved | not_found | unavailable
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Schedule = mongoose.model('Schedule', scheduleSchema);

/* A queue item's `parsedRoles` is a Mongoose Map when it comes off a document
   and a plain object when it comes off a lean query, so every reader outside
   the scheduler has to cope with both shapes too. */
const roleValue = (parsedRoles, role) => {
  if (!parsedRoles || !role) return undefined;
  if (typeof parsedRoles.get === 'function') return parsedRoles.get(role);
  return parsedRoles[role];
};

const roleKeys = (parsedRoles) => {
  if (!parsedRoles) return [];
  if (typeof parsedRoles.keys === 'function') return Array.from(parsedRoles.keys());
  return Object.keys(parsedRoles);
};

/* Confirmation tracking watches these roles, and one only counts as required
   when this week's lineup actually has somebody in it. Shared by the reader
   bot, the bot's report endpoint and the confirmations read so the three can
   never disagree about what "complete" means. */
const TRACKED_ROLES = ['Song Leader', 'Opening Song'];
const requiredRolesFor = (queueItem) =>
  TRACKED_ROLES.filter(role => roleValue(queueItem && queueItem.parsedRoles, role));

module.exports = Schedule;
module.exports.TRACKED_ROLES = TRACKED_ROLES;
module.exports.roleValue = roleValue;
module.exports.roleKeys = roleKeys;
module.exports.requiredRolesFor = requiredRolesFor;
