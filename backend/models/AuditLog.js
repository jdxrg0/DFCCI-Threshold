const mongoose = require('mongoose');

/**
 * Append-only record of who changed the money and what they changed.
 *
 * Scoped to fund transactions for now, but `entity` is here so the same
 * collection can cover designated funds or the roster later without a
 * migration.
 */
const auditLogSchema = new mongoose.Schema({
  entity: {
    type: String,
    enum: ['TRANSACTION', 'DESIGNATED_FUND', 'DUES_MEMBER'],
    default: 'TRANSACTION',
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    required: true,
  },
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // Denormalised on purpose. Users are hard-deletable (routes/users.js), and a
  // populate-only reference renders blank rows once a treasurer leaves — which
  // defeats the entire point of an audit trail.
  actorName: {
    type: String,
    default: 'Unknown',
  },
  actorRole: {
    type: String,
    default: '',
  },
  // Human-readable one-liner, so the feed stays useful even for entities that
  // no longer exist.
  label: {
    type: String,
    default: '',
  },
  // [{ field, from, to }] — only fields that actually changed.
  changes: [
    {
      _id: false,
      field: { type: String },
      from: { type: mongoose.Schema.Types.Mixed },
      to: { type: mongoose.Schema.Types.Mixed },
    },
  ],
  // Amount at the time of the event, so the feed can show money without
  // joining back to a possibly-deleted transaction.
  amount: {
    type: Number,
  },
  note: {
    type: String,
    default: '',
  },
}, { timestamps: true });

// The audit feed: newest first, optionally filtered to one record.
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

// Financial history is kept indefinitely. If retention is ever wanted, the TTL
// idiom used elsewhere in this repo is:
//   auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
