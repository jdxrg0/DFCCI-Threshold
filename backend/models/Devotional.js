const mongoose = require('mongoose');

const devotionalSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  book: {
    type: String,
    trim: true,
  },
  passage: {
    type: String,
    required: true,
    trim: true,
  },
  parsedPassages: {
    type: Map,
    of: [Number],
  },
  summary: {
    type: String,
    required: true,
    trim: true,
  },
  application: {
    type: String,
    required: true,
    trim: true,
  },
  prayerFocus: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['Submitted', 'Acknowledged'],
    default: 'Submitted',
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  acknowledgedAt: {
    type: Date,
    default: null,
  },
  leaderNote: {
    type: String,
    trim: true,
    default: '',
  },
}, { timestamps: true });

// Compound index: one entry per member per date
devotionalSchema.index({ member: 1, date: 1 });

module.exports = mongoose.model('Devotional', devotionalSchema);
