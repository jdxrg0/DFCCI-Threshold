const mongoose = require('mongoose');

const duesMemberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  linkedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

// Roster list and ledger grid: find({ isActive: true }).sort({ name: 1 })
duesMemberSchema.index({ isActive: 1, name: 1 });

// Arrears lookup by linked account, once per subscribed user in the reminder run.
duesMemberSchema.index({ linkedUser: 1 });

module.exports = mongoose.model('DuesMember', duesMemberSchema);
