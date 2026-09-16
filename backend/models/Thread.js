const mongoose = require('mongoose');
const appEmitter = require('../utils/eventEmitter');

const messageSchema = new mongoose.Schema({
  authorType: {
    type: String,
    enum: ['Sender', 'Receiver'],
    required: true,
  },
  isInitial: {
    type: Boolean,
    default: false,
  },
  content: {
    concern: { type: String },
    impact: { type: String },
    desiredChange: { type: String },
    clarification: { type: String },
    feelings: { type: String },
    acknowledgment: { type: String },
    hopedUnderstanding: { type: String },
    bibleVerse: { type: String },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  readAt: {
    type: Date,
    default: null,
  },
});

const threadSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['Active', 'Accepted', 'Escalated', 'Resolved'],
    default: 'Active',
  },
  senderRepliesUsed: {
    type: Number,
    default: 0,
    max: 3,
  },
  receiverRepliesUsed: {
    type: Number,
    default: 0,
    max: 3,
  },
  resolvedAt: {
    type: Date,
  },
  acceptedAt: {
    type: Date,
  },
  counselorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  earlyEscalationRequestedBy: {
    type: String,
    enum: ['Sender', 'Receiver', null],
    default: null,
  },
  messages: [messageSchema],
  earlyEscalationSenderConsent: {
    type: String,
    enum: ['Pending', 'Approved', 'Declined', 'None'],
    default: 'None',
  },
  earlyEscalationReceiverConsent: {
    type: String,
    enum: ['Pending', 'Approved', 'Declined', 'None'],
    default: 'None',
  },
  counselorConsentSender: {
    type: String,
    enum: ['Pending', 'Approved', 'Declined', 'None'],
    default: 'None',
  },
  counselorConsentReceiver: {
    type: String,
    enum: ['Pending', 'Approved', 'Declined', 'None'],
    default: 'None',
  },
  escalationRequestCount: {
    type: Number,
    default: 0,
  },
  escalationDeclinedCount: {
    type: Number,
    default: 0,
  },
  deletionRequestStatus: {
    type: String,
    enum: ['None', 'Pending', 'Approved', 'Rejected'],
    default: 'None',
  },
  deletionRequestedAt: {
    type: Date,
  },
  restoreRequestStatus: {
    type: String,
    enum: ['None', 'Pending', 'Approved', 'Rejected'],
    default: 'None',
  },
  lastRestoredAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

threadSchema.index({ deletedAt: 1 }, { expireAfterSeconds: 5184000 }); // 60 days in seconds

// Every user-facing list is filtered by party + deletedAt:null, and the admin
// escalated list by status + deletedAt:null. The TTL index alone (deletedAt)
// cannot serve those.
threadSchema.index({ sender: 1, deletedAt: 1 });
threadSchema.index({ receiver: 1, deletedAt: 1 });
threadSchema.index({ status: 1, deletedAt: 1 });

threadSchema.post('save', function(doc) {
  appEmitter.emit(`threadUpdate_${doc._id.toString()}`);
});

module.exports = mongoose.model('Thread', threadSchema);
