import React, { Fragment, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PopupModal from '../components/PopupModal';
import PageHeader from '../components/PageHeader';
import { renderAvatarHelper } from '../utils/avatarHelper';
import UsageTrendChart from '../components/UsageTrendChart';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle,
  ChevronDown,
  Clock,
  Cloud,
  Cpu,
  Database,
  Download,
  Eye,
  GitBranch,
  HardDrive,
  History,
  Info,
  KeyRound,
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Admin Dashboard — /admin

   Nine tabs over eight APIs:
     users               GET  /users                        (+ role, verify,
                                                              resend-otp, delete,
                                                              reminders, rename
                                                              request, date power
                                                              and the /bulk/* set)
     signups             GET  /users/admin/pending-signups   (+ resend, delete)
     deletion-requests   GET  /threads/admin/deletion-requests   (+ approve/reject)
     restore-requests    GET  /threads/admin/restore-requests    (+ approve/reject)
     recently-deleted    GET  /threads/admin/recently-deleted
     tickets             GET  /tickets                       (+ PATCH /:id/admin)
     emails              GET  /emails                        (+ POST /:id/resend)
     audit               GET  /users/admin/audit
     limits              GET  /users/admin/platform-limits
                         GET  /users/admin/platform-history

   Members, the email log and the audit feed are all paged and filtered by the
   server; nothing on this page holds a whole collection in memory any more.

   Everything boots in parallel so the badge counts and the KPI rail are
   correct on first paint; switching a tab re-fetches just that tab. The
   presentation lives in styles/admin.css — do not reintroduce inline colour
   here, it is what stopped this page working on the light themes.
   ────────────────────────────────────────────────────────────────────────── */

const USERS_PER_PAGE = 12;
const EMAILS_PER_PAGE = 10;
const AUDIT_PER_PAGE = 20;
const RETENTION_DAYS = 60;

// GET /users caps `limit` at 100, so the CSV walk asks for the biggest page the
// server will actually hand back. The page cap is a seatbelt: a totalPages that
// ever came back wrong must not spin the browser forever.
const CSV_PAGE_SIZE = 100;
const CSV_MAX_PAGES = 200;

// Stable identity, so the KPI rail does not see a new object on every failed load.
const EMPTY_USER_STATS = { total: 0, verified: 0, unverified: 0, byRole: {} };

const BULK_ROLES = ['MEMBER', 'COUNSELOR', 'YOUTH_TREASURER', 'ADMIN'];

const TICKET_TONE = { bug: 'danger', feature: 'info', question: 'violet' };

/* The audit feed stores the raw enum. Printed verbatim the table reads like a
   stack trace, so every action the backend can write gets a label here. */
const AUDIT_LABELS = {
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

const auditLabel = (action) =>
  AUDIT_LABELS[action] || String(action || '').replace(/_/g, ' ').toLowerCase();

// Approvals are tested first on purpose: THREAD_DELETION_APPROVE is an approval,
// and the unverify check has to beat the generic VERIFY match below it.
const auditTone = (action) => {
  const key = String(action || '');
  if (key.endsWith('_APPROVE')) return 'ok';
  if (key.includes('DELETE') || key === 'USER_UNVERIFY') return 'danger';
  if (key.includes('ROLE') || key.includes('VERIFY')) return 'violet';
  return 'muted';
};

const memberCount = (n) => `${n} member${n === 1 ? '' : 's'}`;

const usageTone = (percent) => {
  if (percent > 85) return 'var(--danger)';
  if (percent > 60) return 'var(--warning)';
  return 'var(--success)';
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const shortDate = (value) =>
  value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

// Hours until `value`, or 0 when it has already passed.
const hoursUntil = (value) => {
  if (!value) return 0;
  const diff = new Date(value) - new Date();
  return diff > 0 ? Math.ceil(diff / 3600000) : 0;
};

// Minutes until `value`, or 0 when it has already passed.
const minutesUntil = (value) => {
  if (!value) return 0;
  const diff = new Date(value) - new Date();
  return diff > 0 ? Math.ceil(diff / 60000) : 0;
};

const stamp = (value) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—';

// Coarse "how long ago" for the signup queue, whose rows are only ever minutes old.
const sinceLabel = (value) => {
  if (!value) return 'just now';
  const mins = Math.max(0, Math.round((new Date() - new Date(value)) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.round(hours / 24)}d ago`;
};

/* ── Small shared pieces ──────────────────────────────────────────────── */

const Meter = ({ percent, tone }) => {
  const width = Math.min(100, Math.max(0, percent || 0));
  return (
    <div
      className="adm-meter__track"
      role="progressbar"
      aria-valuenow={Math.round(width)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="adm-meter__fill" style={{ width: `${width}%`, '--tone': tone }} />
    </div>
  );
};

const EmptyState = ({ icon: Icon, title, text }) => (
  <div className="adm-empty">
    <Icon size={38} className="adm-empty__icon" aria-hidden="true" />
    <h4 className="adm-empty__title">{title}</h4>
    <p className="adm-empty__text">{text}</p>
  </div>
);

const Skeletons = ({ count = 5 }) => (
  <div aria-hidden="true">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="adm-skel" />
    ))}
  </div>
);

const Flow = ({ from, to }) => (
  <div className="adm-flow">
    <div className="adm-flow__side">
      <span className="adm-flow__label">Sender</span>
      <span className="adm-flow__name">{from || 'Unknown'}</span>
    </div>
    <ArrowRight size={14} className="adm-flow__arrow" aria-hidden="true" />
    <div className="adm-flow__side adm-flow__side--to">
      <span className="adm-flow__label">Receiver</span>
      <span className="adm-flow__name">{to || 'Unknown'}</span>
    </div>
  </div>
);

const Pager = ({ page, totalPages, onChange, label }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="adm-pager">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page <= 1}
        onClick={() => onChange(Math.max(1, page - 1))}
      >
        {label.previous}
      </button>
      <span className="adm-pager__label">{label.of}</span>
      <button
        type="button"
        className="btn btn-secondary"
        disabled={page >= totalPages}
        onClick={() => onChange(Math.min(totalPages, page + 1))}
      >
        {label.next}
      </button>
    </div>
  );
};

/* ── Page ─────────────────────────────────────────────────────────────── */

const AdminPanel = () => {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('users');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastSync, setLastSync] = useState(null);

  const [users, setUsers] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Users tab — every control below is a query param, not a client-side filter
  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userSort, setUserSort] = useState('name');
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotalCount, setUsersTotalCount] = useState(0);
  const [userStats, setUserStats] = useState(EMPTY_USER_STATS);
  const [usersLoading, setUsersLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [verifyingId, setVerifyingId] = useState(null);
  const [otpUserId, setOtpUserId] = useState(null);

  // Bulk selection, keyed by _id so it survives a re-fetch of the same page
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Signups tab
  const [signups, setSignups] = useState([]);
  const [signupsLoading, setSignupsLoading] = useState(false);
  const [signupBusyId, setSignupBusyId] = useState(null);

  // Audit tab
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditActions, setAuditActions] = useState([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditAction, setAuditAction] = useState('');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditOpen, setAuditOpen] = useState(null);

  // Tickets tab controls
  const [ticketStatus, setTicketStatus] = useState('');

  // Emails tab
  const [emails, setEmails] = useState([]);
  const [emailsSearch, setEmailsSearch] = useState('');
  const [emailsStatus, setEmailsStatus] = useState('');
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsTotalPages, setEmailsTotalPages] = useState(1);
  const [emailsTotalCount, setEmailsTotalCount] = useState(0);
  const [emailsLoggedAll, setEmailsLoggedAll] = useState(0);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  // Platform limits
  const [limitsData, setLimitsData] = useState(null);
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [limitsError, setLimitsError] = useState('');
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);

  const [popup, setPopup] = useState({
    isOpen: false, title: '', message: '', onConfirm: null,
    isAlert: false, isPrompt: false, promptValue: '',
  });

  const bootedRef = useRef(false);
  const tabRefs = useRef([]);
  const selectAllRef = useRef(null);

  const showAlert = (title, message) =>
    setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true, isPrompt: false, promptValue: '' });
  const showConfirm = (title, message, onConfirm) =>
    setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: false, promptValue: '' });
  const showPrompt = (title, message, onConfirm) =>
    setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: true, promptValue: '' });

  /* ── Fetchers ───────────────────────────────────────────────────────── */

  // Each fetcher owns one slice and reports its own failure. The previous
  // build wrote to a shared `error` that was never rendered, so a dead
  // endpoint looked like an empty list.
  const load = useCallback(async (path, setter, label, config) => {
    try {
      const res = await api.get(path, config);
      setter(res.data);
      setError('');
      return res.data;
    } catch (err) {
      setError(`Could not load ${label}. ${err.response?.data?.message || err.message || ''}`.trim());
      return null;
    }
  }, []);

  // Members are paged, searched, filtered and sorted by the server, so this owns
  // its own loading flag: the rows already on screen stay put while it runs.
  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get('/users', {
        params: {
          page: usersPage, limit: USERS_PER_PAGE, search: userQuery,
          role: userRole, status: userStatus, sort: userSort,
        },
      });
      const pages = res.data.totalPages || 1;
      setUsers(res.data.users || []);
      setUsersTotalPages(pages);
      setUsersTotalCount(res.data.totalCount || 0);
      // Deleting the last row of the last page leaves the admin standing on a page
      // that no longer exists; walk back rather than claim nothing matches.
      if (usersPage > pages) setUsersPage(pages);
      // Whole-collection figures. The KPI rail reads these rather than users.length,
      // which is now only ever one page of twelve.
      setUserStats(res.data.stats || EMPTY_USER_STATS);
      setError('');
    } catch (err) {
      setError(`Could not load members. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setUsersLoading(false);
    }
  }, [usersPage, userQuery, userRole, userStatus, userSort]);

  const fetchDeletionRequests = useCallback(
    () => load('/threads/admin/deletion-requests', setDeletionRequests, 'deletion requests'), [load]);
  const fetchRestoreRequests = useCallback(
    () => load('/threads/admin/restore-requests', setRestoreRequests, 'restore requests'), [load]);
  const fetchRecentlyDeleted = useCallback(
    () => load('/threads/admin/recently-deleted', setRecentlyDeleted, 'the deletion archive'), [load]);
  const fetchTickets = useCallback(() => load('/tickets', setTickets, 'system requests'), [load]);

  const fetchSignups = useCallback(async () => {
    setSignupsLoading(true);
    try {
      const res = await api.get('/users/admin/pending-signups');
      setSignups(res.data.signups || []);
      setError('');
    } catch (err) {
      setError(`Could not load pending signups. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setSignupsLoading(false);
    }
  }, []);

  const fetchAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await api.get('/users/admin/audit', {
        params: {
          page: auditPage, limit: AUDIT_PER_PAGE, search: auditSearch,
          action: auditAction, from: auditFrom, to: auditTo,
        },
      });
      setAuditEntries(res.data.entries || []);
      setAuditTotalPages(res.data.totalPages || 1);
      setAuditTotalCount(res.data.totalCount || 0);
      // Comes from what is actually stored, so the dropdown can never offer a
      // filter that only ever returns an empty page.
      setAuditActions(res.data.actions || []);
      setError('');
    } catch (err) {
      setError(`Could not load the audit log. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setAuditLoading(false);
    }
  }, [auditPage, auditSearch, auditAction, auditFrom, auditTo]);

  const fetchEmails = useCallback(async () => {
    setEmailsLoading(true);
    try {
      const res = await api.get('/emails', {
        params: { page: emailsPage, limit: EMAILS_PER_PAGE, search: emailsSearch, status: emailsStatus },
      });
      setEmails(res.data.emails || []);
      setEmailsTotalPages(res.data.totalPages || 1);
      setEmailsTotalCount(res.data.totalCount || 0);
      // Keep an unfiltered total for the KPI rail, so filtering the log does
      // not make the headline number jump around.
      if (!emailsSearch && !emailsStatus) setEmailsLoggedAll(res.data.totalCount || 0);
      setError('');
    } catch (err) {
      setError(`Could not load the email log. ${err.response?.data?.message || err.message || ''}`.trim());
    } finally {
      setEmailsLoading(false);
    }
  }, [emailsPage, emailsSearch, emailsStatus]);

  const fetchPlatformLimits = useCallback(async () => {
    setLimitsLoading(true);
    setLimitsError('');
    try {
      const res = await api.get('/users/admin/platform-limits');
      setLimitsData(res.data);
    } catch (err) {
      setLimitsError(err.response?.data?.message || 'Failed to fetch platform limits data.');
    } finally {
      setLimitsLoading(false);
    }
  }, []);

  const fetchPlatformHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await api.get('/users/admin/platform-history', { params: { days: historyDays } });
      setHistory(res.data.snapshots || []);
    } catch (err) {
      // The trend chart is supplementary. A failure here must not take the limit
      // cards down with it, so it is logged rather than raised into the banner.
      console.error('Failed to load platform history:', err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyDays]);

  /* ── Boot & tab sync ────────────────────────────────────────────────── */

  useEffect(() => {
    if (authLoading || !user) return; // wait for auth before deciding on access
    if (user.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    if (bootedRef.current) return;
    bootedRef.current = true;

    (async () => {
      await Promise.allSettled([
        fetchUsers(), fetchSignups(), fetchDeletionRequests(), fetchRestoreRequests(),
        fetchRecentlyDeleted(), fetchTickets(), fetchEmails(),
      ]);
      setLastSync(Date.now());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, navigate]);

  // Re-fetch the tab being opened. Platform limits are excluded: that call
  // hits the Cloudinary API and runs dbStats over every collection, so it
  // loads once and refreshes only on request.
  useEffect(() => {
    if (!bootedRef.current || loading) return;
    if (activeTab === 'signups') fetchSignups();
    if (activeTab === 'deletion-requests') fetchDeletionRequests();
    if (activeTab === 'restore-requests') fetchRestoreRequests();
    if (activeTab === 'recently-deleted') fetchRecentlyDeleted();
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'limits' && !limitsData && !limitsLoading) fetchPlatformLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Email log is server-paginated and server-searched, so the query is
  // debounced — it used to fire one request per keystroke.
  useEffect(() => {
    if (!bootedRef.current || loading || activeTab !== 'emails') return;
    const id = setTimeout(fetchEmails, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, emailsSearch, emailsStatus, emailsPage]);

  // Members moved onto the same footing as the email log, so the same 280ms
  // debounce covers the search box; the selects and the pager settle instantly.
  useEffect(() => {
    if (!bootedRef.current || loading || activeTab !== 'users') return;
    const id = setTimeout(fetchUsers, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userQuery, userRole, userStatus, userSort, usersPage]);

  useEffect(() => {
    if (!bootedRef.current || loading || activeTab !== 'audit') return;
    const id = setTimeout(fetchAudit, 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, auditSearch, auditAction, auditFrom, auditTo, auditPage]);

  // The growth chart re-queries whenever its window changes. Deferred a tick so
  // running through the range options fires one request instead of one per step.
  useEffect(() => {
    if (!bootedRef.current || loading || activeTab !== 'limits') return;
    const id = setTimeout(fetchPlatformHistory, 120);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, historyDays]);

  /* ── Bulk selection ─────────────────────────────────────────────────── */

  // The server refuses to bulk-target the caller, so their row is never offered
  // as a checkbox and never lands in the selection.
  const selectableIds = useMemo(
    () => users.filter((u) => u._id !== user?._id).map((u) => u._id),
    [users, user],
  );

  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const clearSelection = () => setSelectedIds((prev) => (prev.size ? new Set() : prev));

  // `indeterminate` is a DOM property with no HTML attribute behind it, so the
  // partial-selection state on the header box can only be set imperatively.
  useEffect(() => {
    const box = selectAllRef.current;
    if (!box) return;
    const chosen = selectableIds.filter((id) => selectedIds.has(id)).length;
    box.indeterminate = chosen > 0 && chosen < selectableIds.length;
  }, [selectedIds, selectableIds]);

  const toggleOne = (id) => setSelectedIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const toggleSelectPage = () => setSelectedIds((prev) => {
    const every = selectableIds.length > 0 && selectableIds.every((id) => prev.has(id));
    const next = new Set(prev);
    selectableIds.forEach((id) => (every ? next.delete(id) : next.add(id)));
    return next;
  });

  // Any change to the result set sends the pager home and drops the selection —
  // a ticked id the admin can no longer see is an action they cannot review.
  const setUserFilter = (setter) => (value) => {
    setter(value);
    setUsersPage(1);
    clearSelection();
  };

  const goUsersPage = (page) => { setUsersPage(page); clearSelection(); };

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      fetchUsers(), fetchSignups(), fetchDeletionRequests(), fetchRestoreRequests(),
      fetchRecentlyDeleted(), fetchTickets(), fetchEmails(), fetchAudit(),
      limitsData ? fetchPlatformLimits() : Promise.resolve(),
      limitsData ? fetchPlatformHistory() : Promise.resolve(),
    ]);
    setLastSync(Date.now());
    setRefreshing(false);
  };

  /* ── Mutations ──────────────────────────────────────────────────────── */

  const mutate = async (request, onDone, fallback) => {
    try {
      await request();
      await onDone();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || err.response?.data?.msg || fallback);
    }
  };

  // Role changes are irreversible from the member's side and ADMIN grants
  // full platform control, so both now confirm instead of firing on change.
  const handleRoleChange = (target, newRole) => {
    if (target._id === user._id) {
      showAlert('Not allowed', 'You cannot change your own role.');
      return;
    }
    if (newRole === target.role) return;

    const warning = newRole === 'ADMIN'
      ? '\n\nAdministrators can manage every member, approve deletions and read the platform logs.'
      : '';
    showConfirm(
      'Change role',
      `Change ${target.displayName} from ${t(`role_${target.role.toLowerCase()}`)} to ${t(`role_${newRole.toLowerCase()}`)}?${warning}`,
      () => mutate(() => api.put(`/users/${target._id}/role`, { role: newRole }), fetchUsers, 'Failed to update role'),
    );
  };

  const handleToggleReminders = (id) =>
    mutate(() => api.put(`/users/${id}/toggle-reminders`), fetchUsers, 'Failed to toggle reminders');

  const handleRequestNameChange = (id) =>
    mutate(() => api.put(`/users/${id}/request-name-change`), fetchUsers, 'Failed to request name change');

  // Unverifying locks the member out until they redeem a fresh code, so only that
  // direction confirms; granting verification is recoverable in one click.
  const handleToggleVerify = (target) => {
    const next = !target.isVerified;

    const run = async () => {
      setVerifyingId(target._id);
      try {
        const res = await api.put(`/users/${target._id}/verify`, { isVerified: next });
        await fetchUsers();
        showAlert('Done', res.data.message);
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'Failed to update verification');
      } finally {
        setVerifyingId(null);
      }
    };

    if (next) {
      run();
      return;
    }
    showConfirm(
      'Remove verification',
      `Unverify ${target.displayName}? They will be locked out until they enter a new code.`,
      run,
    );
  };

  const handleResendOtp = async (target) => {
    setOtpUserId(target._id);
    try {
      const res = await api.post(`/users/${target._id}/resend-otp`);
      showAlert('Code sent', res.data.message);
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to resend the verification code');
    } finally {
      setOtpUserId(null);
    }
  };

  /* Bulk endpoints all answer with matched/modified/skipped. `skipped` is the only
     way an admin learns that a row was left alone — a stale id, or their own. */
  const runBulk = (title, message, request) => {
    showConfirm(title, message, async () => {
      setBulkBusy(true);
      try {
        const res = await request(Array.from(selectedIds));
        const skipped = res.data.skipped?.length || 0;
        clearSelection();
        await fetchUsers();
        showAlert(
          'Bulk action complete',
          skipped
            ? `${res.data.message}. ${res.data.modified} changed, ${skipped} skipped.`
            : res.data.message,
        );
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'The bulk action failed');
      } finally {
        setBulkBusy(false);
      }
    });
  };

  const handleBulkRole = (role) => {
    const warning = role === 'ADMIN'
      ? '\n\nAdministrators can manage every member, delete accounts in bulk, approve deletions and read the platform logs. Grant it only to people who should hold all of that.'
      : '';
    runBulk(
      'Set role',
      `Set ${memberCount(selectedIds.size)} to ${t(`role_${role.toLowerCase()}`)}?${warning}`,
      (ids) => api.patch('/users/bulk/role', { ids, role }),
    );
  };

  const handleBulkReminders = (subscribed) =>
    runBulk(
      subscribed ? 'Enable dues reminders' : 'Disable dues reminders',
      `${subscribed ? 'Enable' : 'Disable'} dues reminder emails for ${memberCount(selectedIds.size)}?`,
      (ids) => api.patch('/users/bulk/reminders', { ids, subscribed }),
    );

  const handleBulkVerify = (isVerified) =>
    runBulk(
      isVerified ? 'Verify members' : 'Unverify members',
      isVerified
        ? `Mark ${memberCount(selectedIds.size)} as verified? They will be able to sign in without a code.`
        : `Remove verification from ${memberCount(selectedIds.size)}? They will be locked out until they enter a new code.`,
      (ids) => api.patch('/users/bulk/verify', { ids, isVerified }),
    );

  const handleBulkDelete = () =>
    runBulk(
      'Delete members',
      `Permanently delete ${memberCount(selectedIds.size)}? Their accounts, profiles and access are removed immediately. This cannot be undone.`,
      (ids) => api.post('/users/bulk/delete', { ids }),
    );

  const handleResendSignup = async (signup) => {
    setSignupBusyId(signup._id);
    try {
      const res = await api.post(`/users/admin/pending-signups/${signup._id}/resend`);
      await fetchSignups();
      showAlert('Code sent', res.data.message);
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to resend the signup code');
    } finally {
      setSignupBusyId(null);
    }
  };

  const handleDeleteSignup = (signup) =>
    showConfirm(
      'Delete signup',
      `Drop the unfinished signup for ${signup.email}? They would have to start registration again.`,
      () => mutate(
        () => api.delete(`/users/admin/pending-signups/${signup._id}`),
        fetchSignups,
        'Failed to delete the signup',
      ),
    );

  const handleDeleteUser = (target) => {
    showConfirm(
      'Delete member',
      `Permanently delete ${target.displayName} (${target.email})? Their account and access are removed immediately. This cannot be undone.`,
      () => mutate(() => api.delete(`/users/${target._id}`), fetchUsers, 'Failed to delete user'),
    );
  };

  const handleDatePower = (target) => {
    const remaining = hoursUntil(target.customDatePowerExpires);
    const prefix = remaining
      ? `${target.displayName} currently has custom date power (~${remaining}h remaining).\n\n`
      : '';
    showPrompt(
      'Custom date power',
      `${prefix}Enter a duration in hours (e.g. 1, 2, 24). Enter 0 to revoke.`,
      async (val) => {
        if (val === null || val === undefined || String(val).trim() === '') return;
        const num = parseFloat(val);
        if (Number.isNaN(num) || num < 0) {
          showAlert('Error', 'Please enter a valid positive number, or 0 to revoke.');
          return;
        }
        try {
          const res = await api.put(`/users/${target._id}/custom-date-power`, {
            durationMinutes: Math.round(num * 60),
          });
          showAlert('Success', res.data.message);
          fetchUsers();
        } catch (err) {
          showAlert('Error', err.response?.data?.message || 'Failed to update custom date power');
        }
      },
    );
  };

  const handleApproveDeletion = (id) =>
    mutate(() => api.put(`/threads/admin/${id}/approve-deletion`), () =>
      Promise.all([fetchDeletionRequests(), fetchRecentlyDeleted()]), 'Failed to approve deletion');

  const handleRejectDeletion = (id) =>
    mutate(() => api.put(`/threads/admin/${id}/reject-deletion`), fetchDeletionRequests, 'Failed to reject deletion');

  const handleApproveRestore = (id) =>
    mutate(() => api.put(`/threads/admin/${id}/approve-restore`), () =>
      Promise.all([fetchRestoreRequests(), fetchRecentlyDeleted()]), 'Failed to approve restore');

  const handleRejectRestore = (id) =>
    mutate(() => api.put(`/threads/admin/${id}/reject-restore`), fetchRestoreRequests, 'Failed to reject restore');

  const handleUpdateTicketStatus = (id, status) =>
    mutate(() => api.patch(`/tickets/${id}/admin`, { status }), fetchTickets, 'Failed to update ticket');

  const handleAdminResponse = (ticket) => {
    showPrompt('Admin response', `Reply to "${ticket.title}":`, async (response) => {
      if (!response || !response.trim()) return;
      await mutate(
        () => api.patch(`/tickets/${ticket._id}/admin`, { adminResponse: response.trim() }),
        fetchTickets,
        'Failed to update response',
      );
    });
  };

  const handleResendEmail = async (id) => {
    setResendingId(id);
    try {
      await api.post(`/emails/${id}/resend`);
      showAlert('Success', t('email_resend_success'));
      fetchEmails();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || t('email_resend_error'));
    } finally {
      setResendingId(null);
    }
  };

  /* ── Derived data ───────────────────────────────────────────────────── */

  const pendingApprovals = deletionRequests.length + restoreRequests.length;
  const openTickets = tickets.filter((tk) => tk.status === 'open' || tk.status === 'in-progress').length;
  // Expired rows are already dead weight, so the badge only counts the signups an
  // admin can still rescue with a resend.
  const liveSignups = signups.filter((s) => !s.expired).length;

  const tabs = useMemo(() => [
    { id: 'users', label: 'Members', icon: Users, count: 0 },
    { id: 'signups', label: 'Signups', icon: UserPlus, count: liveSignups, tone: 'warn' },
    { id: 'deletion-requests', label: 'Deletion', icon: Trash2, count: deletionRequests.length, tone: 'danger' },
    { id: 'restore-requests', label: 'Restore', icon: RotateCcw, count: restoreRequests.length, tone: 'warn' },
    { id: 'recently-deleted', label: 'Archive', icon: History, count: 0 },
    { id: 'tickets', label: 'Requests', icon: MessageSquare, count: openTickets, tone: 'violet' },
    { id: 'emails', label: t('admin_emails_tab') || 'Emails', icon: Mail, count: 0 },
    { id: 'audit', label: 'Audit', icon: ScrollText, count: 0 },
    { id: 'limits', label: 'Platform Limits', icon: HardDrive, count: 0 },
  ], [liveSignups, deletionRequests.length, restoreRequests.length, openTickets, t]);

  const visibleTickets = useMemo(
    () => (ticketStatus ? tickets.filter((tk) => tk.status === ticketStatus) : tickets),
    [tickets, ticketStatus],
  );

  // These come from the response's `stats`, which the server computes over the
  // whole collection — users.length is one page of twelve and would read as a
  // shrinking membership every time the admin typed in the search box.
  const stats = [
    { id: 'members', icon: Users, value: userStats.total, label: 'Members', tone: 'var(--primary)', tab: 'users' },
    { id: 'verified', icon: ShieldCheck, value: userStats.verified, label: 'Verified', tone: 'var(--success)', tab: 'users', onPick: () => setUserFilter(setUserStatus)('verified') },
    { id: 'approvals', icon: ShieldAlert, value: pendingApprovals, label: 'Pending Approvals', tone: 'var(--warning)', tab: 'deletion-requests' },
    { id: 'requests', icon: MessageSquare, value: openTickets, label: 'Open Requests', tone: 'var(--tone-violet)', tab: 'tickets' },
    { id: 'emails', icon: Mail, value: emailsLoggedAll, label: 'Emails Logged', tone: 'var(--info)', tab: 'emails' },
  ];

  /* ── Users CSV export ───────────────────────────────────────────────── */

  // "Export CSV" has to mean everything matching the current filters, not the
  // twelve rows on screen, so it walks the same endpoint page by page first.
  const exportUsersCsv = async () => {
    setExporting(true);
    try {
      const all = [];
      let page = 1;
      let totalPages = 1;
      while (page <= totalPages && page <= CSV_MAX_PAGES) {
        const res = await api.get('/users', {
          params: {
            page, limit: CSV_PAGE_SIZE, search: userQuery,
            role: userRole, status: userStatus, sort: userSort,
          },
        });
        all.push(...(res.data.users || []));
        totalPages = res.data.totalPages || 1;
        page += 1;
      }

      // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
      const safe = (value) => {
        const str = String(value ?? '');
        const escaped = /^[=+\-@]/.test(str) ? `'${str}` : str;
        return `"${escaped.replace(/"/g, '""')}"`;
      };
      const header = ['Name', 'Email', 'Role', 'Verified', 'Dues reminders', 'Rename requested', 'Joined'];
      const rows = all.map((u) => [
        u.displayName, u.email, u.role,
        u.isVerified ? 'Yes' : 'No',
        u.subscribedToDuesReminders ? 'Yes' : 'No',
        u.nameChangeRequested ? 'Yes' : 'No',
        u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '',
      ]);
      const csv = [header, ...rows].map((r) => r.map(safe).join(',')).join('\r\n');
      // BOM so Excel opens the UTF-8 names correctly.
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `dfcci-members-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Could not export the member list.');
    } finally {
      setExporting(false);
    }
  };

  /* ── Drawer behaviour ───────────────────────────────────────────────── */

  useEffect(() => {
    if (!emailPreview) return;
    const onKey = (e) => { if (e.key === 'Escape') setEmailPreview(null); };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [emailPreview]);

  /* ── Tab keyboard navigation ────────────────────────────────────────── */

  const onTabKeyDown = (e, index) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next = null;
    if (keys[e.key]) next = (index + keys[e.key] + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    setActiveTab(tabs[next].id);
    tabRefs.current[next]?.focus();
  };

  /* ── Reusable user fragments (one source for table row + mobile card) ── */

  const identityOf = (u, size) => (
    <div className="adm-ident">
      {renderAvatarHelper(u, size, { flexShrink: 0 })}
      <div className="adm-ident__text">
        <span className="adm-ident__name">{u.displayName}</span>
        <span className="adm-ident__mail">{u.email}</span>
      </div>
    </div>
  );

  const verifyChipOf = (u) => (
    <span className="adm-chip" data-tone={u.isVerified ? 'ok' : 'warn'}>
      {u.isVerified ? <CheckCircle size={11} /> : <ShieldAlert size={11} />}
      {u.isVerified ? 'Verified' : 'Unverified'}
    </span>
  );

  const roleChipOf = (u) => (
    <span className="adm-chip adm-chip--sq" data-role={u.role}>
      {t(`role_${(u.role || 'member').toLowerCase()}`)}
    </span>
  );

  const permissionsOf = (u, compact) => {
    const isSelf = u._id === user._id;
    const powerHours = hoursUntil(u.customDatePowerExpires);
    // The server 400s a resend for a verified member with no pending email change,
    // so the button only exists where a code is actually outstanding.
    const canResend = !u.isVerified || !!u.pendingEmail;
    const verifying = verifyingId === u._id;
    const sendingOtp = otpUserId === u._id;

    return (
      <div className="adm-pills">
        <button
          type="button"
          className="adm-pill"
          data-tone={u.isVerified ? 'danger' : 'ok'}
          disabled={isSelf || verifying}
          onClick={() => handleToggleVerify(u)}
          title={isSelf
            ? 'You cannot change your own verification'
            : (u.isVerified ? `Remove verification from ${u.displayName}` : `Verify ${u.displayName}`)}
        >
          {verifying
            ? <RefreshCw size={12} className="adm-spin" />
            : (u.isVerified ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />)}
          {u.isVerified ? 'Unverify' : 'Verify'}
        </button>

        {canResend && (
          <button
            type="button"
            className="adm-pill"
            data-tone="info"
            disabled={sendingOtp}
            onClick={() => handleResendOtp(u)}
            title={`Email a fresh verification code to ${u.pendingEmail || u.email}`}
          >
            {sendingOtp ? <RefreshCw size={12} className="adm-spin" /> : <KeyRound size={12} />}
            {sendingOtp ? 'Sending' : 'Resend OTP'}
          </button>
        )}

        {!u.isVerified && <span className="adm-self">Awaiting verification</span>}

        {u.isVerified && (
          <>
            <button
              type="button"
              className="adm-pill"
              data-tone="ok"
              aria-pressed={!!u.subscribedToDuesReminders}
              onClick={() => handleToggleReminders(u._id)}
              title={u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
            >
              {u.subscribedToDuesReminders ? <Bell size={12} /> : <BellOff size={12} />}
              {compact ? 'Dues' : (u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled'))}
            </button>

            <button
              type="button"
              className="adm-pill"
              data-tone="warn"
              aria-pressed={!!u.nameChangeRequested}
              onClick={() => handleRequestNameChange(u._id)}
              title={u.nameChangeRequested ? 'A rename is already pending' : 'Ask this member to update their name'}
            >
              <UserCog size={12} />
              {u.nameChangeRequested ? 'Rename pending' : 'Rename'}
            </button>

            <button
              type="button"
              className="adm-pill"
              data-tone="violet"
              aria-pressed={powerHours > 0}
              onClick={() => handleDatePower(u)}
              title="Let this member backdate entries for a limited window"
            >
              <Zap size={12} />
              {powerHours > 0 ? `Date power ${powerHours}h` : 'Date power'}
            </button>
          </>
        )}
      </div>
    );
  };

  const roleSelectOf = (u) => (
    <select
      className="adm-field adm-field--auto"
      value={u.role}
      onChange={(e) => handleRoleChange(u, e.target.value)}
      aria-label={`Role for ${u.displayName}`}
    >
      <option value="MEMBER">{t('role_member')}</option>
      <option value="COUNSELOR">{t('role_counselor')}</option>
      <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
      <option value="ADMIN">{t('role_admin')}</option>
    </select>
  );

  /* ── Tab: members ───────────────────────────────────────────────────── */

  const renderUsers = () => {
    const selected = selectedIds.size;
    const bulkOff = bulkBusy || selected === 0;

    // No checkbox on the current admin's row: the server refuses to bulk-target the
    // caller, so offering one would be a lie. The spacer holds the column open.
    const checkboxOf = (u) => (u._id === user._id
      ? <span className="adm-check-gap" aria-hidden="true" />
      : (
        <input
          type="checkbox"
          className="adm-check"
          checked={selectedIds.has(u._id)}
          onChange={() => toggleOne(u._id)}
          aria-label={`Select ${u.displayName}`}
        />
      ));

    return (
      <>
        <div className="adm-toolbar">
          <div className="adm-search">
            <Search size={15} className="adm-search__icon" aria-hidden="true" />
            <input
              className="adm-field"
              type="search"
              value={userQuery}
              onChange={(e) => setUserFilter(setUserQuery)(e.target.value)}
              placeholder="Search name or email…"
              aria-label="Search members"
            />
            {userQuery && (
              <button type="button" className="adm-search__clear" onClick={() => setUserFilter(setUserQuery)('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
          </div>

          <select className="adm-field adm-field--auto" value={userRole} onChange={(e) => setUserFilter(setUserRole)(e.target.value)} aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="ADMIN">{t('role_admin')}</option>
            <option value="COUNSELOR">{t('role_counselor')}</option>
            <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
            <option value="MEMBER">{t('role_member')}</option>
          </select>

          <select className="adm-field adm-field--auto" value={userStatus} onChange={(e) => setUserFilter(setUserStatus)(e.target.value)} aria-label="Filter by verification">
            <option value="">Any status</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>

          <select className="adm-field adm-field--auto" value={userSort} onChange={(e) => setUserFilter(setUserSort)(e.target.value)} aria-label="Sort members">
            <option value="name">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="role">By role</option>
          </select>

          {/* With rows ticked the meta area gives way to the bulk bar: the count and
              the CSV button describe the filter, which is not what is being acted on. */}
          {selected > 0 ? (
            <div className="adm-bulk" role="group" aria-label="Actions for the selected members">
              <span className="adm-bulk__count">
                {bulkBusy && <RefreshCw size={12} className="adm-spin" aria-hidden="true" />}
                {selected} selected
              </span>

              <select
                className="adm-field adm-field--auto"
                value=""
                disabled={bulkOff}
                onChange={(e) => { if (e.target.value) handleBulkRole(e.target.value); }}
                aria-label="Set the role of every selected member"
              >
                <option value="">Set role…</option>
                {BULK_ROLES.map((role) => (
                  <option key={role} value={role}>{t(`role_${role.toLowerCase()}`)}</option>
                ))}
              </select>

              <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkReminders(true)}>
                <Bell size={13} /> Reminders on
              </button>
              <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkReminders(false)}>
                <BellOff size={13} /> Reminders off
              </button>
              <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkVerify(true)}>
                <ShieldCheck size={13} /> Verify
              </button>
              <button type="button" className="adm-ghost-btn" disabled={bulkOff} onClick={() => handleBulkVerify(false)}>
                <ShieldAlert size={13} /> Unverify
              </button>
              <button type="button" className="adm-ghost-btn adm-ghost-btn--danger" disabled={bulkOff} onClick={handleBulkDelete}>
                <Trash2 size={13} /> Delete
              </button>

              <span className="adm-toolbar__spacer" />

              <button type="button" className="adm-ghost-btn" disabled={bulkBusy} onClick={clearSelection}>
                <X size={13} /> Clear
              </button>
            </div>
          ) : (
            <>
              <span className="adm-toolbar__meta">
                {usersLoading
                  ? 'Loading…'
                  : usersTotalCount === userStats.total
                    ? memberCount(userStats.total)
                    : `${usersTotalCount} of ${userStats.total}`}
              </span>

              <button type="button" className="adm-ghost-btn" onClick={exportUsersCsv} disabled={exporting || !usersTotalCount}>
                {exporting
                  ? <RefreshCw size={13} className="adm-spin" aria-hidden="true" />
                  : <Download size={13} aria-hidden="true" />}
                {exporting ? 'Exporting' : 'CSV'}
              </button>
            </>
          )}
        </div>

        {users.length === 0 ? (
          usersLoading ? <Skeletons count={6} /> : (
            <EmptyState
              icon={Users}
              title="No members match"
              text="Nothing matches the current search and filters. Clear them to see the full roster."
            />
          )
        ) : (
          // Rows are held at reduced opacity while the next page loads. Swapping in
          // skeletons would collapse the table to another height and bounce the page.
          <div className={usersLoading ? 'adm-stale' : undefined} aria-busy={usersLoading || undefined}>
            {/* Desktop table */}
            <div className="adm-table-wrap adm-desk">
              <div className="adm-table-scroll">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th scope="col" className="adm-td-check">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          className="adm-check"
                          checked={allSelected}
                          disabled={!selectableIds.length}
                          onChange={toggleSelectPage}
                          aria-label="Select every member on this page"
                        />
                      </th>
                      <th scope="col">Member</th>
                      <th scope="col">Status</th>
                      <th scope="col">Role</th>
                      <th scope="col">Permissions</th>
                      <th scope="col">Joined</th>
                      <th scope="col" className="adm-td-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u._id}>
                        <td className="adm-td-check">{checkboxOf(u)}</td>
                        <td>{identityOf(u, 38)}</td>
                        <td>{verifyChipOf(u)}</td>
                        <td>{roleChipOf(u)}</td>
                        <td>{permissionsOf(u)}</td>
                        <td className="adm-td-dim">{shortDate(u.createdAt)}</td>
                        <td className="adm-td-right">
                          {u._id === user._id ? (
                            <span className="adm-self">Current session</span>
                          ) : (
                            <div className="adm-actions">
                              {roleSelectOf(u)}
                              <button
                                type="button"
                                className="adm-icon-btn"
                                data-tone="danger"
                                onClick={() => handleDeleteUser(u)}
                                aria-label={`Delete ${u.displayName}`}
                                title={`Delete ${u.displayName}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="adm-cards adm-cards--single adm-mob">
              {users.map((u) => (
                <div key={u._id} className="adm-card">
                  <div className="adm-card__head">
                    {checkboxOf(u)}
                    {identityOf(u, 34)}
                    {roleChipOf(u)}
                  </div>
                  <div className="adm-rule" />
                  <div className="adm-card__head">
                    {verifyChipOf(u)}
                    <span className="adm-card__stamp">Joined {shortDate(u.createdAt)}</span>
                  </div>
                  {permissionsOf(u, true)}
                  {u._id !== user._id && (
                    <div className="adm-card__foot">
                      {roleSelectOf(u)}
                      <button
                        type="button"
                        className="adm-icon-btn"
                        data-tone="danger"
                        onClick={() => handleDeleteUser(u)}
                        aria-label={`Delete ${u.displayName}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <Pager
          page={usersPage}
          totalPages={usersTotalPages}
          onChange={goUsersPage}
          label={{ previous: t('previous'), next: t('next'), of: t('page_of')(usersPage, usersTotalPages) }}
        />
      </>
    );
  };

  /* ── Tab: pending signups ───────────────────────────────────────────── */

  const renderSignups = () => {
    if (signupsLoading && !signups.length) return <Skeletons count={3} />;

    if (!signups.length) {
      return (
        <EmptyState
          icon={UserPlus}
          title="Nobody is mid-signup"
          text="A row appears here only while someone sits between the registration form and the code emailed to them. Unfinished signups self-destruct 15 minutes after they start, so an empty list is the normal state."
        />
      );
    }

    return (
      <>
        <div className="adm-toolbar">
          <span className="adm-toolbar__meta">
            {liveSignups} awaiting a code · {signups.length} in the queue
          </span>
          <span className="adm-toolbar__spacer" />
          <button type="button" className="adm-ghost-btn" onClick={fetchSignups} disabled={signupsLoading}>
            <RefreshCw size={13} className={signupsLoading ? 'adm-spin' : undefined} /> Refresh
          </button>
        </div>

        <div className={signupsLoading ? 'adm-cards adm-stale' : 'adm-cards'}>
          {signups.map((signup) => {
            const minutes = minutesUntil(signup.otpExpires);
            const tone = signup.expired ? 'danger' : 'warn';
            return (
              <div key={signup._id} className="adm-card" data-tone={tone}>
                <div className="adm-card__head">
                  <div className="adm-ident__text">
                    <span className="adm-ident__name">{signup.displayName || 'Unnamed'}</span>
                    <span className="adm-ident__mail">{signup.email}</span>
                  </div>
                  <span className="adm-chip" data-tone={tone}>
                    {signup.expired ? <AlertTriangle size={11} /> : <Clock size={11} />}
                    {signup.expired ? 'Code expired' : `${minutes} min left`}
                  </span>
                </div>

                <div className="adm-rule" />

                <div className="adm-card__head">
                  <span className="adm-card__stamp">Started {sinceLabel(signup.createdAt)}</span>
                  <span className="adm-card__stamp">{stamp(signup.createdAt)}</span>
                </div>

                <div className="adm-card__foot">
                  <button
                    type="button"
                    className="adm-ghost-btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleResendSignup(signup)}
                    disabled={signupBusyId === signup._id}
                  >
                    <RefreshCw size={13} className={signupBusyId === signup._id ? 'adm-spin' : undefined} />
                    {signupBusyId === signup._id ? 'Sending' : 'Resend code'}
                  </button>
                  <button
                    type="button"
                    className="adm-icon-btn"
                    data-tone="danger"
                    onClick={() => handleDeleteSignup(signup)}
                    aria-label={`Delete the signup for ${signup.email}`}
                    title={`Delete the signup for ${signup.email}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );
  };

  /* ── Tab: thread approvals ──────────────────────────────────────────── */

  const renderApprovals = (list, kind) => {
    const isDeletion = kind === 'deletion';
    if (!list.length) {
      return (
        <EmptyState
          icon={isDeletion ? Trash2 : RotateCcw}
          title={isDeletion ? 'No deletion requests' : 'No restore requests'}
          text={isDeletion
            ? 'Nothing is waiting for approval. Members ask here before a mirror thread is removed.'
            : 'Nothing is waiting to come back out of the archive.'}
        />
      );
    }
    return (
      <div className="adm-cards">
        {list.map((req) => (
          <div key={req._id} className="adm-card">
            <div className="adm-card__head">
              <span className="adm-chip" data-tone={isDeletion ? 'warn' : 'brand'}>
                {isDeletion ? 'Pending approval' : 'Restore pending'}
              </span>
              <span className="adm-card__stamp">
                {isDeletion ? shortDate(req.deletionRequestedAt) : 'Needs verification'}
              </span>
            </div>

            <Flow from={req.sender?.displayName} to={req.receiver?.displayName} />

            <div className="adm-card__foot">
              <button
                type="button"
                className={`btn ${isDeletion ? 'btn-success' : 'btn-primary'}`}
                style={{ flex: 1 }}
                onClick={() => (isDeletion ? handleApproveDeletion(req._id) : handleApproveRestore(req._id))}
              >
                {isDeletion ? <CheckCircle size={14} /> : <RotateCcw size={14} />}
                {isDeletion ? 'Approve' : 'Restore'}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => (isDeletion ? handleRejectDeletion(req._id) : handleRejectRestore(req._id))}
              >
                <X size={14} /> {isDeletion ? 'Reject' : 'Dismiss'}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  /* ── Tab: archive ───────────────────────────────────────────────────── */

  const renderArchive = () => {
    if (!recentlyDeleted.length) {
      return (
        <EmptyState
          icon={History}
          title="Archive is empty"
          text={`No deleted threads are being held. Approved deletions stay recoverable here for ${RETENTION_DAYS} days.`}
        />
      );
    }
    return (
      <div className="adm-cards">
        {recentlyDeleted.map((log) => {
          const deletedAt = new Date(log.deletedAt);
          const expiry = new Date(deletedAt.getTime() + RETENTION_DAYS * 86400000);
          const daysLeft = Math.max(0, Math.ceil((expiry - new Date()) / 86400000));
          const percentLeft = Math.max(0, Math.min(100, (daysLeft / RETENTION_DAYS) * 100));
          const tone = daysLeft < 15 ? 'var(--danger)' : daysLeft < 30 ? 'var(--warning)' : 'var(--success)';
          const toneName = daysLeft < 15 ? 'danger' : daysLeft < 30 ? 'warn' : 'ok';

          return (
            <div key={log._id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-chip" data-tone="muted">Archived log</span>
                <span className="adm-card__stamp">Deleted {shortDate(log.deletedAt)}</span>
              </div>

              <Flow from={log.sender?.displayName} to={log.receiver?.displayName} />

              <div className="adm-meter">
                <div className="adm-meter__row">
                  <span className="adm-meter__label">Retention window</span>
                  <span className="adm-meter__value" data-tone={toneName}>
                    <Clock size={11} style={{ verticalAlign: '-1px', marginRight: '0.2rem' }} />
                    {daysLeft} days left
                  </span>
                </div>
                <Meter percent={percentLeft} tone={tone} />
                <div className="adm-meter__foot">
                  <span>Purges {shortDate(expiry)}</span>
                  <span>{RETENTION_DAYS}-day policy</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ── Tab: system requests ───────────────────────────────────────────── */

  const renderTickets = () => (
    <>
      <div className="adm-toolbar">
        <select
          className="adm-field adm-field--auto"
          value={ticketStatus}
          onChange={(e) => setTicketStatus(e.target.value)}
          aria-label="Filter requests by status"
        >
          <option value="">All requests</option>
          <option value="open">Open</option>
          <option value="in-progress">In progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <span className="adm-toolbar__spacer" />
        <span className="adm-toolbar__meta">
          {openTickets} open · {tickets.length} total
        </span>
      </div>

      {visibleTickets.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No requests here"
          text="Nothing matches this filter. Members raise bugs, feature ideas and questions from the System Requests module."
        />
      ) : (
        <div className="adm-cards">
          {visibleTickets.map((ticket) => (
            <div key={ticket._id} className="adm-card">
              <div className="adm-card__head">
                <span className="adm-chip" data-tone={TICKET_TONE[ticket.type] || 'muted'}>{ticket.type}</span>
                <span className="adm-card__stamp">by {ticket.createdBy?.displayName || 'Member'}</span>
              </div>

              <div>
                <h4 className="adm-card__title">{ticket.title}</h4>
                <p className="adm-card__body" style={{ marginTop: '0.2rem' }}>{ticket.description}</p>
              </div>

              {ticket.adminResponse && (
                <div className="adm-quote">
                  <span className="adm-quote__who"><CheckCircle size={11} /> Admin response</span>
                  <p className="adm-quote__text">{ticket.adminResponse}</p>
                </div>
              )}

              <div className="adm-card__foot">
                <select
                  className="adm-field"
                  value={ticket.status}
                  onChange={(e) => handleUpdateTicketStatus(ticket._id, e.target.value)}
                  aria-label={`Status for ${ticket.title}`}
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button type="button" className="adm-ghost-btn" onClick={() => handleAdminResponse(ticket)}>
                  <MessageSquare size={13} /> {ticket.adminResponse ? 'Edit reply' : 'Reply'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  /* ── Tab: outgoing email log ────────────────────────────────────────── */

  const renderEmails = () => (
    <>
      <div className="adm-toolbar">
        <div className="adm-search">
          <Search size={15} className="adm-search__icon" aria-hidden="true" />
          <input
            className="adm-field"
            type="search"
            value={emailsSearch}
            onChange={(e) => { setEmailsSearch(e.target.value); setEmailsPage(1); }}
            placeholder={t('email_search_placeholder')}
            aria-label="Search the email log"
          />
          {emailsSearch && (
            <button
              type="button"
              className="adm-search__clear"
              onClick={() => { setEmailsSearch(''); setEmailsPage(1); }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <select
          className="adm-field adm-field--auto"
          value={emailsStatus}
          onChange={(e) => { setEmailsStatus(e.target.value); setEmailsPage(1); }}
          aria-label="Filter by delivery status"
        >
          <option value="">{t('email_all_statuses')}</option>
          <option value="sent">{t('email_status_sent')}</option>
          <option value="failed">{t('email_status_failed')}</option>
        </select>

        <span className="adm-toolbar__meta">
          {emailsLoading ? 'Loading…' : `${emailsTotalCount} logged`}
        </span>
      </div>

      {emailsLoading && emails.length === 0 ? (
        <Skeletons count={5} />
      ) : emails.length === 0 ? (
        <EmptyState icon={Mail} title={t('email_no_logs')} text="Every outgoing notice, OTP and dues reminder is recorded here once sent." />
      ) : (
        <>
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">{t('email_to')}</th>
                    <th scope="col">{t('email_subject')}</th>
                    <th scope="col">{t('email_sent_at')}</th>
                    <th scope="col">{t('email_status')}</th>
                    <th scope="col" className="adm-td-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((mail) => (
                    <tr key={mail._id}>
                      <td style={{ fontWeight: 700 }}>{mail.to}</td>
                      <td style={{ maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mail.subject}
                      </td>
                      <td className="adm-td-dim">
                        {new Date(mail.sentAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td>
                        <span className="adm-chip" data-tone={mail.status === 'sent' ? 'ok' : 'danger'}>
                          {mail.status === 'sent' ? t('email_status_sent') : t('email_status_failed')}
                        </span>
                      </td>
                      <td className="adm-td-right">
                        <div className="adm-actions">
                          <button type="button" className="adm-ghost-btn" onClick={() => setEmailPreview(mail)}>
                            <Eye size={13} /> View
                          </button>
                          <button
                            type="button"
                            className="adm-ghost-btn"
                            onClick={() => handleResendEmail(mail._id)}
                            disabled={resendingId === mail._id}
                          >
                            <RefreshCw size={13} className={resendingId === mail._id ? 'adm-spin' : undefined} />
                            {resendingId === mail._id ? 'Resending' : 'Resend'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-cards adm-cards--single adm-mob">
            {emails.map((mail) => (
              <div key={mail._id} className="adm-card">
                <div className="adm-card__head">
                  <span className="adm-ident__mail">To: {mail.to}</span>
                  <span className="adm-chip" data-tone={mail.status === 'sent' ? 'ok' : 'danger'}>
                    {mail.status === 'sent' ? 'Sent' : 'Failed'}
                  </span>
                </div>
                <div>
                  <h4 className="adm-card__title">{mail.subject}</h4>
                  <span className="adm-card__stamp">{new Date(mail.sentAt).toLocaleString()}</span>
                </div>
                <div className="adm-card__foot">
                  <button type="button" className="adm-ghost-btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEmailPreview(mail)}>
                    <Eye size={13} /> View
                  </button>
                  <button
                    type="button"
                    className="adm-ghost-btn"
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => handleResendEmail(mail._id)}
                    disabled={resendingId === mail._id}
                  >
                    <RefreshCw size={13} className={resendingId === mail._id ? 'adm-spin' : undefined} />
                    {resendingId === mail._id ? 'Resending' : 'Resend'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pager
            page={emailsPage}
            totalPages={emailsTotalPages}
            onChange={setEmailsPage}
            label={{ previous: t('previous'), next: t('next'), of: t('page_of')(emailsPage, emailsTotalPages) }}
          />
        </>
      )}
    </>
  );

  /* ── Tab: admin audit log ───────────────────────────────────────────── */

  // before/after are arbitrary JSON blobs. They go behind an expander rather than
  // into the table, which is the difference between a readable feed and a dump.
  const auditDataOf = (entry) => (
    <div className="adm-diff">
      {entry.before && (
        <div className="adm-diff__side">
          <span className="adm-diff__label">Before</span>
          <pre className="adm-pre">{JSON.stringify(entry.before, null, 2)}</pre>
        </div>
      )}
      {entry.after && (
        <div className="adm-diff__side">
          <span className="adm-diff__label">After</span>
          <pre className="adm-pre">{JSON.stringify(entry.after, null, 2)}</pre>
        </div>
      )}
      {entry.ip && <span className="adm-card__stamp">Recorded from {entry.ip}</span>}
    </div>
  );

  const auditToggleOf = (entry, idPrefix, openLabel) => {
    const open = auditOpen === entry._id;
    return (
      <button
        type="button"
        className="adm-expand"
        aria-expanded={open}
        aria-controls={`${idPrefix}${entry._id}`}
        onClick={() => setAuditOpen(open ? null : entry._id)}
      >
        <ChevronDown
          size={13}
          className={open ? 'adm-expand__caret adm-expand__caret--open' : 'adm-expand__caret'}
          aria-hidden="true"
        />
        {open ? 'Hide data' : openLabel}
      </button>
    );
  };

  const renderAudit = () => (
    <>
      <div className="adm-toolbar">
        <div className="adm-search">
          <Search size={15} className="adm-search__icon" aria-hidden="true" />
          <input
            className="adm-field"
            type="search"
            value={auditSearch}
            onChange={(e) => { setAuditSearch(e.target.value); setAuditPage(1); }}
            placeholder="Search summary, actor or target…"
            aria-label="Search the audit log"
          />
          {auditSearch && (
            <button
              type="button"
              className="adm-search__clear"
              onClick={() => { setAuditSearch(''); setAuditPage(1); }}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Built from the response's own `actions`, never a hard-coded list — a
            filter this page invented could only ever return an empty page. */}
        <select
          className="adm-field adm-field--auto"
          value={auditAction}
          onChange={(e) => { setAuditAction(e.target.value); setAuditPage(1); }}
          aria-label="Filter by action"
        >
          <option value="">All actions</option>
          {auditActions.map((action) => (
            <option key={action} value={action}>{auditLabel(action)}</option>
          ))}
        </select>

        <div className="adm-dates">
          <label className="adm-dates__field">
            <span className="adm-dates__label">From</span>
            <input
              type="date"
              className="adm-field"
              value={auditFrom}
              max={auditTo || undefined}
              onChange={(e) => { setAuditFrom(e.target.value); setAuditPage(1); }}
            />
          </label>
          <label className="adm-dates__field">
            <span className="adm-dates__label">To</span>
            <input
              type="date"
              className="adm-field"
              value={auditTo}
              min={auditFrom || undefined}
              onChange={(e) => { setAuditTo(e.target.value); setAuditPage(1); }}
            />
          </label>
        </div>

        <span className="adm-toolbar__meta">
          {auditLoading ? 'Loading…' : `${auditTotalCount} entries`}
        </span>
      </div>

      {auditEntries.length === 0 ? (
        auditLoading ? <Skeletons count={6} /> : (
          <EmptyState
            icon={ScrollText}
            title="No admin actions recorded yet."
            text="Every role change, verification, deletion and approval an administrator makes is written here and kept for a year."
          />
        )
      ) : (
        <div className={auditLoading ? 'adm-stale' : undefined} aria-busy={auditLoading || undefined}>
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Action</th>
                    <th scope="col">Target</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEntries.map((entry) => {
                    const hasData = !!(entry.before || entry.after);
                    const open = auditOpen === entry._id;
                    return (
                      <Fragment key={entry._id}>
                        <tr>
                          <td className="adm-td-dim">{stamp(entry.createdAt)}</td>
                          <td>
                            <div className="adm-ident__text">
                              <span className="adm-ident__name">{entry.actorName || 'Unknown'}</span>
                              <span className="adm-ident__mail">{entry.actorEmail || '—'}</span>
                            </div>
                          </td>
                          <td>
                            <span className="adm-chip" data-tone={auditTone(entry.action)}>
                              {auditLabel(entry.action)}
                            </span>
                          </td>
                          <td className="adm-td-dim">{entry.targetLabel || '—'}</td>
                          <td>
                            <div className="adm-audit__cell">
                              <span className="adm-audit__summary">{entry.summary}</span>
                              {hasData && auditToggleOf(entry, 'adm-audit-', 'Data')}
                            </div>
                          </td>
                        </tr>
                        {hasData && open && (
                          <tr id={`adm-audit-${entry._id}`}>
                            <td colSpan={5}>{auditDataOf(entry)}</td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="adm-cards adm-cards--single adm-mob">
            {auditEntries.map((entry) => {
              const hasData = !!(entry.before || entry.after);
              const open = auditOpen === entry._id;
              return (
                <div key={entry._id} className="adm-card">
                  <div className="adm-card__head">
                    <span className="adm-chip" data-tone={auditTone(entry.action)}>
                      {auditLabel(entry.action)}
                    </span>
                    <span className="adm-card__stamp">{stamp(entry.createdAt)}</span>
                  </div>
                  <p className="adm-card__body">{entry.summary}</p>
                  <div className="adm-card__head">
                    <span className="adm-ident__mail">{entry.actorName || 'Unknown'}</span>
                    <span className="adm-card__stamp">{entry.targetLabel || '—'}</span>
                  </div>
                  {hasData && (
                    <>
                      {auditToggleOf(entry, 'adm-audit-m-', 'Show data')}
                      {open && <div id={`adm-audit-m-${entry._id}`}>{auditDataOf(entry)}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Pager
        page={auditPage}
        totalPages={auditTotalPages}
        onChange={setAuditPage}
        label={{ previous: t('previous'), next: t('next'), of: t('page_of')(auditPage, auditTotalPages) }}
      />
    </>
  );

  /* ── Tab: platform limits ───────────────────────────────────────────── */

  const renderLimits = () => {
    if (limitsLoading && !limitsData) {
      return (
        <>
          <div className="adm-stats" style={{ marginTop: 0, marginBottom: 'var(--sp-4)' }} aria-hidden="true">
            <div className="adm-skel" /><div className="adm-skel" /><div className="adm-skel" />
          </div>
          <Skeletons count={3} />
        </>
      );
    }

    if (limitsError) {
      return (
        <div className="adm-empty">
          <AlertTriangle size={38} className="adm-empty__icon" style={{ color: 'var(--danger)', opacity: 1 }} />
          <h4 className="adm-empty__title">Could not read resource stats</h4>
          <p className="adm-empty__text">{limitsError}</p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '0.6rem' }} onClick={fetchPlatformLimits}>
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      );
    }

    if (!limitsData) return null;

    const { database, emails: emailUsage, cloudinary } = limitsData;
    const mongoLimit = database.limitBytes || 512 * 1024 * 1024;
    const mongoPercent = Math.min(100, Math.max(0.1, (database.dataSize / mongoLimit) * 100));
    const emailLimit = emailUsage.limit || 500;
    const emailPercent = Math.min(100, Math.max(0.1, (emailUsage.sentLast24h / emailLimit) * 100));

    const cloudMeters = [
      cloudinary?.credits && {
        key: 'credits', label: 'Monthly credits',
        text: `${(cloudinary.credits.usage || 0).toFixed(2)} / ${cloudinary.credits.limit || 25}`,
        percent: cloudinary.credits.usedPercent || 0,
      },
      cloudinary?.storage && {
        key: 'storage', label: 'Media storage',
        text: `${formatBytes(cloudinary.storage.usage)} / ${formatBytes(cloudinary.storage.limit)}`,
        percent: cloudinary.storage.usedPercent || 0,
      },
      cloudinary?.transformations && {
        key: 'transforms', label: 'Image transformations',
        text: `${(cloudinary.transformations.usage || 0).toLocaleString()} / ${(cloudinary.transformations.limit || 25000).toLocaleString()}`,
        percent: cloudinary.transformations.usedPercent || 0,
      },
      cloudinary?.bandwidth && {
        key: 'bandwidth', label: 'Delivery bandwidth',
        text: `${formatBytes(cloudinary.bandwidth.usage)} / ${formatBytes(cloudinary.bandwidth.limit)}`,
        percent: cloudinary.bandwidth.usedPercent || 0,
      },
    ].filter(Boolean);

    const headline = [
      {
        key: 'db', icon: Database, tone: 'var(--success)', label: 'Database storage',
        value: formatBytes(database.dataSize), meta: `${mongoPercent.toFixed(2)}% of 512 MB free tier`,
      },
      {
        key: 'cloud', icon: Cloud, tone: 'var(--info)', label: 'Cloudinary credits',
        value: cloudinary?.credits ? `${(cloudinary.credits.usage || 0).toFixed(2)} / ${cloudinary.credits.limit || 25}` : 'N/A',
        meta: cloudinary?.credits ? `${(cloudinary.credits.usedPercent || 0).toFixed(1)}% credit usage` : 'Free plan (25 credits)',
      },
      {
        key: 'mail', icon: Mail, tone: 'var(--tone-violet)', label: 'Daily emails',
        value: `${emailUsage.sentLast24h} / ${emailLimit}`, meta: `${emailPercent.toFixed(1)}% of the 24h cap`,
      },
    ];

    return (
      <div className="adm-limits">
        <div className="adm-toolbar">
          <span className="adm-toolbar__meta">
            Live usage across the free tiers this platform runs on.
          </span>
          <span className="adm-toolbar__spacer" />
          <button type="button" className="adm-ghost-btn" onClick={fetchPlatformLimits} disabled={limitsLoading}>
            <RefreshCw size={13} className={limitsLoading ? 'adm-spin' : undefined} /> Refresh stats
          </button>
        </div>

        <div className="adm-stats" style={{ marginTop: 0 }}>
          {headline.map(({ key, icon: Icon, tone, label, value, meta }) => (
            <div key={key} className="adm-stat adm-stat--static" style={{ '--tone': tone }}>
              <span className="adm-stat__icon"><Icon size={19} /></span>
              <span className="adm-stat__text">
                <span className="adm-stat__value">{value}</span>
                <span className="adm-stat__label">{label}</span>
                <span className="adm-card__stamp" style={{ marginTop: '0.15rem' }}>{meta}</span>
              </span>
            </div>
          ))}
        </div>

        {/* Written by components/UsageTrendChart.jsx against this exact prop set. */}
        <UsageTrendChart
          snapshots={history}
          loading={historyLoading}
          days={historyDays}
          onDaysChange={setHistoryDays}
        />

        <div className="adm-limit-grid">
          {/* MongoDB */}
          <section className="adm-limit-card" data-tone="ok">
            <div className="adm-limit-head">
              <h4 className="adm-limit-head__name"><Database size={17} /> MongoDB Atlas (M0)</h4>
              <span className="adm-chip" data-tone="ok">Database</span>
            </div>
            <p className="adm-fine">
              The shared M0 cluster caps out at <strong>512 MB</strong>. Passing it locks writes, which
              blocks signups, threads and transactions.
            </p>
            <div className="adm-meter">
              <div className="adm-meter__row">
                <span className="adm-meter__label">Storage consumption</span>
                <span className="adm-meter__value" data-tone={mongoPercent > 80 ? 'danger' : undefined}>
                  {formatBytes(database.dataSize)} / 512 MB
                </span>
              </div>
              <Meter percent={mongoPercent} tone={usageTone(mongoPercent)} />
              <div className="adm-meter__foot">
                <span>Logical {formatBytes(database.dataSize)}</span>
                <span>Allocated {formatBytes(database.storageSize)}</span>
              </div>
            </div>
            <div>
              <div className="adm-subhead">
                <span>Collections</span>
                <span>{database.collections.length}</span>
              </div>
              <div className="adm-mini-scroll" style={{ marginTop: '0.4rem' }}>
                <table className="adm-mini">
                  <thead>
                    <tr><th scope="col">Collection</th><th scope="col">Docs</th><th scope="col">Size</th></tr>
                  </thead>
                  <tbody>
                    {database.collections.map((col) => (
                      <tr key={col.name}>
                        <td>{col.name}</td>
                        <td>{col.count}</td>
                        <td>{col.size > 0 ? formatBytes(col.size) : '< 1 KB'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Cloudinary */}
          <section className="adm-limit-card" data-tone="info">
            <div className="adm-limit-head">
              <h4 className="adm-limit-head__name"><Cloud size={17} /> Cloudinary media</h4>
              <span className="adm-chip" data-tone="info">Media</span>
            </div>
            <p className="adm-fine">
              Hosts profile pictures and resource covers. The free tier gives <strong>25 monthly credits</strong> —
              1 credit is 1 GB of storage, 1 GB of bandwidth, or 1,000 transformations.
            </p>
            {cloudMeters.length ? (
              <>
                {cloudMeters.map(({ key, label, text, percent }) => (
                  <div key={key} className="adm-meter">
                    <div className="adm-meter__row">
                      <span className="adm-meter__label">{label}</span>
                      <span className="adm-meter__value">{text}</span>
                    </div>
                    <Meter percent={percent} tone={usageTone(percent)} />
                  </div>
                ))}
                <span className="adm-card__stamp" style={{ textAlign: 'right' }}>
                  Plan: {cloudinary.plan} · live stats
                </span>
              </>
            ) : (
              <div className="adm-note" data-tone="info">
                <Info size={14} />
                <span>Live usage is unavailable right now. Assume the standard free tier (25 credits per month).</span>
              </div>
            )}
          </section>

          {/* Gmail SMTP */}
          <section className="adm-limit-card" data-tone="violet">
            <div className="adm-limit-head">
              <h4 className="adm-limit-head__name"><Mail size={17} /> Gmail outgoing SMTP</h4>
              <span className="adm-chip" data-tone="violet">Email</span>
            </div>
            <p className="adm-fine">
              Youth notices, verification OTPs and dues reminders all leave through SMTP. The free Gmail
              relay stops at <strong>500 emails a day</strong>.
            </p>
            <div className="adm-meter">
              <div className="adm-meter__row">
                <span className="adm-meter__label">Sent in the last 24 hours</span>
                <span className="adm-meter__value" data-tone={emailPercent > 80 ? 'danger' : undefined}>
                  {emailUsage.sentLast24h} / {emailLimit}
                </span>
              </div>
              <Meter percent={emailPercent} tone={usageTone(emailPercent)} />
              <div className="adm-meter__foot">
                <span>{Math.max(0, emailLimit - emailUsage.sentLast24h)} remaining</span>
                <span>Rolling window</span>
              </div>
            </div>
            <div className="adm-note" data-tone="violet">
              <Info size={14} />
              <span>
                <strong>Recommendation:</strong> keep name and email change requests deliberate, and stagger bulk
                notices so a single evening does not exhaust the daily cap.
              </span>
            </div>
          </section>

          {/* Infrastructure */}
          <section className="adm-limit-card" data-tone="warn">
            <div className="adm-limit-head">
              <h4 className="adm-limit-head__name"><Cpu size={17} /> Compute &amp; deployment</h4>
              <span className="adm-chip" data-tone="warn">Infrastructure</span>
            </div>

            <div>
              <div className="adm-subhead"><span>▲ Vercel — frontend (Hobby)</span></div>
              <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
                <li><strong>Bandwidth:</strong> 100 GB per month.</li>
                <li><strong>Serverless execution:</strong> 100 GB-hours per month.</li>
                <li><strong>Function timeout:</strong> 10 seconds.</li>
              </ul>
            </div>

            <div>
              <div className="adm-subhead">
                <span>⬡ Render — backend</span>
                <span className="adm-chip" data-tone="ok">Ping active</span>
              </div>
              <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
                <li><strong>Compute:</strong> 750 free instance hours per month.</li>
                <li><strong>Sleep:</strong> spins down after 15 minutes idle.</li>
                <li><strong>Anti-sleep:</strong> a self-ping runs every 14 minutes in production.</li>
              </ul>
            </div>

            <div>
              <div className="adm-subhead"><span><GitBranch size={13} style={{ verticalAlign: '-2px' }} /> GitHub</span></div>
              <ul className="adm-spec" style={{ marginTop: '0.35rem' }}>
                <li><strong>Actions:</strong> 2,000 build minutes per month.</li>
                <li><strong>Git LFS storage:</strong> 1 GB.</li>
                <li><strong>Git LFS bandwidth:</strong> 1 GB per month.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    );
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  const panels = {
    'users': renderUsers,
    'signups': renderSignups,
    'deletion-requests': () => renderApprovals(deletionRequests, 'deletion'),
    'restore-requests': () => renderApprovals(restoreRequests, 'restore'),
    'recently-deleted': renderArchive,
    'tickets': renderTickets,
    'emails': renderEmails,
    'audit': renderAudit,
    'limits': renderLimits,
  };

  return (
    <div className="adm-page">
      <PageHeader
        icon={ShieldCheck}
        title="Admin Dashboard"
        subtitle="System administration and platform integrity control."
        actions={
          <>
            {lastSync && (
              <span className="adm-sync">
                <Clock size={12} aria-hidden="true" />
                Synced {new Date(lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              type="button"
              className="btn btn-secondary page-header-btn"
              onClick={refreshAll}
              disabled={refreshing || loading}
            >
              <RefreshCw size={15} className={refreshing ? 'adm-spin' : undefined} aria-hidden="true" />
              <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
            </button>
          </>
        }
      />

      {/* The old build set this state from six fetchers and rendered it
          nowhere, so a failing endpoint just showed an empty tab. */}
      {error && (
        <div className="adm-error" role="alert">
          <AlertTriangle size={17} aria-hidden="true" />
          <span className="adm-error__text">{error}</span>
          <button type="button" className="adm-error__btn" onClick={refreshAll}>Retry</button>
          <button type="button" className="adm-error__btn" onClick={() => setError('')} aria-label="Dismiss">
            <X size={13} />
          </button>
        </div>
      )}

      <div className="adm-stats">
        {stats.map(({ id, icon: Icon, value, label, tone, tab, onPick }) => (
          <button
            key={id}
            type="button"
            className="adm-stat"
            style={{ '--tone': tone }}
            onClick={() => { if (onPick) onPick(); setUsersPage(1); setActiveTab(tab); }}
          >
            <span className="adm-stat__icon"><Icon size={19} aria-hidden="true" /></span>
            <span className="adm-stat__text">
              <span className="adm-stat__value">{loading ? '—' : value}</span>
              <span className="adm-stat__label">{label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="adm-body">
        <nav className="adm-nav" role="tablist" aria-label="Admin sections">
          <span className="adm-nav__title">Control centre</span>
          {tabs.map((tab, index) => {
            const TabIcon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`adm-tab-${tab.id}`}
                aria-controls={`adm-panel-${tab.id}`}
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                ref={(el) => { tabRefs.current[index] = el; }}
                className="adm-tab"
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
              >
                <span className="adm-tab__side">
                  <TabIcon size={16} className="adm-tab__icon" aria-hidden="true" />
                  <span>{tab.label}</span>
                </span>
                {tab.count > 0 && (
                  <span className="adm-count" data-tone={tab.tone} aria-label={`${tab.count} awaiting attention`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div
          className="adm-panel"
          role="tabpanel"
          id={`adm-panel-${activeTab}`}
          aria-labelledby={`adm-tab-${activeTab}`}
          tabIndex={-1}
        >
          {loading ? <Skeletons count={6} /> : panels[activeTab]?.()}
        </div>
      </div>

      <PopupModal
        isOpen={popup.isOpen}
        onClose={() => setPopup((p) => ({ ...p, isOpen: false }))}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
        isPrompt={popup.isPrompt}
        promptValue={popup.promptValue}
        onPromptChange={(val) => setPopup((p) => ({ ...p, promptValue: val }))}
      />

      {/* Email preview drawer */}
      {emailPreview && (
        <div className="adm-drawer-backdrop" onClick={() => setEmailPreview(null)}>
          <div
            className="adm-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Email preview"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-drawer__head">
              <h3 className="adm-drawer__title"><Mail size={19} /> Email preview</h3>
              <button
                type="button"
                className="adm-icon-btn"
                data-tone="muted"
                onClick={() => setEmailPreview(null)}
                aria-label="Close preview"
                autoFocus
              >
                <X size={15} />
              </button>
            </div>

            <div className="adm-drawer__meta">
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">To</span>
                <span className="adm-drawer__val">{emailPreview.to}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Subject</span>
                <span className="adm-drawer__val">{emailPreview.subject}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Sent</span>
                <span className="adm-drawer__val">{new Date(emailPreview.sentAt).toLocaleString()}</span>
              </div>
              <div className="adm-drawer__row">
                <span className="adm-drawer__key">Status</span>
                <span className="adm-chip" data-tone={emailPreview.status === 'sent' ? 'ok' : 'danger'}>
                  {emailPreview.status === 'sent' ? 'Delivered' : 'Delivery failed'}
                </span>
              </div>
              {emailPreview.error && (
                <div className="adm-drawer__err"><strong>Error:</strong> {emailPreview.error}</div>
              )}
            </div>

            <div className="adm-drawer__body">
              <span className="adm-drawer__key">Body</span>
              <iframe
                className="adm-drawer__frame"
                srcDoc={emailPreview.html}
                title="Email body preview"
                sandbox=""
              />
            </div>

            <div className="adm-drawer__foot">
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={() => { handleResendEmail(emailPreview._id); setEmailPreview(null); }}
              >
                <RefreshCw size={15} /> Resend email
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setEmailPreview(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
