// Ledger-side audit trail: who changed the money, and what they changed.
//
// Separate from utils/auditLog.js on purpose. That module records ADMIN actions
// (role changes, deletions, thread moderation) into AdminAudit and is keyed by a
// fixed AUDIT_ACTIONS enum. This one records TRANSACTION mutations into AuditLog
// with a field-level diff. Different shape, different collection, different
// audience — keeping them apart stops either from having to grow a mode flag.

const AuditLog = require('../models/AuditLog');

// Fields worth recording a change for. Deliberately excludes createdBy and the
// timestamps, which are noise, and receiptCloudinaryId, which always moves in
// lockstep with receiptUrl.
const TRACKED = ['amount', 'type', 'category', 'description', 'date', 'designatedFund', 'receiptUrl'];

function normalise(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  // ObjectIds and anything else with a meaningful toString
  if (typeof value === 'object' && typeof value.toString === 'function') return value.toString();
  return value;
}

/**
 * Compare two plain transaction objects and return only what actually moved.
 * Both sides are normalised first so an ObjectId and its string form, or two
 * equal Dates, do not read as a change.
 */
function diffTransaction(before, after) {
  const changes = [];
  for (const field of TRACKED) {
    const from = normalise(before?.[field]);
    const to = normalise(after?.[field]);
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

function describe(tx) {
  if (!tx) return '';
  const sign = tx.type === 'INCOME' ? '+' : '-';
  return `${tx.category || 'Uncategorised'} ${sign}${Number(tx.amount || 0).toLocaleString('en-PH')}`;
}

/**
 * Write one audit row. Never throws: an audit failure must not take down the
 * financial write it is describing. Note that the two writes are not atomic —
 * this repo has no transactions/sessions — so a crash between them loses the
 * entry. Do not promise users a tamper-proof record.
 */
async function recordFundAudit({ req, action, entityId, entity = 'TRANSACTION', changes = [], label = '', amount, note = '', actorName, actorRole }) {
  try {
    await AuditLog.create({
      entity,
      entityId,
      action,
      actor: req?.user?._id,
      actorName: actorName || req?.user?.displayName || 'Unknown',
      actorRole: actorRole || req?.user?.role || '',
      label,
      changes,
      amount,
      note,
    });
  } catch (err) {
    console.error('Failed to write fund audit entry:', err.message);
  }
}

module.exports = { recordFundAudit, diffTransaction, describe, TRACKED };
