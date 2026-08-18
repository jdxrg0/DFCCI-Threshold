import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PopupModal from '../components/PopupModal';
import PageHeader from '../components/PageHeader';
import { renderAvatarHelper } from '../utils/avatarHelper';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle,
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
  Mail,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
  Zap,
} from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   Admin Dashboard — /admin

   Seven tabs over five APIs:
     users               GET  /users                        (+ role, delete,
                                                              reminders, rename
                                                              request, date power)
     deletion-requests   GET  /threads/admin/deletion-requests   (+ approve/reject)
     restore-requests    GET  /threads/admin/restore-requests    (+ approve/reject)
     recently-deleted    GET  /threads/admin/recently-deleted
     tickets             GET  /tickets                       (+ PATCH /:id/admin)
     emails              GET  /emails                        (+ POST /:id/resend)
     limits              GET  /users/admin/platform-limits

   Everything boots in parallel so the badge counts and the KPI rail are
   correct on first paint; switching a tab re-fetches just that tab. The
   presentation lives in styles/admin.css — do not reintroduce inline colour
   here, it is what stopped this page working on the light themes.
   ────────────────────────────────────────────────────────────────────────── */

const USERS_PER_PAGE = 12;
const EMAILS_PER_PAGE = 10;
const RETENTION_DAYS = 60;

const ROLE_ORDER = { ADMIN: 0, COUNSELOR: 1, YOUTH_TREASURER: 2, MEMBER: 3 };

const TICKET_TONE = { bug: 'danger', feature: 'info', question: 'violet' };

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

  // Users tab controls
  const [userQuery, setUserQuery] = useState('');
  const [userRole, setUserRole] = useState('');
  const [userStatus, setUserStatus] = useState('');
  const [userSort, setUserSort] = useState('name');
  const [usersPage, setUsersPage] = useState(1);

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

  const [popup, setPopup] = useState({
    isOpen: false, title: '', message: '', onConfirm: null,
    isAlert: false, isPrompt: false, promptValue: '',
  });

  const bootedRef = useRef(false);
  const tabRefs = useRef([]);

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

  const fetchUsers = useCallback(() => load('/users', setUsers, 'members'), [load]);
  const fetchDeletionRequests = useCallback(
    () => load('/threads/admin/deletion-requests', setDeletionRequests, 'deletion requests'), [load]);
  const fetchRestoreRequests = useCallback(
    () => load('/threads/admin/restore-requests', setRestoreRequests, 'restore requests'), [load]);
  const fetchRecentlyDeleted = useCallback(
    () => load('/threads/admin/recently-deleted', setRecentlyDeleted, 'the deletion archive'), [load]);
  const fetchTickets = useCallback(() => load('/tickets', setTickets, 'system requests'), [load]);

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
        fetchUsers(), fetchDeletionRequests(), fetchRestoreRequests(),
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
    if (activeTab === 'users') fetchUsers();
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

  // Any change to the result set sends the pager home, so a filter can never
  // leave the admin stranded on a page that no longer exists.
  const setUserFilter = (setter) => (value) => { setter(value); setUsersPage(1); };

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.allSettled([
      fetchUsers(), fetchDeletionRequests(), fetchRestoreRequests(),
      fetchRecentlyDeleted(), fetchTickets(), fetchEmails(),
      limitsData ? fetchPlatformLimits() : Promise.resolve(),
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

  const verifiedUsers = users.filter((u) => u.isVerified).length;
  const pendingApprovals = deletionRequests.length + restoreRequests.length;
  const openTickets = tickets.filter((tk) => tk.status === 'open' || tk.status === 'in-progress').length;

  const tabs = useMemo(() => [
    { id: 'users', label: 'Members', icon: Users, count: 0 },
    { id: 'deletion-requests', label: 'Deletion', icon: Trash2, count: deletionRequests.length, tone: 'danger' },
    { id: 'restore-requests', label: 'Restore', icon: RotateCcw, count: restoreRequests.length, tone: 'warn' },
    { id: 'recently-deleted', label: 'Archive', icon: History, count: 0 },
    { id: 'tickets', label: 'Requests', icon: MessageSquare, count: openTickets, tone: 'violet' },
    { id: 'emails', label: t('admin_emails_tab') || 'Emails', icon: Mail, count: 0 },
    { id: 'limits', label: 'Platform Limits', icon: HardDrive, count: 0 },
  ], [deletionRequests.length, restoreRequests.length, openTickets, t]);

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (userRole && u.role !== userRole) return false;
      if (userStatus === 'verified' && !u.isVerified) return false;
      if (userStatus === 'unverified' && u.isVerified) return false;
      if (!q) return true;
      return `${u.displayName || ''} ${u.email || ''}`.toLowerCase().includes(q);
    });

    const byName = (a, b) => (a.displayName || '').localeCompare(b.displayName || '');
    return [...list].sort((a, b) => {
      if (userSort === 'name-desc') return byName(b, a);
      if (userSort === 'newest') return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (userSort === 'oldest') return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (userSort === 'role') {
        const delta = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
        return delta !== 0 ? delta : byName(a, b);
      }
      return byName(a, b);
    });
  }, [users, userQuery, userRole, userStatus, userSort]);

  const usersTotalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const pagedUsers = filteredUsers.slice((usersPage - 1) * USERS_PER_PAGE, usersPage * USERS_PER_PAGE);

  const visibleTickets = useMemo(
    () => (ticketStatus ? tickets.filter((tk) => tk.status === ticketStatus) : tickets),
    [tickets, ticketStatus],
  );

  const stats = [
    { id: 'members', icon: Users, value: users.length, label: 'Members', tone: 'var(--primary)', tab: 'users' },
    { id: 'verified', icon: ShieldCheck, value: verifiedUsers, label: 'Verified', tone: 'var(--success)', tab: 'users', onPick: () => setUserStatus('verified') },
    { id: 'approvals', icon: ShieldAlert, value: pendingApprovals, label: 'Pending Approvals', tone: 'var(--warning)', tab: 'deletion-requests' },
    { id: 'requests', icon: MessageSquare, value: openTickets, label: 'Open Requests', tone: '#8b5cf6', tab: 'tickets' },
    { id: 'emails', icon: Mail, value: emailsLoggedAll, label: 'Emails Logged', tone: 'var(--info)', tab: 'emails' },
  ];

  /* ── Users CSV export ───────────────────────────────────────────────── */

  const exportUsersCsv = () => {
    // A leading =, +, - or @ makes a spreadsheet treat the cell as a formula.
    const safe = (value) => {
      const str = String(value ?? '');
      const escaped = /^[=+\-@]/.test(str) ? `'${str}` : str;
      return `"${escaped.replace(/"/g, '""')}"`;
    };
    const header = ['Name', 'Email', 'Role', 'Verified', 'Dues reminders', 'Rename requested', 'Joined'];
    const rows = filteredUsers.map((u) => [
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
    if (!u.isVerified) return <span className="adm-self">Awaiting verification</span>;
    const powerHours = hoursUntil(u.customDatePowerExpires);
    return (
      <div className="adm-pills">
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

  const renderUsers = () => (
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

        <span className="adm-toolbar__meta">
          {filteredUsers.length === users.length
            ? `${users.length} members`
            : `${filteredUsers.length} of ${users.length}`}
        </span>

        <button type="button" className="adm-ghost-btn" onClick={exportUsersCsv} disabled={!filteredUsers.length}>
          <Download size={13} /> CSV
        </button>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No members match"
          text="Nothing matches the current search and filters. Clear them to see the full roster."
        />
      ) : (
        <>
          {/* Desktop table */}
          <div className="adm-table-wrap adm-desk">
            <div className="adm-table-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th scope="col">Member</th>
                    <th scope="col">Status</th>
                    <th scope="col">Role</th>
                    <th scope="col">Permissions</th>
                    <th scope="col">Joined</th>
                    <th scope="col" className="adm-td-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((u) => (
                    <tr key={u._id}>
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
            {pagedUsers.map((u) => (
              <div key={u._id} className="adm-card">
                <div className="adm-card__head">
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

          <Pager
            page={usersPage}
            totalPages={usersTotalPages}
            onChange={setUsersPage}
            label={{ previous: t('previous'), next: t('next'), of: t('page_of')(usersPage, usersTotalPages) }}
          />
        </>
      )}
    </>
  );

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
                  style={{ flex: 1 }}
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
        key: 'mail', icon: Mail, tone: '#8b5cf6', label: 'Daily emails',
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
    'deletion-requests': () => renderApprovals(deletionRequests, 'deletion'),
    'restore-requests': () => renderApprovals(restoreRequests, 'restore'),
    'recently-deleted': renderArchive,
    'tickets': renderTickets,
    'emails': renderEmails,
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
