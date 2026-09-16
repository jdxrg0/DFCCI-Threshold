/* ── Admin — shared numbers, labels and formatters ───────────────────────
   One home for everything the admin tabs compute the same way, so a rule
   changed once stops drifting across the eight panels. Everything here is
   pure — the React pieces live in shared.jsx and the stateful fetch bundle
   in useAdminMeta.js. makeMutate sits here only because it has no JSX. */

export const USERS_PER_PAGE = 12;
export const EMAILS_PER_PAGE = 10;
export const AUDIT_PER_PAGE = 20;
export const RETENTION_DAYS = 60;

// GET /users caps `limit` at 100, so the CSV walk asks for the biggest page
// the server will actually hand back. The page cap is a seatbelt: a totalPages
// that ever came back wrong must not spin the browser forever.
export const CSV_PAGE_SIZE = 100;
export const CSV_MAX_PAGES = 200;

// Stable identity, so the KPI rail does not see a new object on every failed load.
export const EMPTY_USER_STATS = { total: 0, verified: 0, unverified: 0, byRole: {} };

export const BULK_ROLES = ['MEMBER', 'COUNSELOR', 'YOUTH_TREASURER', 'ADMIN'];

export const TICKET_TONE = { bug: 'danger', feature: 'info', question: 'violet' };

/* The audit feed stores the raw enum. Printed verbatim the table reads like a
   stack trace, so every action the backend can write gets a label here. */
export const AUDIT_LABELS = {
  USER_ROLE_CHANGE: 'Role change',
  USER_BULK_ROLE: 'Bulk role change',
  USER_VERIFY: 'Verify',
  USER_UNVERIFY: 'Unverify',
  USER_BULK_VERIFY: 'Bulk verify',
  USER_DELETE: 'Delete member',
  USER_BULK_DELETE: 'Bulk delete',
  USER_REMINDERS_TOGGLE: 'Dues reminders',
  USER_BULK_REMINDERS: 'Bulk dues reminders',
  USER_RENAME_REQUEST: 'Rename request',
  USER_DATE_POWER: 'Date power',
  USER_OTP_RESEND: 'Resend code',
  SIGNUP_OTP_RESEND: 'Resend signup code',
  SIGNUP_DELETE: 'Delete signup',
  THREAD_DELETION_APPROVE: 'Approve deletion',
  THREAD_DELETION_REJECT: 'Reject deletion',
  THREAD_RESTORE_APPROVE: 'Approve restore',
  THREAD_RESTORE_REJECT: 'Reject restore',
  TICKET_STATUS: 'Request status',
  TICKET_RESPONSE: 'Request reply',
  EMAIL_RESEND: 'Resend email',
};

export const auditLabel = (action) =>
  AUDIT_LABELS[action] || String(action || '').replace(/_/g, ' ').toLowerCase();

// Approvals are tested first on purpose: THREAD_DELETION_APPROVE is an approval,
// and the unverify check has to beat the generic VERIFY match below it.
export const auditTone = (action) => {
  const key = String(action || '');
  if (key.endsWith('_APPROVE')) return 'ok';
  if (key.includes('DELETE') || key === 'USER_UNVERIFY') return 'danger';
  if (key.includes('ROLE') || key.includes('VERIFY')) return 'violet';
  return 'muted';
};

export const memberCount = (n) => `${n} member${n === 1 ? '' : 's'}`;

export const usageTone = (percent) => {
  if (percent > 85) return 'var(--danger)';
  if (percent > 60) return 'var(--warning)';
  return 'var(--success)';
};

export const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

export const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// Hours until `value`, or 0 when it has already passed.
export const hoursUntil = (value) => {
  if (!value) return 0;
  const diff = new Date(value) - new Date();
  return diff > 0 ? Math.ceil(diff / 3600000) : 0;
};

// Minutes until `value`, or 0 when it has already passed.
export const minutesUntil = (value) => {
  if (!value) return 0;
  const diff = new Date(value) - new Date();
  return diff > 0 ? Math.ceil(diff / 60000) : 0;
};

export const stamp = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

// Coarse "how long ago" for the signup queue, whose rows are only ever minutes old.
export const sinceLabel = (value) => {
  if (!value) return 'just now';
  const mins = Math.max(0, Math.round((new Date() - new Date(value)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

// Wraps a mutation and the refetch that follows it, sending the server's
// message to the shared alert popup when the call fails. Mirrors the failure
// precedence the old monolith used: message, plain msg, then the fallback.
export const makeMutate = (alert) => async (request, onDone, fallback) => {
  try {
    await request();
    await onDone();
  } catch (err) {
    alert('Error', err.response?.data?.message || err.response?.data?.msg || fallback);
  }
};