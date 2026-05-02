const mongoose = require('mongoose');

const affirmationSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  topic: {
    type: String,
    trim: true,
    maxlength: 80,
    default: '',
  },
  // The four-part affirmation content (sent by sender)
  content: {
    appreciation: { type: String, required: true },
    impact:       { type: String, required: true },
    encouragement:{ type: String, required: true },
    bibleVerse:   { type: String, required: true },
  },
  // One optional thank-you reply from the receiver
  reply: {
    text:      { type: String, default: '' },
    sentAt:    { type: Date, default: null },
  },
  status: {
    type: String,
    enum: ['Active', 'Received'],
    default: 'Active',
  },
  receivedAt: {
    type: Date,
    default: null,
  },
  // Tracks whether the receiver has opened the affirmation
  readAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

module.exports = mongoose.model('Affirmation', affirmationSchema);
