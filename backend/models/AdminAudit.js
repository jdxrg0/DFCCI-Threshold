// One row per completed admin mutation. Actor and target are denormalised on purpose: the
// commonest thing to audit is a deletion, and a log that goes blank once its subject is gone
// is no log at all.

const mongoose = require('mongoose');
const { AUDIT_ACTIONS } = require('../utils/auditLog');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const adminAuditSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  actorName: {
    type: String,
  },
  actorEmail: {
    type: String,
  },
  action: {
    type: String,
    required: true,
    enum: Object.values(AUDIT_ACTIONS),
  },
  targetType: {
    type: String,
    enum: ['USER', 'THREAD', 'TICKET', 'EMAIL', 'SYSTEM'],
    default: 'USER',
  },
  target: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  targetLabel: {
    type: String,
  },
  before: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  after: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  summary: {
    type: String,
    required: true,
  },
  ip: {
    type: String,
  },
  // TTL anchor. The platform sits on a 512 MB Mongo free tier and this collection only ever
  // grows, so entries are dropped a year after they are written rather than kept forever.
  expiresAt: {
    type: Date,
    index: { expires: 0 },
  },
}, { timestamps: true });

// Mongoose 9 dropped callback-style middleware, so this hook takes no `next`.
adminAuditSchema.pre('save', function () {
  if (!this.expiresAt) {
    const created = this.createdAt || new Date();
    this.expiresAt = new Date(created.getTime() + ONE_YEAR_MS);
  }
});

// The log is read three ways: newest first, filtered by admin, filtered by action.
adminAuditSchema.index({ createdAt: -1 });
adminAuditSchema.index({ actor: 1, createdAt: -1 });
adminAuditSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AdminAudit', adminAuditSchema);
