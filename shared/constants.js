// Single source of truth for shared enums between the backend API and the React frontend.
// Backend consumes it via require('../shared/constants'); the frontend consumes it via the
// `@shared` alias configured in frontend/vite.config.js.

const ROLES = Object.freeze({
  MEMBER: 'MEMBER',
  COUNSELOR: 'COUNSELOR',
  ADMIN: 'ADMIN',
  YOUTH_TREASURER: 'YOUTH_TREASURER',
});

const ROLE_LABELS = Object.freeze({
  [ROLES.ADMIN]: 'Admin',
  [ROLES.COUNSELOR]: 'Counselor',
  [ROLES.YOUTH_TREASURER]: 'Youth Treasurer',
  [ROLES.MEMBER]: 'Member',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

const THREAD_STATUS = Object.freeze({
  ACTIVE: 'Active',
  ACCEPTED: 'Accepted',
  ESCALATED: 'Escalated',
  RESOLVED: 'Resolved',
});

const ALL_THREAD_STATUSES = Object.freeze(Object.values(THREAD_STATUS));

const THREAD_AUTHOR_TYPE = Object.freeze({
  SENDER: 'Sender',
  RECEIVER: 'Receiver',
});

const CONSENT_STATUS = Object.freeze({
  NONE: 'None',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  DECLINED: 'Declined',
  REJECTED: 'Rejected',
});

const DELETE_RESTORE_STATUS = Object.freeze({
  NONE: 'None',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
});

const TICKET_TYPE = Object.freeze({
  BUG: 'bug',
  FEATURE: 'feature',
  MODIFICATION: 'modification',
});

const TICKET_STATUS = Object.freeze({
  OPEN: 'open',
  IN_PROGRESS: 'in-progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
});

const DEVOTIONAL_STATUS = Object.freeze({
  SUBMITTED: 'Submitted',
  ACKNOWLEDGED: 'Acknowledged',
  MISSED: 'Missed',
});

const AFFIRMATION_STATUS = Object.freeze({
  ACTIVE: 'Active',
  RECEIVED: 'Received',
});

const TRANSACTION_TYPE = Object.freeze({
  INCOME: 'INCOME',
  EXPENSE: 'EXPENSE',
});

const TRANSACTION_SOURCE = Object.freeze({
  MANUAL: 'MANUAL',
  DUES_LEDGER: 'DUES_LEDGER',
});

const AUDIT_TARGET_TYPE = Object.freeze({
  USER: 'USER',
  THREAD: 'THREAD',
  TICKET: 'TICKET',
  EMAIL: 'EMAIL',
  SYSTEM: 'SYSTEM',
});

const AUDIT_ACTION_TYPE = Object.freeze({
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
});

const EMAIL_LOG_STATUS = Object.freeze({
  SENT: 'sent',
  FAILED: 'failed',
});

const QUIZ_TYPE = Object.freeze({
  MULTIPLE_CHOICE: 'multiple_choice',
  TRUE_FALSE: 'true_false',
});

const FRUITS = Object.freeze([
  'Love',
  'Joy',
  'Peace',
  'Patience',
  'Kindness',
  'Goodness',
  'Faithfulness',
  'Gentleness',
  'Self-control',
]);

module.exports = {
  ROLES,
  ROLE_LABELS,
  ALL_ROLES,
  THREAD_STATUS,
  ALL_THREAD_STATUSES,
  THREAD_AUTHOR_TYPE,
  CONSENT_STATUS,
  DELETE_RESTORE_STATUS,
  TICKET_TYPE,
  TICKET_STATUS,
  DEVOTIONAL_STATUS,
  AFFIRMATION_STATUS,
  TRANSACTION_TYPE,
  TRANSACTION_SOURCE,
  AUDIT_TARGET_TYPE,
  AUDIT_ACTION_TYPE,
  EMAIL_LOG_STATUS,
  QUIZ_TYPE,
  FRUITS,
};