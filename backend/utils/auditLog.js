// Admin actions are irreversible from the member's point of view (a deleted user, a rejected
// restore) and we regularly get asked "who did this?". This is the one place that answers it.

const AUDIT_ACTIONS = Object.freeze({
  USER_ROLE_CHANGE: 'USER_ROLE_CHANGE',
  USER_DELETE: 'USER_DELETE',
  USER_VERIFY: 'USER_VERIFY',
  USER_UNVERIFY: 'USER_UNVERIFY',
  USER_OTP_RESEND: 'USER_OTP_RESEND',
  USER_REMINDERS_TOGGLE: 'USER_REMINDERS_TOGGLE',
  USER_RENAME_REQUEST: 'USER_RENAME_REQUEST',
  USER_DATE_POWER: 'USER_DATE_POWER',
  USER_BULK_ROLE: 'USER_BULK_ROLE',
  USER_BULK_REMINDERS: 'USER_BULK_REMINDERS',
  USER_BULK_VERIFY: 'USER_BULK_VERIFY',
  USER_BULK_DELETE: 'USER_BULK_DELETE',
  SIGNUP_OTP_RESEND: 'SIGNUP_OTP_RESEND',
  SIGNUP_DELETE: 'SIGNUP_DELETE',
  THREAD_DELETION_APPROVE: 'THREAD_DELETION_APPROVE',
  THREAD_DELETION_REJECT: 'THREAD_DELETION_REJECT',
  THREAD_RESTORE_APPROVE: 'THREAD_RESTORE_APPROVE',
  THREAD_RESTORE_REJECT: 'THREAD_RESTORE_REJECT',
  TICKET_STATUS: 'TICKET_STATUS',
  TICKET_RESPONSE: 'TICKET_RESPONSE',
  EMAIL_RESEND: 'EMAIL_RESEND',
});

/**
 * Writes one audit entry for a mutation that has already succeeded.
 * Resolves to undefined either way — see the catch for why it never rejects.
 */
const recordAudit = async (req, {
  action,
  targetType = 'USER',
  target = null,
  targetLabel,
  before = null,
  after = null,
  summary,
} = {}) => {
  try {
    // The model reads AUDIT_ACTIONS back out of this file for its enum, so requiring it at
    // module scope would hand us a half-initialised export. By call time it is fully loaded.
    const AdminAudit = require('../models/AdminAudit');

    // A scheduler has no request and so no actor, and an actorless entry answers nobody's
    // question about who did what. Skip rather than persist a doc that fails validation.
    if (!req || !req.user) return;

    if (!action || !summary) {
      console.error('[Audit] Refusing to log an entry with no action or no summary:', action);
      return;
    }

    await AdminAudit.create({
      actor: req.user._id,
      actorName: req.user.displayName,
      actorEmail: req.user.email,
      action,
      targetType,
      target,
      targetLabel,
      before,
      after,
      summary,
      ip: req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req.ip,
    });
  } catch (err) {
    // The mutation this describes has already committed. Rejecting here would turn a
    // successful role change into a 500 and tempt the admin into retrying it, so the log
    // is allowed to lose an entry but never allowed to fail the thing it was recording.
    console.error('[Audit] Failed to record audit entry:', err);
  }
};

module.exports = { recordAudit, AUDIT_ACTIONS };
