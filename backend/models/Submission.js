const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
  referenceCode: {
    type: String,
    required: true,
    index: true
  },
  scheduleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule',
    required: true
  },
  partsReceived: {
    type: Map,
    of: String // e.g., 'Song Leader' -> 'Praise: ... Worship: ...'
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Submission', submissionSchema);
