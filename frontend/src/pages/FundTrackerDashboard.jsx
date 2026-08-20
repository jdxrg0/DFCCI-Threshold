import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Briefcase,
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Download,
  Info,
  Landmark,
  Link2 as LinkIcon,
  Mail,
  Pencil,
  PiggyBank,
  Plus,
  Search,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Unlink,
  Users,
  Wallet,
  X,
  Camera,
  FileText,
  History,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

/* ══════════════════════════════════════════════════════════════════════════
   Helpers
   ══════════════════════════════════════════════════════════════════════════ */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Every Sunday that falls inside the given month
function getSundays(year, month) {
  const d = new Date(year, month, 1);
  const sundays = [];
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  while (d.getMonth() === month) {
    sundays.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return sundays;
}

// Local YYYY-MM-DD. Using toISOString() here would shift PH dates back a day.
function getLocalYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

const peso = (n) =>
  `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const pesoWhole = (n) => `₱${Math.round(Number(n) || 0).toLocaleString('en-PH')}`;

// Audit diffs store raw field values; make them readable without leaking
// implementation detail like ObjectIds into the feed. `funds` resolves a
// designatedFund id to its name — printing "a fund → a fund" told the reader
// nothing about what actually moved.
function formatAuditValue(field, value, funds = []) {
  if (value === null || value === undefined || value === '') return 'none';
  if (field === 'amount') return peso(value);
  if (field === 'date') return new Date(value).toLocaleDateString();
  if (field === 'designatedFund') {
    return funds.find((f) => f._id === value)?.name || 'a deleted fund';
  }
  if (field === 'receiptUrl') return 'a receipt';
  const str = String(value);
  return str.length > 60 ? `${str.slice(0, 60)}…` : str;
}

const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

/* ══════════════════════════════════════════════════════════════════════════
   Small presentational pieces
   ══════════════════════════════════════════════════════════════════════════ */

// Escape closes only the topmost dialog, so an alert raised from inside a form
// modal does not dismiss both at once.
const modalStack = [];

function Modal({ onClose, children, size = '', accent, titleId }) {
  const tokenRef = useRef({});

  useEffect(() => {
    const token = tokenRef.current;
    modalStack.push(token);
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      const i = modalStack.indexOf(token);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, [onClose]);

  return (
    <div
      className="ft-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`ft-modal ${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={accent ? { '--accent': accent } : undefined}
      >
        {accent && <div className="ft-modal__accent" />}
        {children}
      </div>
    </div>
  );
}

// Shares Modal's stack so Escape closes the topmost dialog only, and locks
// body scroll the same way.
function LightboxOverlay({ onClose, children }) {
  const tokenRef = useRef({});

  useEffect(() => {
    const token = tokenRef.current;
    modalStack.push(token);
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === token) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      const i = modalStack.indexOf(token);
      if (i >= 0) modalStack.splice(i, 1);
    };
  }, [onClose]);

  return (
    <div
      className="ft-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ icon, title, text, action }) {
  return (
    <div className="ft-empty">
      <div className="ft-empty__icon">{icon}</div>
      <h3 className="ft-empty__title">{title}</h3>
      <p className="ft-empty__text">{text}</p>
      {action}
    </div>
  );
}

function SkeletonList({ rows = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }} aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="ft-skel" style={{ width: '18%' }} />
          <div className="ft-skel" style={{ width: '28%' }} />
          <div className="ft-skel" style={{ flex: 1 }} />
          <div className="ft-skel" style={{ width: '12%' }} />
        </div>
      ))}
    </div>
  );
}

// Month-end balance trend. Derived by walking the monthly nets backwards from
// today's balance, so it needs no extra endpoint.
function Sparkline({ points }) {
  if (!points || points.length < 2) return null;
  const w = 260;
  const h = 62;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const x = (i) => (i / (points.length - 1)) * w;
  const y = (v) => h - ((v - min) / span) * (h - 8) - 4;
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(' ');
  const area = `${line} L${w},${h} L0,${h} Z`;
  const rising = points[points.length - 1] >= points[0];
  const stroke = rising ? 'var(--success)' : 'var(--danger)';

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Balance trend">
      <defs>
        <linearGradient id="ft-spark-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#ft-spark-grad)" />
      <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="3.5" fill={stroke} />
    </svg>
  );
}

function Ring({ value, size = 64 }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ft-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${Math.round(pct)} percent`}>
      <circle className="ft-ring__track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="6" />
      <circle
        className="ft-ring__fill"
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c - (pct / 100) * c}
      />
      <text className="ft-ring__label" x="50%" y="50%" dominantBaseline="central" textAnchor="middle">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   Page
   ══════════════════════════════════════════════════════════════════════════ */

export default function FundTrackerDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'YOUTH_TREASURER';
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('fundTrackerActiveTab') || 'overview');
  useEffect(() => {
    localStorage.setItem('fundTrackerActiveTab', activeTab);
  }, [activeTab]);

  // ── Overview ──
  const [summary, setSummary] = useState({
    totalIncome: 0, totalExpense: 0, currentBalance: 0,
    monthIncome: 0, monthExpense: 0, monthNet: 0, prevMonthNet: 0,
    unallocated: 0, transactionCount: 0,
  });
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [filterType, setFilterType] = useState('OTHERS');
  const [fundFilter, setFundFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [customCategory, setCustomCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: '', type: 'INCOME', category: '', description: '',
    date: new Date().toISOString().slice(0, 10), designatedFund: '',
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const pageCache = useRef({});

  const [showFellowshipForm, setShowFellowshipForm] = useState(false);
  const [fellowshipData, setFellowshipData] = useState({
    eventName: '', fee: 30, date: new Date().toISOString().slice(0, 10),
    participants: [], customParticipants: '',
  });

  // ── Designated funds ──
  const [designatedFunds, setDesignatedFunds] = useState([]);
  const [loadingFunds, setLoadingFunds] = useState(true);
  const [showFundForm, setShowFundForm] = useState(false);
  const [editingFundId, setEditingFundId] = useState(null);
  const [fundData, setFundData] = useState({
    name: '', description: '', targetAmount: '', color: '#3b82f6', autoAssignWeeklyDues: false,
  });
  const [fundTxModal, setFundTxModal] = useState({ isOpen: false, fund: null, transactions: [], loading: false, page: 1, totalPages: 1 });

  // ── Weekly dues ──
  const [ledgerYear, setLedgerYear] = useState(new Date().getFullYear());
  const [ledgerMonth, setLedgerMonth] = useState(new Date().getMonth());
  const [ledgerData, setLedgerData] = useState({ members: [], payments: [], config: null });
  const [loadingDues, setLoadingDues] = useState(true);
  const [newMemberName, setNewMemberName] = useState('');
  const [showRoster, setShowRoster] = useState(false);
  const [addError, setAddError] = useState('');
  const [editingCell, setEditingCell] = useState(null); // { memberId, dateStr, value, original, dirty, row, col }
  const [memberQuery, setMemberQuery] = useState('');
  const [memberSort, setMemberSort] = useState('name');
  const cellRefs = useRef(new Map());
  const refreshTimer = useRef(null);
  const committedRef = useRef(null);

  // ── Receipts ──
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState('');
  const [removeReceipt, setRemoveReceipt] = useState(false);
  const [lightbox, setLightbox] = useState('');

  // ── Audit trail ──
  const [auditEntries, setAuditEntries] = useState([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // ── Batch reminders ──
  const [reminderPreview, setReminderPreview] = useState(null);
  const [loadingReminders, setLoadingReminders] = useState(false);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [showRecipients, setShowRecipients] = useState(false);

  // ── Insights ──
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [breakdownType, setBreakdownType] = useState('EXPENSE');

  // ── Link user ──
  const [linkModal, setLinkModal] = useState({ isOpen: false, member: null });
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(null);
  const userSearchTimer = useRef(null);

  // ── Dialogs ──
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = useCallback((title, message) => setAlertDialog({ isOpen: true, title, message }), []);
  const showConfirm = useCallback(
    (title, message, onConfirm) => setConfirmDialog({ isOpen: true, title, message, onConfirm }),
    []
  );
  const closeAlert = useCallback(() => setAlertDialog((d) => ({ ...d, isOpen: false })), []);
  const closeConfirm = useCallback(() => setConfirmDialog((d) => ({ ...d, isOpen: false })), []);

  /* ── Fetching ─────────────────────────────────────────────────────────── */

  const buildTxParams = useCallback(
    (page) => {
      const p = new URLSearchParams();
      if (month) p.append('month', month);
      if (year) p.append('year', year);
      if (filterType !== 'ALL') p.append('filterType', filterType);
      if (fundFilter) p.append('designatedFund', fundFilter);
      if (search.trim()) p.append('q', search.trim());
      p.append('page', page);
      p.append('limit', 10);
      return p.toString();
    },
    [month, year, filterType, fundFilter, search]
  );

  const cacheKey = useCallback(
    (page) => `${month}|${year}|${filterType}|${fundFilter}|${search}|${page}`,
    [month, year, filterType, fundFilter, search]
  );

  const fetchOverview = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) setLoadingOverview(true);
        pageCache.current = {};

        const [sumRes, catRes, r1, r2] = await Promise.all([
          api.get('/funds/summary'),
          api.get('/funds/categories'),
          api.get(`/funds?${buildTxParams(1)}`),
          api.get(`/funds?${buildTxParams(2)}`).catch(() => null),
        ]);

        setSummary(sumRes.data);
        setCategories(catRes.data);
        setTotalPages(r1.data.totalPages);
        setTotalResults(r1.data.total);
        setTransactions(r1.data.transactions);
        setCurrentPage(1);

        pageCache.current[cacheKey(1)] = r1.data.transactions;
        if (r2?.data?.transactions?.length) pageCache.current[cacheKey(2)] = r2.data.transactions;
      } catch (err) {
        console.error('Failed to load fund overview:', err);
      } finally {
        if (!silent) setLoadingOverview(false);
      }
    },
    [buildTxParams, cacheKey]
  );

  const goToPage = useCallback(
    async (page) => {
      if (page < 1 || page > totalPages) return;
      const key = cacheKey(page);
      if (pageCache.current[key]) {
        setTransactions(pageCache.current[key]);
        setCurrentPage(page);
        return;
      }
      setLoadingOverview(true);
      try {
        const res = await api.get(`/funds?${buildTxParams(page)}`);
        pageCache.current[key] = res.data.transactions;
        setTotalPages(res.data.totalPages);
        setTransactions(res.data.transactions);
        setCurrentPage(page);
      } catch (err) {
        console.error('Failed to change page:', err);
      } finally {
        setLoadingOverview(false);
      }
    },
    [buildTxParams, cacheKey, totalPages]
  );

  const fetchLedger = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingDues(true);
      const res = await api.get('/funds/dues/ledger');
      setLedgerData(res.data);
    } catch (err) {
      console.error('Failed to load dues ledger:', err);
    } finally {
      if (!silent) setLoadingDues(false);
    }
  }, []);

  const fetchDesignatedFunds = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoadingFunds(true);
      const res = await api.get('/funds/designated');
      setDesignatedFunds(res.data);
    } catch (err) {
      console.error('Failed to load designated funds:', err);
    } finally {
      if (!silent) setLoadingFunds(false);
    }
  }, []);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoadingAnalytics(true);
      const res = await api.get('/funds/analytics?months=6');
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  }, []);

  const fetchAudit = useCallback(async (page = 1) => {
    try {
      setLoadingAudit(true);
      const res = await api.get(`/funds/audit?page=${page}&limit=20`);
      setAuditEntries(res.data.entries);
      setAuditTotalPages(res.data.totalPages);
      setAuditPage(res.data.page);
    } catch (err) {
      console.error('Failed to load audit log:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const fetchReminderPreview = useCallback(async () => {
    if (!isPrivileged) return;
    try {
      setLoadingReminders(true);
      const res = await api.get('/funds/dues/reminder-preview');
      setReminderPreview(res.data);
    } catch (err) {
      console.error('Failed to load reminder preview:', err);
    } finally {
      setLoadingReminders(false);
    }
  }, [isPrivileged]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);
  useEffect(() => { fetchLedger(); }, [fetchLedger]);
  useEffect(() => { fetchDesignatedFunds(); }, [fetchDesignatedFunds]);
  useEffect(() => { fetchAnalytics(); }, [fetchAnalytics]);

  // Loaded on demand — most visits never open these tabs.
  useEffect(() => {
    if (activeTab === 'activity' && !auditEntries.length) fetchAudit(1);
  }, [activeTab, auditEntries.length, fetchAudit]);

  useEffect(() => {
    if (activeTab === 'dues' && isPrivileged && !reminderPreview) fetchReminderPreview();
  }, [activeTab, isPrivileged, reminderPreview, fetchReminderPreview]);

  // Debounce the search box so typing does not fire a request per keystroke
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // One coalesced refresh after a burst of ledger edits, instead of three
  // full reloads per cell.
  const scheduleRefresh = useCallback(() => {
    clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(() => {
      fetchOverview({ silent: true });
      fetchDesignatedFunds({ silent: true });
      fetchAnalytics();
    }, 1200);
  }, [fetchOverview, fetchDesignatedFunds, fetchAnalytics]);

  useEffect(() => () => clearTimeout(refreshTimer.current), []);

  /* ── Derived values ───────────────────────────────────────────────────── */

  const duesConfig = ledgerData.config;
  const weeklyAmount = duesConfig?.weeklyAmount ?? 10;
  const duesStart = useMemo(
    () => (duesConfig?.startDate ? new Date(duesConfig.startDate) : new Date(2026, 4, 1)),
    [duesConfig]
  );
  // Expected so far comes from the server, so the grid, the status pills and
  // the emailed statements can never drift apart.
  const expectedToDate = duesConfig?.expectedToDate ?? 0;

  const sundays = useMemo(() => getSundays(ledgerYear, ledgerMonth), [ledgerYear, ledgerMonth]);
  const today = useMemo(() => startOfDay(new Date()), []);

  const paymentIndex = useMemo(() => {
    const map = new Map();
    for (const p of ledgerData.payments) {
      map.set(`${p.member}|${getLocalYMD(new Date(p.collectionDate))}`, p.amount);
    }
    return map;
  }, [ledgerData.payments]);

  const getPaymentAmount = useCallback(
    (memberId, dateStr) => paymentIndex.get(`${memberId}|${dateStr}`) || 0,
    [paymentIndex]
  );

  const memberTotals = useMemo(() => {
    const map = new Map();
    for (const p of ledgerData.payments) {
      map.set(p.member, (map.get(p.member) || 0) + p.amount);
    }
    return map;
  }, [ledgerData.payments]);

  const getMemberTotal = useCallback((id) => memberTotals.get(id) || 0, [memberTotals]);

  // How many dues Sundays a member's total covers, counted from the start date
  const getSundayIndexSinceStart = useCallback(
    (targetDate) => {
      const start = startOfDay(duesStart);
      start.setDate(start.getDate() + ((7 - start.getDay()) % 7));
      const diffDays = Math.round((startOfDay(targetDate).getTime() - start.getTime()) / 86400000);
      return Math.floor(diffDays / 7) + 1;
    },
    [duesStart]
  );

  const visibleMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    const list = q
      ? ledgerData.members.filter((m) => m.name.toLowerCase().includes(q))
      : [...ledgerData.members];
    if (memberSort === 'balance') {
      list.sort((a, b) => (getMemberTotal(a._id) - expectedToDate) - (getMemberTotal(b._id) - expectedToDate));
    } else if (memberSort === 'paid') {
      list.sort((a, b) => getMemberTotal(b._id) - getMemberTotal(a._id));
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [ledgerData.members, memberQuery, memberSort, getMemberTotal, expectedToDate]);

  // Collection health for the month currently on screen. Only Sundays that have
  // actually happened count towards "expected".
  const monthStats = useMemo(() => {
    // Only Sundays that have happened *and* fall on or after the dues start
    // date are owed — otherwise browsing back to March shows a false 0%.
    const elapsed = sundays.filter((s) => startOfDay(s) <= today && getSundayIndexSinceStart(s) > 0);
    const memberCount = ledgerData.members.length;
    let collected = 0;
    for (const m of ledgerData.members) {
      for (const s of sundays) collected += getPaymentAmount(m._id, getLocalYMD(s));
    }
    const expected = elapsed.length * memberCount * weeklyAmount;
    return {
      collected,
      expected,
      rate: expected > 0 ? (collected / expected) * 100 : 0,
      elapsedSundays: elapsed.length,
      totalSundays: sundays.length,
    };
  }, [sundays, ledgerData.members, getPaymentAmount, today, weeklyAmount, getSundayIndexSinceStart]);

  const duesStanding = useMemo(() => {
    let updated = 0;
    let ahead = 0;
    let behind = 0;
    let arrears = 0;
    for (const m of ledgerData.members) {
      const bal = getMemberTotal(m._id) - expectedToDate;
      if (bal > 0) ahead += 1;
      else if (bal === 0) updated += 1;
      else {
        behind += 1;
        arrears += Math.abs(bal);
      }
    }
    return { updated, ahead, behind, arrears };
  }, [ledgerData.members, getMemberTotal, expectedToDate]);

  const columnTotals = useMemo(
    () =>
      sundays.map((s) => {
        const dateStr = getLocalYMD(s);
        return ledgerData.members.reduce((sum, m) => sum + getPaymentAmount(m._id, dateStr), 0);
      }),
    [sundays, ledgerData.members, getPaymentAmount]
  );

  // Month-end balances, walked backwards from today's balance
  const balanceTrend = useMemo(() => {
    if (!analytics?.series?.length) return null;
    const points = new Array(analytics.series.length);
    let running = summary.currentBalance;
    for (let i = analytics.series.length - 1; i >= 0; i--) {
      points[i] = running;
      running -= analytics.series[i].net;
    }
    return points;
  }, [analytics, summary.currentBalance]);

  const flowSplit = useMemo(() => {
    const total = summary.totalIncome + summary.totalExpense;
    if (total <= 0) return { inPct: 0, outPct: 0 };
    return {
      inPct: (summary.totalIncome / total) * 100,
      outPct: (summary.totalExpense / total) * 100,
    };
  }, [summary.totalIncome, summary.totalExpense]);

  const allocation = useMemo(() => {
    const funds = designatedFunds
      .map((f) => ({ name: f.name, color: f.color || '#3b82f6', value: Math.max(0, f.currentBalance) }))
      .filter((f) => f.value > 0);
    const unallocated = Math.max(0, summary.unallocated || 0);
    const total = funds.reduce((s, f) => s + f.value, 0) + unallocated;
    return { funds, unallocated, total };
  }, [designatedFunds, summary.unallocated]);

  const breakdown = useMemo(() => {
    if (!analytics?.categories) return [];
    const rows = analytics.categories.filter((c) => c.type === breakdownType).slice(0, 8);
    const max = rows.reduce((m, r) => Math.max(m, r.total), 0) || 1;
    return rows.map((r) => ({ ...r, pct: (r.total / max) * 100 }));
  }, [analytics, breakdownType]);

  const topContributors = useMemo(() => {
    return ledgerData.members
      .map((m) => ({ name: m.name, total: getMemberTotal(m._id) }))
      .filter((m) => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [ledgerData.members, getMemberTotal]);

  const chartMax = useMemo(() => {
    if (!analytics?.series?.length) return 1;
    return Math.max(1, ...analytics.series.map((s) => Math.max(s.income, s.expense)));
  }, [analytics]);

  const groupedTransactions = useMemo(() => {
    const groups = [];
    for (const tx of transactions) {
      const label = new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(tx);
      else groups.push({ label, items: [tx] });
    }
    return groups;
  }, [transactions]);

  const hasFilters = Boolean(month || year || search.trim() || fundFilter || filterType !== 'OTHERS');

  /* ── Transaction handlers ─────────────────────────────────────────────── */

  const handleInput = (e) => {
    const { name, value } = e.target;
    if (name === 'category') {
      if (value === '__CUSTOM__') {
        setCustomCategory(true);
        setFormData((f) => ({ ...f, category: '' }));
      } else {
        setCustomCategory(false);
        setFormData((f) => ({ ...f, category: value }));
      }
    } else {
      setFormData((f) => ({ ...f, [name]: value }));
    }
  };

  const openForm = (tx = null) => {
    setShowManageCategories(false);
    setEditingCategory(null);
    setReceiptFile(null);
    setRemoveReceipt(false);
    setReceiptPreview(tx?.receiptUrl || '');
    if (tx) {
      setEditingId(tx._id);
      setFormData({
        amount: tx.amount,
        type: tx.type,
        category: tx.category,
        description: tx.description || '',
        date: getLocalYMD(new Date(tx.date)),
        designatedFund: tx.designatedFund?._id || tx.designatedFund || '',
      });
      setCustomCategory(!categories.includes(tx.category));
    } else {
      setEditingId(null);
      setFormData({
        amount: '', type: 'INCOME', category: categories[0] || '', description: '',
        date: new Date().toISOString().slice(0, 10), designatedFund: '',
      });
      setCustomCategory(categories.length === 0);
    }
    setShowForm(true);
  };

  const handlePickReceipt = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Guard client-side too: multer rejects oversized files, but failing here
    // saves the member a pointless upload over mobile data.
    if (file.size > 5 * 1024 * 1024) {
      showAlert('Image too large', 'Receipts must be under 5MB. Try taking the photo at a lower resolution.');
      e.target.value = '';
      return;
    }
    setReceiptFile(file);
    setRemoveReceipt(false);
    setReceiptPreview((prev) => {
      // Release the previous blob; otherwise every re-pick pins a whole File
      // for the lifetime of the page.
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    // Clearing the input means picking the SAME file again still fires change.
    e.target.value = '';
  };

  const handleClearReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview((prev) => {
      if (prev.startsWith('blob:')) URL.revokeObjectURL(prev);
      return '';
    });
    // Only meaningful when editing something that already had one.
    setRemoveReceipt(Boolean(editingId));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      // Multipart only when a file is actually involved, so ordinary edits keep
      // going out as plain JSON.
      let payload = formData;
      let config;
      if (receiptFile || removeReceipt) {
        const body = new FormData();
        Object.entries(formData).forEach(([k, v]) => body.append(k, v ?? ''));
        if (removeReceipt) body.append('removeReceipt', 'true');
        // File last — the ordering the existing upload modal relies on.
        if (receiptFile) body.append('receipt', receiptFile);
        payload = body;
        config = { headers: { 'Content-Type': 'multipart/form-data' } };
      }

      if (editingId) await api.put(`/funds/${editingId}`, payload, config);
      else await api.post('/funds', payload, config);

      setReceiptFile(null);
      setReceiptPreview('');
      setRemoveReceipt(false);
      setShowForm(false);
      await Promise.all([fetchOverview(), fetchDesignatedFunds({ silent: true })]);
      fetchAnalytics();
      fetchAudit(1);
    } catch (err) {
      showAlert('Could not save', err.response?.data?.message || 'Failed to save the transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameCategory = async () => {
    if (!editingCategory || !editingCategory.draft.trim()) return;
    if (editingCategory.draft.trim() === editingCategory.original) {
      setEditingCategory(null);
      return;
    }
    try {
      await api.patch('/funds/categories/rename', {
        oldName: editingCategory.original,
        newName: editingCategory.draft.trim(),
      });
      if (formData.category === editingCategory.original) {
        setFormData((f) => ({ ...f, category: editingCategory.draft.trim() }));
      }
      setEditingCategory(null);
      await fetchOverview();
    } catch (err) {
      showAlert('Could not rename', err.response?.data?.message || 'Failed to rename the category.');
    }
  };

  const handleDelete = (tx) => {
    showConfirm(
      'Delete transaction',
      `Delete "${tx.category}" for ${peso(tx.amount)}? Any weekly dues entry linked to it is cleared too.`,
      async () => {
        try {
          await api.delete(`/funds/${tx._id}`);
          await Promise.all([fetchOverview(), fetchLedger({ silent: true }), fetchDesignatedFunds({ silent: true })]);
          fetchAnalytics();
          fetchAudit(1);
        } catch (err) {
          showAlert('Could not delete', err.response?.data?.message || 'Failed to delete the transaction.');
        }
      }
    );
  };

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      // Pulled in on demand so the sheet writer only loads when someone
      // actually exports.
      const [{ default: XLSX }, res] = await Promise.all([
        import('xlsx'),
        api.get(`/funds/export?${buildTxParams(1)}`),
      ]);
      const rows = res.data.transactions.map((tx) => ({
        Date: new Date(tx.date).toLocaleDateString('en-PH'),
        Type: tx.type,
        Category: tx.category,
        Description: tx.description || '',
        Amount: tx.amount,
        Signed: tx.type === 'INCOME' ? tx.amount : -tx.amount,
        Fund: tx.designatedFund?.name || 'Unassigned',
        'Recorded by': tx.createdBy?.displayName || '',
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Transactions');
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet([
          { Metric: 'Total income', Amount: summary.totalIncome },
          { Metric: 'Total expense', Amount: summary.totalExpense },
          { Metric: 'Current balance', Amount: summary.currentBalance },
          { Metric: 'Unallocated', Amount: summary.unallocated },
          { Metric: 'Rows exported', Amount: rows.length },
          { Metric: 'Generated', Amount: new Date().toLocaleString('en-PH') },
        ]),
        'Summary'
      );
      XLSX.writeFile(wb, `youth-fund-${getLocalYMD(new Date())}.xlsx`);

      if (res.data.capped) {
        showAlert('Export truncated', 'Only the 5,000 most recent matching transactions were exported. Narrow the filters for a complete slice.');
      }
    } catch (err) {
      console.error('Export failed:', err);
      showAlert('Export failed', 'The spreadsheet could not be generated. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportLedger = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { default: XLSX } = await import('xlsx');
      const rows = visibleMembers.map((m) => {
        const row = { Member: m.name };
        for (const s of sundays) row[`${MONTHS_SHORT[ledgerMonth]} ${s.getDate()}`] = getPaymentAmount(m._id, getLocalYMD(s)) || '';
        const paid = getMemberTotal(m._id);
        row['Total paid'] = paid;
        row['Expected to date'] = expectedToDate;
        row.Balance = paid - expectedToDate;
        return row;
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Weekly dues');
      XLSX.writeFile(wb, `weekly-dues-${ledgerYear}-${String(ledgerMonth + 1).padStart(2, '0')}.xlsx`);
    } catch (err) {
      console.error('Ledger export failed:', err);
      showAlert('Export failed', 'The dues sheet could not be generated. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyAnnouncement = (tx) => {
    const isIncome = tx.type === 'INCOME';
    const typeLabelUpper = isIncome ? '𝗜𝗡𝗖𝗢𝗠𝗘' : '𝗘𝗫𝗣𝗘𝗡𝗦𝗘𝗦';
    const typeLabelLower = isIncome ? 'income' : 'expenses';
    const currentBal = summary.currentBalance;
    const prevBal = isIncome ? currentBal - tx.amount : currentBal + tx.amount;
    const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });

    const descLines = (tx.description || 'Miscellaneous').split('\n');
    const firstLine = descLines[0];
    const restLines = descLines.slice(1).join('\n');
    const formattedDesc = restLines
      ? `1. ${firstLine}: ₱${tx.amount}\n${restLines}`
      : `1. ${firstLine}: ₱${tx.amount}`;

    const text = `𝗘𝗩𝗘𝗡𝗧: ${tx.category}
𝗗𝗔𝗧𝗘: ${dateStr}

${typeLabelUpper}:
${formattedDesc}

𝗧𝗢𝗧𝗔𝗟 ${typeLabelUpper}: ₱${tx.amount}

𝗖𝗨𝗥𝗥𝗘𝗡𝗧 𝗬𝗢𝗨𝗧𝗛 𝗙𝗨𝗡𝗗 𝗕𝗔𝗟𝗔𝗡𝗖𝗘:
- Previous balance: ₱${prevBal}
- Total ${typeLabelLower}: ₱${tx.amount}
- Updated Balance: ₱${currentBal}`;

    const copy = (value) => {
      if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(value);
      return new Promise((resolve, reject) => {
        const area = document.createElement('textarea');
        area.value = value;
        area.style.position = 'fixed';
        area.style.left = '-999999px';
        document.body.appendChild(area);
        area.focus();
        area.select();
        try {
          document.execCommand('copy');
          area.remove();
          resolve();
        } catch (error) {
          area.remove();
          reject(error);
        }
      });
    };

    copy(text)
      .then(() => showAlert('Copied', 'The announcement is on your clipboard, ready to paste into the group chat.'))
      .catch(() => showAlert('Could not copy', 'Your browser blocked clipboard access. Try again from a secure connection.'));
  };

  /* ── Fellowship expense ───────────────────────────────────────────────── */

  const fellowshipGuests = useMemo(
    () => fellowshipData.customParticipants.split(',').map((s) => s.trim()).filter(Boolean),
    [fellowshipData.customParticipants]
  );
  const fellowshipCount = fellowshipData.participants.length + fellowshipGuests.length;
  const fellowshipTotal = (Number(fellowshipData.fee) || 0) * fellowshipCount;

  const toggleParticipant = (memberId) => {
    setFellowshipData((prev) => ({
      ...prev,
      participants: prev.participants.includes(memberId)
        ? prev.participants.filter((id) => id !== memberId)
        : [...prev.participants, memberId],
    }));
  };

  const handleFellowshipSubmit = async (e) => {
    e.preventDefault();
    if (!fellowshipData.eventName.trim() || fellowshipCount === 0 || fellowshipData.fee <= 0) {
      showAlert('Missing details', 'Name the event, set a fee above zero, and pick at least one participant.');
      return;
    }
    const rosterNames = fellowshipData.participants
      .map((id) => ledgerData.members.find((m) => m._id === id))
      .filter(Boolean)
      .map((m) => `- ${m.name}`);
    const guestNames = fellowshipGuests.map((n) => `- ${n}`);
    const description = `Registration fee (₱${fellowshipData.fee} each for ${fellowshipCount} participants)\n${[...rosterNames, ...guestNames].join('\n')}`;

    try {
      await api.post('/funds', {
        type: 'EXPENSE',
        amount: fellowshipTotal,
        category: fellowshipData.eventName.trim(),
        description,
        date: fellowshipData.date,
      });
      setShowFellowshipForm(false);
      setFellowshipData({ eventName: '', fee: 30, date: new Date().toISOString().slice(0, 10), participants: [], customParticipants: '' });
      await Promise.all([fetchOverview(), fetchDesignatedFunds({ silent: true })]);
      fetchAnalytics();
      showAlert('Expense recorded', 'The fellowship expense was added to the ledger.');
    } catch (err) {
      showAlert('Could not save', err.response?.data?.message || 'Failed to add the fellowship expense.');
    }
  };

  /* ── Designated fund handlers ─────────────────────────────────────────── */

  const openFundForm = (fund = null) => {
    if (fund) {
      setEditingFundId(fund._id);
      setFundData({
        name: fund.name,
        description: fund.description || '',
        targetAmount: fund.targetAmount || '',
        color: fund.color || '#3b82f6',
        autoAssignWeeklyDues: fund.autoAssignWeeklyDues || false,
      });
    } else {
      setEditingFundId(null);
      setFundData({ name: '', description: '', targetAmount: '', color: '#3b82f6', autoAssignWeeklyDues: false });
    }
    setShowFundForm(true);
  };

  const handleFundSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingFundId) await api.put(`/funds/designated/${editingFundId}`, fundData);
      else await api.post('/funds/designated', fundData);
      setShowFundForm(false);
      fetchDesignatedFunds();
    } catch (err) {
      showAlert('Could not save', err.response?.data?.message || 'Failed to save the designated fund.');
    }
  };

  const handleDeleteFund = (fund) => {
    showConfirm(
      'Delete fund',
      `Delete "${fund.name}"? Transactions assigned to it are kept and simply become unassigned.`,
      async () => {
        try {
          await api.delete(`/funds/designated/${fund._id}`);
          setShowFundForm(false);
          await Promise.all([fetchDesignatedFunds(), fetchOverview({ silent: true })]);
        } catch (err) {
          showAlert('Could not delete', err.response?.data?.message || 'Failed to delete the fund.');
        }
      }
    );
  };

  const openFundTxModal = async (fund) => {
    setFundTxModal({ isOpen: true, fund, transactions: [], loading: true, page: 1, totalPages: 1 });
    try {
      const res = await api.get(`/funds?designatedFund=${fund._id}&page=1&limit=10`);
      setFundTxModal((prev) => ({ ...prev, transactions: res.data.transactions, totalPages: res.data.totalPages, loading: false }));
    } catch (err) {
      console.error('Failed to load fund transactions:', err);
      setFundTxModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const loadFundTxPage = async (page) => {
    if (!fundTxModal.fund) return;
    setFundTxModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await api.get(`/funds?designatedFund=${fundTxModal.fund._id}&page=${page}&limit=10`);
      setFundTxModal((prev) => ({ ...prev, transactions: res.data.transactions, totalPages: res.data.totalPages, page, loading: false }));
    } catch (err) {
      console.error('Failed to page fund transactions:', err);
      setFundTxModal((prev) => ({ ...prev, loading: false }));
    }
  };

  /* ── Ledger cell editing ──────────────────────────────────────────────── */

  const focusCell = useCallback((row, col) => {
    const el = cellRefs.current.get(`${row}:${col}`);
    if (el) el.focus();
  }, []);

  const openCell = useCallback(
    (memberId, dateStr, amount, row, col) => {
      if (!isPrivileged) return;
      committedRef.current = null;
      setEditingCell({
        memberId,
        dateStr,
        // An empty cell opens pre-filled with the standard weekly amount, so
        // the common case is click-Enter. It only saves if you actually
        // confirm — see commitCell's `dirty` check.
        value: amount ? String(amount) : String(weeklyAmount),
        original: amount,
        dirty: false,
        row,
        col,
      });
    },
    [isPrivileged, weeklyAmount]
  );

  // Patch the ledger locally instead of refetching everything on each keystroke
  const patchPayment = useCallback((memberId, dateStr, amount) => {
    setLedgerData((prev) => {
      const payments = prev.payments.filter(
        (p) => !(p.member === memberId && getLocalYMD(new Date(p.collectionDate)) === dateStr)
      );
      if (amount > 0) {
        payments.push({ _id: `local-${memberId}-${dateStr}`, member: memberId, collectionDate: dateStr, amount });
      }
      return { ...prev, payments };
    });
  }, []);

  const commitCell = useCallback(
    async (cell, { moveDown = false } = {}) => {
      if (!cell) return;
      const { memberId, dateStr, value, original, dirty, row, col } = cell;

      // Enter commits and unmounts the input, which can also fire onBlur.
      // Without this guard the same edit would post — and be added to the
      // running totals — twice.
      const token = `${memberId}|${dateStr}`;
      if (committedRef.current === token) return;
      committedRef.current = token;

      setEditingCell(null);

      const raw = String(value).trim();
      const amount = raw === '' ? 0 : Number(raw);

      if (moveDown) {
        // Queue the focus move so it lands after the input unmounts
        setTimeout(() => focusCell(row + 1, col), 0);
      }

      if (!dirty || Number.isNaN(amount) || amount < 0 || amount === original) return;

      patchPayment(memberId, dateStr, amount);
      const delta = amount - original;
      setSummary((s) => ({
        ...s,
        totalIncome: s.totalIncome + delta,
        currentBalance: s.currentBalance + delta,
        monthIncome: s.monthIncome + delta,
        monthNet: s.monthNet + delta,
      }));

      try {
        await api.post('/funds/dues/ledger', { memberId, collectionDate: dateStr, amount });
        scheduleRefresh();
      } catch (err) {
        showAlert('Could not save', err.response?.data?.message || 'The payment did not save. Refreshing the ledger.');
        fetchLedger({ silent: true });
        fetchOverview({ silent: true });
      }
    },
    [patchPayment, scheduleRefresh, showAlert, fetchLedger, fetchOverview, focusCell]
  );

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCell(editingCell, { moveDown: true });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // Claim the token so the blur that follows unmounting cannot save the
      // edit the user just abandoned.
      committedRef.current = `${editingCell.memberId}|${editingCell.dateStr}`;
      setEditingCell(null);
      setTimeout(() => focusCell(editingCell.row, editingCell.col), 0);
    }
  };

  // Arrow keys walk the grid the way a spreadsheet does
  const handleCellNav = (e, row, col) => {
    const moves = { ArrowUp: [row - 1, col], ArrowDown: [row + 1, col], ArrowLeft: [row, col - 1], ArrowRight: [row, col + 1] };
    if (moves[e.key]) {
      e.preventDefault();
      focusCell(...moves[e.key]);
    }
  };

  /* ── Roster handlers ──────────────────────────────────────────────────── */

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    setAddError('');
    try {
      await api.post('/funds/dues/members', { name: newMemberName.trim() });
      setNewMemberName('');
      await fetchLedger({ silent: true });
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to add the member. Please try again.');
    }
  };

  const handleRemoveMember = (member) => {
    showConfirm(
      'Remove from roster',
      `Remove ${member.name} from the dues roster? Their recorded payments stay in the ledger.`,
      async () => {
        try {
          await api.delete(`/funds/dues/members/${member._id}`);
          fetchLedger({ silent: true });
        } catch (err) {
          showAlert('Could not remove', err.response?.data?.message || 'Failed to remove the member.');
        }
      }
    );
  };

  const openLinkModal = (member) => {
    setLinkModal({ isOpen: true, member });
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  const closeLinkModal = useCallback(() => {
    setLinkModal({ isOpen: false, member: null });
    setUserSearchQuery('');
    setUserSearchResults([]);
  }, []);

  useEffect(() => {
    if (!linkModal.isOpen) return undefined;
    clearTimeout(userSearchTimer.current);
    if (!userSearchQuery.trim()) return undefined;
    userSearchTimer.current = setTimeout(async () => {
      try {
        setSearchingUsers(true);
        const res = await api.get(`/users/search?q=${encodeURIComponent(userSearchQuery)}`);
        setUserSearchResults(res.data);
      } catch (err) {
        console.error('User search failed:', err);
      } finally {
        setSearchingUsers(false);
      }
    }, 350);
    return () => clearTimeout(userSearchTimer.current);
  }, [userSearchQuery, linkModal.isOpen]);

  const handleConfirmLink = async (userId) => {
    try {
      await api.put(`/funds/dues/members/${linkModal.member._id}/link-user`, { userId });
      await fetchLedger({ silent: true });
      closeLinkModal();
    } catch (err) {
      showAlert('Could not link', err.response?.data?.message || 'Failed to link the user.');
    }
  };

  const handleUnlinkUser = (member) => {
    showConfirm(
      'Unlink user',
      `Disconnect ${member.linkedUser?.displayName} from "${member.name}"? They stop receiving dues statements.`,
      async () => {
        try {
          await api.put(`/funds/dues/members/${member._id}/link-user`, { userId: null });
          fetchLedger({ silent: true });
        } catch (err) {
          showAlert('Could not unlink', err.response?.data?.message || 'Failed to unlink the user.');
        }
      }
    );
  };

  const handleSendBatchReminders = () => {
    if (!reminderPreview || sendingBatch) return;
    showConfirm(
      'Send dues reminders',
      `Email a dues statement to ${reminderPreview.total} subscribed member${reminderPreview.total === 1 ? '' : 's'} right now?`,
      async () => {
        setSendingBatch(true);
        try {
          const res = await api.post('/funds/dues/send-batch-reminders', { timing: 'Manual' });
          showAlert('Reminders sent', res.data.message);
          fetchReminderPreview();
        } catch (err) {
          showAlert('Could not send', err.response?.data?.message || 'The batch did not go out.');
        } finally {
          setSendingBatch(false);
        }
      }
    );
  };

  const handleSendDuesEmail = async (member) => {
    if (!member.linkedUser || sendingEmail) return;
    setSendingEmail(member._id);
    try {
      const res = await api.post(`/funds/dues/members/${member._id}/send-dues-email`);
      showAlert('Statement sent', res.data.message);
    } catch (err) {
      showAlert('Could not send', err.response?.data?.message || 'Failed to send the statement.');
    } finally {
      setSendingEmail(null);
    }
  };

  /* ── Pagination window ────────────────────────────────────────────────── */

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const set = new Set([1, totalPages, currentPage]);
    if (currentPage > 1) set.add(currentPage - 1);
    if (currentPage < totalPages) set.add(currentPage + 1);
    return [...set].sort((a, b) => a - b);
  }, [totalPages, currentPage]);

  const shiftLedgerMonth = (step) => {
    let y = ledgerYear;
    let m = ledgerMonth + step;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setLedgerMonth(m);
    setLedgerYear(y);
    setEditingCell(null);
  };

  const isCurrentLedgerMonth = ledgerYear === today.getFullYear() && ledgerMonth === today.getMonth();

  const TABS = [
    { id: 'overview', label: t('overview_tab') || 'Overview', icon: <Coins size={15} /> },
    { id: 'dues', label: t('weekly_dues_tab') || 'Weekly Dues', icon: <Users size={15} />, count: ledgerData.members.length || null },
    { id: 'budgets', label: 'Funds', icon: <Briefcase size={15} />, count: designatedFunds.length || null },
    { id: 'insights', label: 'Insights', icon: <ChartColumn size={15} /> },
    { id: 'activity', label: 'Activity', icon: <History size={15} /> },
  ];

  /* ══════════════════════════════════════════════════════════════════════
     Render
     ══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="ft-page">
      {/* Back button is global — see components/BackBar.jsx */}
      <div className="ft-topbar">
        <Link to="/docs/fund-tracker" className="btn btn-secondary" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem', borderRadius: '9999px' }}>
          <BookOpen size={15} /> {t('read_docs') || 'Docs'}
        </Link>
      </div>

      {/* ── Treasury hero ── */}
      <section className="ft-hero">
        <div className="ft-hero__grid">
          <div>
            <p className="ft-eyebrow">
              <Landmark size={13} /> {t('fund_dashboard') || 'Youth Fund'}
            </p>

            <h1 className={`ft-hero__amount ${summary.currentBalance < 0 ? 'is-negative' : ''}`}>
              {peso(summary.currentBalance)}
              {summary.monthNet !== 0 && (
                <span className={`ft-delta ${summary.monthNet > 0 ? 'is-up' : 'is-down'}`}>
                  {summary.monthNet > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {pesoWhole(Math.abs(summary.monthNet))} this month
                </span>
              )}
            </h1>

            <p className="ft-hero__sub">
              {t('fund_desc') || 'Keep track of the Youth Fund.'} · {summary.transactionCount} records
            </p>

            <div className="ft-flowbar" role="img" aria-label={`Income ${peso(summary.totalIncome)}, expenses ${peso(summary.totalExpense)}`}>
              <div className="ft-flowbar__seg ft-flowbar__seg--in" style={{ width: `${flowSplit.inPct}%` }} />
              <div className="ft-flowbar__seg ft-flowbar__seg--out" style={{ width: `${flowSplit.outPct}%` }} />
            </div>

            <div className="ft-legend">
              <div className="ft-legend__item">
                <span className="ft-legend__label">
                  <span className="ft-legend__dot" style={{ background: 'var(--success)' }} />
                  {t('total_income') || 'Total in'}
                </span>
                <p className="ft-legend__value is-in">{peso(summary.totalIncome)}</p>
              </div>
              <div className="ft-legend__item">
                <span className="ft-legend__label">
                  <span className="ft-legend__dot" style={{ background: 'var(--danger)' }} />
                  {t('total_expense') || 'Total out'}
                </span>
                <p className="ft-legend__value is-out">{peso(summary.totalExpense)}</p>
              </div>
              <div className="ft-legend__item">
                <span className="ft-legend__label">
                  <span className="ft-legend__dot" style={{ background: 'var(--text-muted)' }} />
                  Unallocated
                </span>
                <p className="ft-legend__value">{peso(summary.unallocated)}</p>
              </div>
            </div>
          </div>

          {balanceTrend && (
            <div className="ft-spark">
              <div className="ft-spark__head">
                <span className="ft-eyebrow">Balance trend</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                  {analytics.series.length} mo
                </span>
              </div>
              <Sparkline points={balanceTrend} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                <span>{MONTHS_SHORT[analytics.series[0].month - 1]}</span>
                <span>{MONTHS_SHORT[analytics.series[analytics.series.length - 1].month - 1]}</span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── Tabs ── */}
      <div className="ft-tabs">
        <div className="ft-tabs__track" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`ft-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
              {tab.count ? <span className="ft-tab__count">{tab.count}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* ══ OVERVIEW ══ */}
      {activeTab === 'overview' && (
        <section className="ft-panel">
          <div className="ft-panel__head">
            <div>
              <h2 className="ft-panel__title">
                <Coins size={18} /> {t('recent_transactions') || 'Transactions'}
              </h2>
              <p className="ft-panel__desc">
                {totalResults} {totalResults === 1 ? 'record' : 'records'}
                {hasFilters ? ' matching your filters' : ''}
              </p>
            </div>
            {isPrivileged && (
              <div className="ft-panel__actions">
                <button onClick={() => setShowFellowshipForm(true)} className="btn btn-secondary" style={{ borderRadius: '9999px', padding: '0.45rem 1rem', fontSize: '0.8rem' }}>
                  <Users size={15} /> Fellowship
                </button>
                <button onClick={() => openForm()} className="btn btn-primary" style={{ borderRadius: '9999px', padding: '0.45rem 1.1rem', fontSize: '0.8rem' }}>
                  <Plus size={15} /> {t('add_transaction') || 'Add'}
                </button>
              </div>
            )}
          </div>

          <div className="ft-toolbar">
            <div className="ft-search">
              <Search size={15} />
              <input
                className="ft-input"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search category or description…"
                aria-label="Search transactions"
              />
              {searchInput && (
                <button className="ft-search__clear" onClick={() => setSearchInput('')} aria-label="Clear search">
                  <X size={12} />
                </button>
              )}
            </div>

            <select className="ft-select" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Filter by month">
              <option value="">{t('all_months') || 'All months'}</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>

            <select className="ft-select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Filter by year">
              <option value="">{t('all_years') || 'All years'}</option>
              {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <select className="ft-select" value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by kind">
              <option value="ALL">All types</option>
              <option value="WEEKLY_DUES">Weekly dues</option>
              <option value="OTHERS">Excluding dues</option>
            </select>

            {designatedFunds.length > 0 && (
              <select className="ft-select" value={fundFilter} onChange={(e) => setFundFilter(e.target.value)} aria-label="Filter by fund">
                <option value="">All funds</option>
                <option value="UNASSIGNED">Unassigned</option>
                {designatedFunds.map((f) => (
                  <option key={f._id} value={f._id}>{f.name}</option>
                ))}
              </select>
            )}

            <span className="ft-spacer" />

            <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} style={{ borderRadius: '9999px', padding: '0.45rem 1rem', fontSize: '0.78rem' }}>
              <Download size={14} /> {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>

          {loadingOverview ? (
            <SkeletonList rows={6} />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<Coins size={26} />}
              title="Nothing here yet"
              text={hasFilters ? 'No transactions match these filters. Try widening the date range or clearing the search.' : 'Once the treasurer records income or expenses, they show up here.'}
              action={
                hasFilters ? (
                  <button
                    className="btn btn-secondary"
                    style={{ borderRadius: '9999px' }}
                    onClick={() => { setMonth(''); setYear(''); setFilterType('ALL'); setFundFilter(''); setSearchInput(''); }}
                  >
                    Clear filters
                  </button>
                ) : null
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="ft-tablewrap">
                <table className="ft-table">
                  <thead>
                    <tr>
                      <th>{t('date') || 'Date'}</th>
                      <th>{t('category') || 'Category'}</th>
                      <th>{t('description') || 'Description'}</th>
                      <th>Fund</th>
                      <th style={{ textAlign: 'right' }}>{t('amount') || 'Amount'}</th>
                      <th style={{ textAlign: 'right' }}>{isPrivileged ? 'Actions' : ''}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx._id}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                          {new Date(tx.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
                        </td>
                        <td>
                          <span className={`ft-chip ${tx.type === 'INCOME' ? 'ft-chip--in' : 'ft-chip--out'}`}>
                            {tx.type === 'INCOME' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                            {tx.category}
                          </span>
                        </td>
                        <td className="ft-td-desc">{tx.description || '—'}</td>
                        <td>
                          {tx.designatedFund ? (
                            <span className="ft-chip ft-chip--cat">{tx.designatedFund.name}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span className={`ft-amount ${tx.type === 'INCOME' ? 'is-in' : 'is-out'}`}>
                            {tx.type === 'INCOME' ? '+' : '−'}{peso(tx.amount)}
                          </span>
                        </td>
                        <td>
                          <div className="ft-rowactions">
                            {tx.receiptUrl && (
                              <button
                                type="button"
                                className="ft-receipt-thumb-btn"
                                onClick={() => setLightbox(tx.receiptUrl)}
                                aria-label={`View receipt for ${tx.category}`}
                              >
                                <img className="ft-receipt-thumb" src={tx.receiptUrl} alt="" />
                              </button>
                            )}
                            <button className="ft-iconbtn" title="Copy announcement" onClick={() => handleCopyAnnouncement(tx)}>
                              <Copy size={14} />
                            </button>
                            {isPrivileged && (
                              <>
                                <button className="ft-iconbtn is-primary" title={t('edit') || 'Edit'} onClick={() => openForm(tx)}>
                                  <Pencil size={14} />
                                </button>
                                <button className="ft-iconbtn is-danger" title={t('delete') || 'Delete'} onClick={() => handleDelete(tx)}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards, grouped by day */}
              <div className="ft-txlist">
                {groupedTransactions.map((group) => (
                  <React.Fragment key={group.label}>
                    <p className="ft-daylabel">{group.label}</p>
                    {group.items.map((tx) => (
                      <article key={tx._id} className="ft-txcard">
                        <div className="ft-txcard__top">
                          <div style={{ minWidth: 0 }}>
                            <h3 className="ft-txcard__title">{tx.category}</h3>
                            <div className="ft-txcard__meta">
                              <span className={`ft-chip ${tx.type === 'INCOME' ? 'ft-chip--in' : 'ft-chip--out'}`}>
                                {tx.type === 'INCOME' ? (t('income') || 'In') : (t('expense') || 'Out')}
                              </span>
                              {tx.designatedFund && <span className="ft-chip ft-chip--cat">{tx.designatedFund.name}</span>}
                            </div>
                          </div>
                          <span className={`ft-amount ${tx.type === 'INCOME' ? 'is-in' : 'is-out'}`}>
                            {tx.type === 'INCOME' ? '+' : '−'}{peso(tx.amount)}
                          </span>
                        </div>
                        {tx.description && <div className="ft-txcard__desc">{tx.description}</div>}
                        <div className="ft-txcard__foot">
                          {tx.receiptUrl && (
                            <button
                              type="button"
                              className="ft-receipt-thumb-btn"
                              style={{ marginRight: 'auto' }}
                              onClick={() => setLightbox(tx.receiptUrl)}
                              aria-label={`View receipt for ${tx.category}`}
                            >
                              <img className="ft-receipt-thumb" src={tx.receiptUrl} alt="" />
                            </button>
                          )}
                          <button className="ft-iconbtn" title="Copy announcement" onClick={() => handleCopyAnnouncement(tx)}>
                            <Copy size={14} />
                          </button>
                          {isPrivileged && (
                            <>
                              <button className="ft-iconbtn is-primary" title={t('edit') || 'Edit'} onClick={() => openForm(tx)}>
                                <Pencil size={14} />
                              </button>
                              <button className="ft-iconbtn is-danger" title={t('delete') || 'Delete'} onClick={() => handleDelete(tx)}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </article>
                    ))}
                  </React.Fragment>
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="ft-pager" aria-label="Transaction pages">
                  <button className="ft-pager__btn" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">
                    <ChevronLeft size={14} />
                  </button>
                  {paginationPages.map((p, i, arr) => (
                    <React.Fragment key={p}>
                      {i > 0 && arr[i - 1] !== p - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>…</span>}
                      <button
                        className={`ft-pager__btn ${currentPage === p ? 'is-active' : ''}`}
                        onClick={() => goToPage(p)}
                        aria-current={currentPage === p ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                  <button className="ft-pager__btn" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page">
                    <ChevronRight size={14} />
                  </button>
                  {!isMobile && <span className="ft-pager__info">Page {currentPage} of {totalPages}</span>}
                </nav>
              )}
            </>
          )}
        </section>
      )}

      {/* ══ WEEKLY DUES ══ */}
      {activeTab === 'dues' && (
        <div className="ft-stack">
          {/* Collection health */}
          <section className="ft-panel">
            <div className="ft-panel__head">
              <div>
                <h2 className="ft-panel__title">
                  <Wallet size={18} /> Collection health
                </h2>
                <p className="ft-panel__desc">
                  {pesoWhole(weeklyAmount)} every Sunday since {duesStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="ft-stats">
              <div className="ft-stat">
                <div className="ft-ringstat">
                  <Ring value={monthStats.rate} />
                  <div style={{ minWidth: 0 }}>
                    <span className="ft-stat__label">Collected</span>
                    <p className="ft-stat__value">{pesoWhole(monthStats.collected)}</p>
                    <p className="ft-stat__hint">of {pesoWhole(monthStats.expected)} due</p>
                  </div>
                </div>
              </div>

              <div className="ft-stat">
                <span className="ft-stat__label"><Check size={12} /> Updated</span>
                <p className="ft-stat__value is-in">{duesStanding.updated + duesStanding.ahead}</p>
                <p className="ft-stat__hint">{duesStanding.ahead} paid in advance</p>
              </div>

              <div className="ft-stat">
                <span className="ft-stat__label"><Info size={12} /> In arrears</span>
                <p className={`ft-stat__value ${duesStanding.behind ? 'is-out' : 'is-in'}`}>{duesStanding.behind}</p>
                <p className="ft-stat__hint">{pesoWhole(duesStanding.arrears)} outstanding</p>
              </div>

              <div className="ft-stat">
                <span className="ft-stat__label"><Users size={12} /> Roster</span>
                <p className="ft-stat__value">{ledgerData.members.length}</p>
                <p className="ft-stat__hint">
                  {monthStats.elapsedSundays} of {monthStats.totalSundays} Sundays elapsed
                </p>
              </div>
            </div>
          </section>

          {/* Ledger grid */}
          <section className="ft-panel">
            <div className="ft-ledgerbar">
              <div className="ft-monthnav">
                <button className="ft-monthnav__btn" onClick={() => shiftLedgerMonth(-1)} aria-label="Previous month">
                  <ChevronLeft size={16} />
                </button>
                <span className="ft-monthnav__label">
                  {MONTHS[ledgerMonth]} {ledgerYear}
                </span>
                <button className="ft-monthnav__btn" onClick={() => shiftLedgerMonth(1)} aria-label="Next month">
                  <ChevronRight size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', alignItems: 'center' }}>
                {!isCurrentLedgerMonth && (
                  <button
                    className="btn btn-secondary"
                    style={{ borderRadius: '9999px', padding: '0.35rem 0.9rem', fontSize: '0.75rem' }}
                    onClick={() => { setLedgerMonth(today.getMonth()); setLedgerYear(today.getFullYear()); }}
                  >
                    Today
                  </button>
                )}
                <div className="ft-search" style={{ flex: '0 1 11rem' }}>
                  <Search size={14} />
                  <input
                    className="ft-input"
                    type="search"
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Find member…"
                    aria-label="Find roster member"
                  />
                </div>
                <select className="ft-select" value={memberSort} onChange={(e) => setMemberSort(e.target.value)} aria-label="Sort roster">
                  <option value="name">A–Z</option>
                  <option value="balance">Most behind</option>
                  <option value="paid">Most paid</option>
                </select>
                <button className="btn btn-secondary" onClick={handleExportLedger} disabled={exporting} style={{ borderRadius: '9999px', padding: '0.4rem 0.9rem', fontSize: '0.75rem' }}>
                  <Download size={14} />
                </button>
              </div>
            </div>

            {isPrivileged && !loadingDues && ledgerData.members.length > 0 && (
              <p className="ft-note" style={{ marginBottom: '0.85rem' }}>
                <Info size={14} />
                <span>
                  Click a cell to record a payment — it opens at {pesoWhole(weeklyAmount)} so <kbd>Enter</kbd> confirms the standard amount.
                  Arrow keys move around the grid, <kbd>Esc</kbd> cancels.
                </span>
              </p>
            )}

            {loadingDues ? (
              <SkeletonList rows={6} />
            ) : ledgerData.members.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title={t('no_roster') || 'No roster yet'}
                text="Add members below to start tracking weekly dues. Each name gets its own row in the collection grid."
              />
            ) : visibleMembers.length === 0 ? (
              <EmptyState icon={<Search size={26} />} title="No matches" text={`No roster member matches "${memberQuery}".`} />
            ) : (
              <div className="ft-ledgerwrap">
                <table className="ft-ledger">
                  <thead>
                    <tr>
                      <th className="ft-col-name">{t('member_name') || 'Member'}</th>
                      {sundays.map((date, i) => {
                        const isToday = getLocalYMD(date) === getLocalYMD(today);
                        return (
                          <th key={i} className={`ft-col-sunday ${isToday ? 'is-today' : ''}`} scope="col">
                            {date.getDate()}
                          </th>
                        );
                      })}
                      <th className="ft-col-total">Total</th>
                      <th className="ft-col-status">Standing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleMembers.map((m, row) => {
                      const totalPaid = getMemberTotal(m._id);
                      const coveredSundays = Math.floor(totalPaid / weeklyAmount);
                      const balance = totalPaid - expectedToDate;

                      return (
                        <tr key={m._id}>
                          <th className="ft-col-name" scope="row">{m.name}</th>

                          {sundays.map((date, col) => {
                            const dateStr = getLocalYMD(date);
                            const amount = getPaymentAmount(m._id, dateStr);
                            const isEditing = editingCell?.memberId === m._id && editingCell?.dateStr === dateStr;
                            const sundayIndex = getSundayIndexSinceStart(date);
                            const isCovered = sundayIndex > 0 && sundayIndex <= coveredSundays;
                            const isPast = startOfDay(date) <= today;
                            const isFuture = !isPast;

                            let state = '';
                            if (amount > 0) state = 'is-paid';
                            else if (isCovered) state = 'is-covered';
                            else if (isFuture) state = 'is-future';
                            else if (sundayIndex > 0) state = 'is-due';

                            return (
                              <td key={col} className={`ft-cell ${state}`}>
                                {isEditing ? (
                                  <input
                                    autoFocus
                                    className="ft-cell__input"
                                    type="number"
                                    min="0"
                                    inputMode="numeric"
                                    value={editingCell.value}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setEditingCell((c) => ({ ...c, value: e.target.value, dirty: true }))}
                                    onBlur={() => commitCell(editingCell)}
                                    onKeyDown={handleCellKeyDown}
                                    aria-label={`${m.name}, ${MONTHS_SHORT[ledgerMonth]} ${date.getDate()}`}
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="ft-cell__btn"
                                    data-editable={isPrivileged}
                                    ref={(el) => {
                                      if (el) cellRefs.current.set(`${row}:${col}`, el);
                                      else cellRefs.current.delete(`${row}:${col}`);
                                    }}
                                    onClick={() => openCell(m._id, dateStr, amount, row, col)}
                                    onKeyDown={(e) => handleCellNav(e, row, col)}
                                    aria-label={`${m.name}, ${MONTHS_SHORT[ledgerMonth]} ${date.getDate()}: ${amount ? peso(amount) : isCovered ? 'covered in advance' : 'unpaid'}`}
                                  >
                                    {amount > 0 ? amount : isCovered ? '✓' : isFuture ? '·' : '—'}
                                  </button>
                                )}
                              </td>
                            );
                          })}

                          <td className="ft-col-total">
                            <span className="ft-amount">{totalPaid > 0 ? pesoWhole(totalPaid) : '—'}</span>
                          </td>
                          <td className="ft-col-status">
                            {balance > 0 ? (
                              <span className="ft-pill ft-pill--ahead">+{Math.round(balance)}</span>
                            ) : balance === 0 ? (
                              <span className="ft-pill ft-pill--ok">Updated</span>
                            ) : (
                              <span className="ft-pill ft-pill--behind">{Math.round(balance)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="ft-col-name">Sunday total</td>
                      {columnTotals.map((total, i) => (
                        <td key={i}>{total > 0 ? total : '—'}</td>
                      ))}
                      <td style={{ textAlign: 'right' }}>{pesoWhole(monthStats.collected)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Roster management */}
          {isPrivileged && (
            <section className="ft-panel">
              <button className="ft-disclosure" aria-expanded={showRoster} onClick={() => setShowRoster((v) => !v)}>
                <span className="ft-disclosure__caret"><ChevronRight size={16} /></span>
                {t('dues_roster') || 'Dues roster'}
                <span className="ft-chip" style={{ marginLeft: 'auto' }}>{ledgerData.members.length}</span>
              </button>

              {showRoster && (
                <>
                  <div className="ft-rosterlist">
                    {ledgerData.members.map((m) => (
                      <div key={m._id} className="ft-rosteritem">
                        <div className="ft-rosteritem__name">
                          <span className="ft-avatar" aria-hidden="true">{initials(m.name)}</span>
                          <span style={{ minWidth: 0 }}>
                            {m.name}
                            <span className="ft-rosteritem__sub">
                              {m.linkedUser ? `Linked to ${m.linkedUser.displayName}` : 'No account linked'}
                            </span>
                          </span>
                        </div>
                        <div className="ft-rosteritem__actions">
                          {m.linkedUser ? (
                            <>
                              <button
                                className="ft-iconbtn is-primary"
                                title={`Email statement to ${m.linkedUser.email}`}
                                onClick={() => handleSendDuesEmail(m)}
                                disabled={sendingEmail === m._id}
                              >
                                <Mail size={14} />
                              </button>
                              <button className="ft-iconbtn" title="Unlink account" onClick={() => handleUnlinkUser(m)}>
                                <Unlink size={14} />
                              </button>
                            </>
                          ) : (
                            <button className="ft-iconbtn is-primary" title="Link a registered account" onClick={() => openLinkModal(m)}>
                              <LinkIcon size={14} />
                            </button>
                          )}
                          <button className="ft-iconbtn is-danger" title="Remove from roster" onClick={() => handleRemoveMember(m)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddMember} className="ft-addrow">
                    <input
                      className="ft-input"
                      type="text"
                      placeholder="New roster member name…"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      required
                      aria-label="New roster member name"
                    />
                    <button type="submit" className="btn btn-primary" style={{ borderRadius: '0.75rem', whiteSpace: 'nowrap' }}>
                      {t('add_member') || 'Add'}
                    </button>
                  </form>
                  {addError && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.5rem' }}>{addError}</p>}
                </>
              )}
            </section>
          )}

          {/* Batch reminders */}
          {isPrivileged && (
            <section className="ft-panel">
              <div className="ft-panel__head">
                <div>
                  <h2 className="ft-panel__title">
                    <Send size={18} /> Dues reminders
                  </h2>
                  <p className="ft-panel__desc">
                    Emails each subscribed member their own balance. Sends automatically every Saturday 9PM and Sunday 6AM — this is for sending one now.
                  </p>
                </div>
              </div>

              {loadingReminders && !reminderPreview ? (
                <SkeletonList rows={2} />
              ) : !reminderPreview ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Could not load the recipient list.</p>
              ) : (
                <div className="ft-reminder__grid">
                  <div>
                    <div className="ft-stats" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))' }}>
                      <div className="ft-stat">
                        <span className="ft-stat__label"><Mail size={12} /> Will receive</span>
                        <p className={`ft-stat__value ${reminderPreview.total ? '' : 'is-warn'}`}>{reminderPreview.total}</p>
                        <p className="ft-stat__hint">subscribed members</p>
                      </div>
                      <div className="ft-stat">
                        <span className="ft-stat__label"><Users size={12} /> Not subscribed</span>
                        <p className="ft-stat__value">{reminderPreview.unsubscribedCount}</p>
                        <p className="ft-stat__hint">of {reminderPreview.verifiedCount} verified</p>
                      </div>
                      <div className="ft-stat">
                        <span className="ft-stat__label"><Wallet size={12} /> Expected each</span>
                        <p className="ft-stat__value">{pesoWhole(reminderPreview.expectedToDate)}</p>
                        <p className="ft-stat__hint">to date</p>
                      </div>
                    </div>

                    {reminderPreview.total === 0 && (
                      <p className="ft-note" style={{ marginTop: '0.85rem' }}>
                        <Info size={14} />
                        <span>
                          Nobody has opted in yet, so nothing would be sent. Dues reminders are off by default —
                          an admin turns them on per member from the Admin Panel.
                        </span>
                      </p>
                    )}

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.85rem' }}>
                      <button
                        className="btn btn-primary"
                        style={{ borderRadius: '9999px' }}
                        onClick={handleSendBatchReminders}
                        disabled={sendingBatch || reminderPreview.total === 0}
                      >
                        <Send size={15} /> {sendingBatch ? 'Sending…' : 'Send now'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ borderRadius: '9999px' }}
                        onClick={() => setShowRecipients((v) => !v)}
                        disabled={reminderPreview.total === 0}
                      >
                        {showRecipients ? 'Hide' : 'Preview'} recipients
                      </button>
                    </div>
                  </div>

                  {showRecipients && reminderPreview.total > 0 && (
                    <div className="ft-recipients">
                      {reminderPreview.recipients.map((r) => (
                        <div key={r._id} className="ft-recipient">
                          <span className="ft-avatar" aria-hidden="true">{initials(r.displayName)}</span>
                          <span className="ft-recipient__name">
                            {r.displayName}
                            <span className="ft-recipient__email">{r.email}</span>
                          </span>
                          {r.arrears === null ? (
                            <span className="ft-chip" title="No roster entry linked to this account">No roster</span>
                          ) : r.arrears > 0 ? (
                            <span className="ft-pill ft-pill--behind">−{Math.round(r.arrears)}</span>
                          ) : r.arrears < 0 ? (
                            <span className="ft-pill ft-pill--ahead">+{Math.round(Math.abs(r.arrears))}</span>
                          ) : (
                            <span className="ft-pill ft-pill--ok">Updated</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ══ DESIGNATED FUNDS ══ */}
      {activeTab === 'budgets' && (
        <div className="ft-stack">
          <section className="ft-panel">
            <div className="ft-panel__head">
              <div>
                <h2 className="ft-panel__title">
                  <Briefcase size={18} /> Designated funds
                </h2>
                <p className="ft-panel__desc">Earmark money for a purpose and watch its balance move on its own.</p>
              </div>
              {isPrivileged && (
                <div className="ft-panel__actions">
                  <button onClick={() => openFundForm()} className="btn btn-primary" style={{ borderRadius: '9999px', padding: '0.45rem 1.1rem', fontSize: '0.8rem' }}>
                    <Plus size={15} /> New fund
                  </button>
                </div>
              )}
            </div>

            {loadingFunds ? (
              <SkeletonList rows={3} />
            ) : designatedFunds.length === 0 ? (
              <EmptyState
                icon={<PiggyBank size={26} />}
                title="No funds yet"
                text="Designated funds let you split the treasury into purposes — camp, outreach, equipment — and track each balance automatically."
                action={
                  isPrivileged ? (
                    <button onClick={() => openFundForm()} className="btn btn-primary" style={{ borderRadius: '9999px' }}>
                      Create the first fund
                    </button>
                  ) : null
                }
              />
            ) : (
              <div className="ft-fundgrid">
                {designatedFunds.map((fund) => {
                  const color = fund.color || '#3b82f6';
                  const hasTarget = fund.targetAmount > 0;
                  const progress = hasTarget ? Math.min(100, Math.max(0, (fund.currentBalance / fund.targetAmount) * 100)) : 0;

                  return (
                    <article key={fund._id} className="ft-fundcard" style={{ '--fund': color }}>
                      <div className="ft-fundcard__accent" />
                      <div className="ft-fundcard__body">
                        <div className="ft-fundcard__head">
                          <h3 className="ft-fundcard__name">
                            {fund.name}
                            {fund.autoAssignWeeklyDues && (
                              <span className="ft-chip" title="New weekly dues are routed here automatically">
                                <Wallet size={10} /> Auto
                              </span>
                            )}
                          </h3>
                          {isPrivileged && (
                            <button className="ft-iconbtn" title="Edit fund" onClick={() => openFundForm(fund)}>
                              <Pencil size={14} />
                            </button>
                          )}
                        </div>

                        {fund.description && <p className="ft-fundcard__desc">{fund.description}</p>}

                        <p className={`ft-fundcard__amount ${fund.currentBalance < 0 ? 'is-negative' : ''}`}>
                          {peso(fund.currentBalance)}
                          {hasTarget && <span className="ft-fundcard__target">of {peso(fund.targetAmount)}</span>}
                        </p>

                        {hasTarget && (
                          <>
                            <div className="ft-progress">
                              <div className="ft-progress__fill" style={{ width: `${progress}%` }} />
                            </div>
                            <div className="ft-progress__meta">
                              <span>{Math.round(progress)}% of goal</span>
                              <span>
                                {fund.currentBalance >= fund.targetAmount
                                  ? 'Goal reached'
                                  : `${peso(fund.targetAmount - fund.currentBalance)} to go`}
                              </span>
                            </div>
                          </>
                        )}

                        <div className="ft-fundcard__split">
                          <div>
                            <span className="ft-stat__label">In</span>
                            <p className="ft-stat__value is-in" style={{ fontSize: '0.95rem' }}>+{pesoWhole(fund.totalIncome)}</p>
                          </div>
                          <div>
                            <span className="ft-stat__label">Out</span>
                            <p className="ft-stat__value is-out" style={{ fontSize: '0.95rem' }}>−{pesoWhole(fund.totalExpense)}</p>
                          </div>
                          <div>
                            <span className="ft-stat__label">Records</span>
                            <p className="ft-stat__value" style={{ fontSize: '0.95rem' }}>{fund.transactionCount ?? '—'}</p>
                          </div>
                        </div>

                        <div className="ft-fundcard__foot">
                          <button
                            className="btn btn-secondary"
                            style={{ width: '100%', borderRadius: '9999px', padding: '0.45rem', fontSize: '0.78rem' }}
                            onClick={() => openFundTxModal(fund)}
                          >
                            View transactions
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {/* The general pot, shown alongside the earmarked ones so the
                    numbers on this screen add up to the hero balance. */}
                <article className="ft-fundcard" style={{ '--fund': 'var(--text-muted)' }}>
                  <div className="ft-fundcard__accent" />
                  <div className="ft-fundcard__body">
                    <div className="ft-fundcard__head">
                      <h3 className="ft-fundcard__name">Unallocated</h3>
                    </div>
                    <p className="ft-fundcard__desc">Money in the treasury that has not been earmarked to any fund.</p>
                    <p className={`ft-fundcard__amount ${summary.unallocated < 0 ? 'is-negative' : ''}`}>
                      {peso(summary.unallocated)}
                    </p>
                    <div className="ft-fundcard__split">
                      <div>
                        <span className="ft-stat__label">Share of balance</span>
                        <p className="ft-stat__value" style={{ fontSize: '0.95rem' }}>
                          {summary.currentBalance > 0
                            ? `${Math.round((summary.unallocated / summary.currentBalance) * 100)}%`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="ft-fundcard__foot">
                      <button
                        className="btn btn-secondary"
                        style={{ width: '100%', borderRadius: '9999px', padding: '0.45rem', fontSize: '0.78rem' }}
                        onClick={() => { setFundFilter('UNASSIGNED'); setFilterType('ALL'); setActiveTab('overview'); }}
                      >
                        View transactions
                      </button>
                    </div>
                  </div>
                </article>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ══ INSIGHTS ══ */}
      {activeTab === 'insights' && (
        <div className="ft-stack">
          {loadingAnalytics && !analytics ? (
            <section className="ft-panel"><SkeletonList rows={6} /></section>
          ) : !analytics ? (
            <section className="ft-panel">
              <EmptyState icon={<ChartColumn size={26} />} title="No data yet" text="Insights appear once the ledger has a few months of activity." />
            </section>
          ) : (
            <>
              <section className="ft-panel">
                <div className="ft-panel__head">
                  <div>
                    <h2 className="ft-panel__title"><ChartColumn size={18} /> Cash flow</h2>
                    <p className="ft-panel__desc">Income against expenses, last {analytics.series.length} months</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span className="ft-legend__label"><span className="ft-legend__dot" style={{ background: 'var(--success)' }} /> In</span>
                    <span className="ft-legend__label"><span className="ft-legend__dot" style={{ background: 'var(--danger)' }} /> Out</span>
                  </div>
                </div>

                <div className="ft-bars">
                  {analytics.series.map((s) => (
                    <div key={`${s.year}-${s.month}`} className="ft-barcol">
                      <div className="ft-barcol__pair">
                        <div
                          className="ft-bar ft-bar--in"
                          style={{ height: `${(s.income / chartMax) * 100}%` }}
                          title={`${MONTHS_SHORT[s.month - 1]} in: ${peso(s.income)}`}
                        />
                        <div
                          className="ft-bar ft-bar--out"
                          style={{ height: `${(s.expense / chartMax) * 100}%` }}
                          title={`${MONTHS_SHORT[s.month - 1]} out: ${peso(s.expense)}`}
                        />
                      </div>
                      <span className="ft-barcol__label">{MONTHS_SHORT[s.month - 1]}</span>
                    </div>
                  ))}
                </div>
              </section>

              <div className="ft-chartgrid">
                <section className="ft-panel">
                  <div className="ft-panel__head">
                    <h2 className="ft-panel__title" style={{ fontSize: '1rem' }}>
                      <Target size={16} /> By category
                    </h2>
                    <select className="ft-select" value={breakdownType} onChange={(e) => setBreakdownType(e.target.value)} aria-label="Breakdown type">
                      <option value="EXPENSE">Expenses</option>
                      <option value="INCOME">Income</option>
                    </select>
                  </div>

                  {breakdown.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing recorded in this window.</p>
                  ) : (
                    <div className="ft-breakdown">
                      {breakdown.map((row) => (
                        <div key={row.category} className="ft-breakdown__row">
                          <div className="ft-breakdown__head">
                            <span className="ft-breakdown__name">{row.category}</span>
                            <span className="ft-breakdown__value">{peso(row.total)} · {row.count}×</span>
                          </div>
                          <div className="ft-breakdown__track">
                            <div
                              className="ft-breakdown__fill"
                              style={{
                                width: `${row.pct}%`,
                                background: breakdownType === 'INCOME' ? 'var(--success)' : 'var(--danger)',
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="ft-panel">
                  <div className="ft-panel__head">
                    <h2 className="ft-panel__title" style={{ fontSize: '1rem' }}>
                      <PiggyBank size={16} /> Where the balance sits
                    </h2>
                  </div>

                  {allocation.total === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Nothing to allocate yet.</p>
                  ) : (
                    <div className="ft-breakdown">
                      {allocation.funds.map((f) => (
                        <div key={f.name} className="ft-breakdown__row">
                          <div className="ft-breakdown__head">
                            <span className="ft-breakdown__name">{f.name}</span>
                            <span className="ft-breakdown__value">
                              {peso(f.value)} · {Math.round((f.value / allocation.total) * 100)}%
                            </span>
                          </div>
                          <div className="ft-breakdown__track">
                            <div className="ft-breakdown__fill" style={{ width: `${(f.value / allocation.total) * 100}%`, background: f.color }} />
                          </div>
                        </div>
                      ))}
                      <div className="ft-breakdown__row">
                        <div className="ft-breakdown__head">
                          <span className="ft-breakdown__name">Unallocated</span>
                          <span className="ft-breakdown__value">
                            {peso(allocation.unallocated)} · {Math.round((allocation.unallocated / allocation.total) * 100)}%
                          </span>
                        </div>
                        <div className="ft-breakdown__track">
                          <div
                            className="ft-breakdown__fill"
                            style={{ width: `${(allocation.unallocated / allocation.total) * 100}%`, background: 'var(--text-muted)' }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="ft-panel">
                  <div className="ft-panel__head">
                    <h2 className="ft-panel__title" style={{ fontSize: '1rem' }}>
                      <Users size={16} /> Top dues contributors
                    </h2>
                  </div>
                  {topContributors.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No dues recorded yet.</p>
                  ) : (
                    <div>
                      {topContributors.map((m, i) => (
                        <div key={m.name} className="ft-rank">
                          <span className="ft-rank__no">{i + 1}</span>
                          <span className="ft-rank__name">{m.name}</span>
                          <span className="ft-rank__value">{pesoWhole(m.total)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="ft-panel">
                  <div className="ft-panel__head">
                    <h2 className="ft-panel__title" style={{ fontSize: '1rem' }}>
                      <Coins size={16} /> This month
                    </h2>
                  </div>
                  <div className="ft-stats">
                    <div className="ft-stat">
                      <span className="ft-stat__label">Income</span>
                      <p className="ft-stat__value is-in">{pesoWhole(summary.monthIncome)}</p>
                    </div>
                    <div className="ft-stat">
                      <span className="ft-stat__label">Expenses</span>
                      <p className="ft-stat__value is-out">{pesoWhole(summary.monthExpense)}</p>
                    </div>
                    <div className="ft-stat">
                      <span className="ft-stat__label">Net</span>
                      <p className={`ft-stat__value ${summary.monthNet >= 0 ? 'is-in' : 'is-out'}`}>
                        {summary.monthNet >= 0 ? '+' : '−'}{pesoWhole(Math.abs(summary.monthNet))}
                      </p>
                      <p className="ft-stat__hint">
                        Last month {summary.prevMonthNet >= 0 ? '+' : '−'}{pesoWhole(Math.abs(summary.prevMonthNet))}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ ACTIVITY / AUDIT TRAIL ══ */}
      {activeTab === 'activity' && (
        <div className="ft-stack">
          <section className="ft-panel">
            <div className="ft-panel__head">
              <div>
                <h2 className="ft-panel__title">
                  <ShieldCheck size={18} /> Activity log
                </h2>
                <p className="ft-panel__desc">
                  Every manual change to the ledger, and who made it. Weekly dues entries are not listed here — each amount is already visible in the dues grid.
                </p>
              </div>
              <div className="ft-panel__actions">
                <button className="btn btn-secondary" onClick={() => fetchAudit(auditPage)} disabled={loadingAudit} style={{ borderRadius: '9999px', padding: '0.4rem 0.9rem', fontSize: '0.78rem' }}>
                  Refresh
                </button>
              </div>
            </div>

            {loadingAudit && auditEntries.length === 0 ? (
              <SkeletonList rows={6} />
            ) : auditEntries.length === 0 ? (
              <EmptyState
                icon={<History size={26} />}
                title="Nothing recorded yet"
                text="Once a transaction is added, edited or deleted, it shows up here with the name of whoever did it."
              />
            ) : (
              <>
                <div className="ft-audit">
                  {auditEntries.map((entry) => {
                    const verb = entry.action === 'CREATE' ? 'added' : entry.action === 'DELETE' ? 'deleted' : 'edited';
                    const icon =
                      entry.action === 'CREATE' ? <Plus size={14} /> :
                      entry.action === 'DELETE' ? <Trash2 size={14} /> :
                      <Pencil size={14} />;

                    return (
                      <article key={entry._id} className="ft-audit-item">
                        <span className={`ft-audit__icon is-${entry.action.toLowerCase()}`}>{icon}</span>
                        <div className="ft-audit__body">
                          <div className="ft-audit__head">
                            <span className="ft-audit__actor">{entry.actorName}</span>
                            {entry.actorRole && <span className="ft-chip">{entry.actorRole.replace(/_/g, ' ')}</span>}
                            <span className="ft-audit__action">{verb}</span>
                            <span className="ft-audit__label">{entry.label}</span>
                            <time className="ft-audit__time" dateTime={entry.createdAt}>
                              {new Date(entry.createdAt).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit',
                              })}
                            </time>
                          </div>

                          {entry.changes?.length > 0 && (
                            <div className="ft-diff">
                              {entry.changes.map((c) => (
                                <div key={c.field} className="ft-diff__row">
                                  <span className="ft-diff__field">{c.field.replace(/([A-Z])/g, ' $1')}</span>
                                  <span className="ft-diff__from">{formatAuditValue(c.field, c.from, designatedFunds)}</span>
                                  <span className="ft-diff__arrow">→</span>
                                  <span className="ft-diff__to">{formatAuditValue(c.field, c.to, designatedFunds)}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {entry.note && <p className="ft-audit__note">{entry.note}</p>}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {auditTotalPages > 1 && (
                  <nav className="ft-pager" aria-label="Activity pages">
                    <button className="ft-pager__btn" onClick={() => fetchAudit(auditPage - 1)} disabled={auditPage === 1}>
                      <ChevronLeft size={14} />
                    </button>
                    <span className="ft-pager__info">Page {auditPage} of {auditTotalPages}</span>
                    <button className="ft-pager__btn" onClick={() => fetchAudit(auditPage + 1)} disabled={auditPage === auditTotalPages}>
                      <ChevronRight size={14} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* ══════════════ MODALS ══════════════ */}

      {/* Transaction form */}
      {showForm && (() => {
        const isIncome = formData.type === 'INCOME';
        const accent = isIncome ? 'var(--success)' : 'var(--danger)';
        return (
          <Modal onClose={() => setShowForm(false)} accent={accent} titleId="ft-tx-title">
            <div className="ft-modal__head">
              <div>
                <h3 className="ft-modal__title" id="ft-tx-title">
                  {editingId ? (t('edit_transaction') || 'Edit transaction') : (t('add_transaction') || 'Add transaction')}
                </h3>
                <p className="ft-modal__sub">
                  {editingId ? 'Update the details below.' : 'Record money moving in or out of the youth fund.'}
                </p>
              </div>
              <button className="ft-iconbtn" onClick={() => setShowForm(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
              <div className="ft-modal__body">
                <div className="ft-segment">
                  {[
                    { val: 'INCOME', label: t('income') || 'Income', cls: 'is-in', icon: <TrendingUp size={15} /> },
                    { val: 'EXPENSE', label: t('expense') || 'Expense', cls: 'is-out', icon: <TrendingDown size={15} /> },
                  ].map(({ val, label, cls, icon }) => (
                    <button
                      key={val}
                      type="button"
                      className={`ft-segment__btn ${cls} ${formData.type === val ? 'is-active' : ''}`}
                      onClick={() => setFormData((f) => ({ ...f, type: val }))}
                      aria-pressed={formData.type === val}
                    >
                      {icon} {label}
                    </button>
                  ))}
                </div>

                <label className="ft-field">
                  <span className="ft-field__label">{t('amount') || 'Amount'}</span>
                  <div className="ft-amountfield">
                    <span className="ft-amountfield__sign">₱</span>
                    <input
                      className="ft-input"
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleInput}
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </label>

                <div className="ft-field">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="ft-field__label">{t('category') || 'Category'}</span>
                    {categories.length > 0 && !customCategory && (
                      <button
                        type="button"
                        onClick={() => { setShowManageCategories((v) => !v); setEditingCategory(null); }}
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      >
                        {showManageCategories ? 'Done' : 'Rename…'}
                      </button>
                    )}
                  </div>

                  {showManageCategories && !customCategory && (
                    <div className="ft-scrollbox" style={{ marginBottom: '0.5rem' }}>
                      {categories.map((cat) => (
                        <div key={cat} className="ft-catrow">
                          {editingCategory?.original === cat ? (
                            <>
                              <input
                                autoFocus
                                className="ft-input"
                                style={{ flex: 1 }}
                                value={editingCategory.draft}
                                onChange={(e) => setEditingCategory((ec) => ({ ...ec, draft: e.target.value }))}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') { e.preventDefault(); handleRenameCategory(); }
                                  if (e.key === 'Escape') setEditingCategory(null);
                                }}
                              />
                              <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.75rem', borderRadius: '9999px' }} onClick={handleRenameCategory}>
                                Save
                              </button>
                              <button type="button" className="ft-iconbtn" onClick={() => setEditingCategory(null)} aria-label="Cancel rename">
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="ft-catrow__name">{cat}</span>
                              <button type="button" className="ft-iconbtn" onClick={() => setEditingCategory({ original: cat, draft: cat })} title={`Rename ${cat}`}>
                                <Pencil size={13} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {!customCategory && categories.length > 0 ? (
                    <select className="ft-select" style={{ width: '100%' }} name="category" value={formData.category} onChange={handleInput} required>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                      <option value="__CUSTOM__">+ New category…</option>
                    </select>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        className="ft-input"
                        style={{ flex: 1 }}
                        type="text"
                        name="category"
                        value={formData.category}
                        onChange={(e) => setFormData((f) => ({ ...f, category: e.target.value }))}
                        placeholder="e.g. Donations, Snacks"
                        required
                      />
                      {categories.length > 0 && (
                        <button type="button" className="btn btn-secondary" style={{ borderRadius: '0.75rem' }} onClick={() => setCustomCategory(false)}>
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {designatedFunds.length > 0 && (
                  <label className="ft-field">
                    <span className="ft-field__label">Designated fund <span>(optional)</span></span>
                    <select className="ft-select" name="designatedFund" value={formData.designatedFund} onChange={handleInput}>
                      <option value="">Unassigned — general pot</option>
                      {designatedFunds.map((f) => (
                        <option key={f._id} value={f._id}>{f.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="ft-field">
                  <span className="ft-field__label">{t('description') || 'Description'} <span>(optional)</span></span>
                  <textarea
                    className="ft-input"
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
                    placeholder={'E.g. Registration fee\n- John\n- Jane'}
                  />
                </label>

                <label className="ft-field">
                  <span className="ft-field__label">{t('date') || 'Date'}</span>
                  <input className="ft-input" type="date" name="date" value={formData.date} onChange={handleInput} required style={{ maxWidth: '12rem' }} />
                </label>

                <div className="ft-field">
                  <span className="ft-field__label">Receipt <span>(optional)</span></span>
                  <div className={`ft-receipt-field ${receiptPreview ? 'has-file' : ''}`}>
                    {receiptPreview ? (
                      <img className="ft-receipt-preview" src={receiptPreview} alt="Receipt preview" />
                    ) : (
                      <span className="ft-receipt-placeholder"><Camera size={18} /></span>
                    )}
                    <div className="ft-receipt-field__text">
                      <p className="ft-receipt-field__title">
                        {receiptPreview ? 'Receipt attached' : 'No receipt yet'}
                      </p>
                      <p className="ft-receipt-field__hint">
                        JPG, PNG or WebP up to 5MB. Anyone in the community can view it, so avoid photos showing personal bank details.
                      </p>
                    </div>
                    <div className="ft-receipt-actions">
                      <label className="ft-filebtn">
                        <Camera size={13} /> {receiptPreview ? 'Replace' : 'Attach'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePickReceipt} />
                      </label>
                      {receiptPreview && (
                        <button type="button" className="ft-iconbtn is-danger" onClick={handleClearReceipt} title="Remove receipt">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="ft-modal__foot">
                <button type="button" className="btn btn-secondary" style={{ borderRadius: '9999px' }} onClick={() => setShowForm(false)}>
                  {t('cancel') || 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                  style={{ borderRadius: '9999px', background: accent, borderColor: 'transparent' }}
                >
                  {saving ? 'Saving…' : (t('save') || 'Save')}
                </button>
              </div>
            </form>
          </Modal>
        );
      })()}

      {/* Fellowship expense */}
      {showFellowshipForm && (
        <Modal onClose={() => setShowFellowshipForm(false)} size="ft-modal--lg" accent="var(--danger)" titleId="ft-fellow-title">
          <div className="ft-modal__head">
            <div>
              <h3 className="ft-modal__title" id="ft-fellow-title">Fellowship expense</h3>
              <p className="ft-modal__sub">Split one event fee across everyone who joined — the breakdown is written into the ledger for you.</p>
            </div>
            <button className="ft-iconbtn" onClick={() => setShowFellowshipForm(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleFellowshipSubmit} style={{ display: 'contents' }}>
            <div className="ft-modal__body">
              <label className="ft-field">
                <span className="ft-field__label">Event name</span>
                <input
                  className="ft-input"
                  type="text"
                  value={fellowshipData.eventName}
                  onChange={(e) => setFellowshipData((f) => ({ ...f, eventName: e.target.value }))}
                  placeholder="E.g. Binhi #Pru-Task"
                  required
                />
              </label>

              <div className="ft-row">
                <label className="ft-field">
                  <span className="ft-field__label">Fee each (₱)</span>
                  <input
                    className="ft-input"
                    type="number"
                    min="1"
                    value={fellowshipData.fee}
                    onChange={(e) => setFellowshipData((f) => ({ ...f, fee: Number(e.target.value) }))}
                    required
                  />
                </label>
                <label className="ft-field">
                  <span className="ft-field__label">{t('date') || 'Date'}</span>
                  <input
                    className="ft-input"
                    type="date"
                    value={fellowshipData.date}
                    onChange={(e) => setFellowshipData((f) => ({ ...f, date: e.target.value }))}
                    required
                  />
                </label>
              </div>

              <div className="ft-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="ft-field__label">Participants <span>({fellowshipData.participants.length} selected)</span></span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      onClick={() => setFellowshipData((f) => ({ ...f, participants: ledgerData.members.map((m) => m._id) }))}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                      onClick={() => setFellowshipData((f) => ({ ...f, participants: [] }))}
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="ft-scrollbox">
                  {ledgerData.members.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>No members in the roster yet.</p>
                  ) : (
                    <div className="ft-checkgrid">
                      {ledgerData.members.map((m) => (
                        <label key={m._id} className="ft-check">
                          <input
                            type="checkbox"
                            checked={fellowshipData.participants.includes(m._id)}
                            onChange={() => toggleParticipant(m._id)}
                          />
                          {m.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <label className="ft-field">
                <span className="ft-field__label">Guests <span>(comma separated)</span></span>
                <input
                  className="ft-input"
                  type="text"
                  value={fellowshipData.customParticipants}
                  onChange={(e) => setFellowshipData((f) => ({ ...f, customParticipants: e.target.value }))}
                  placeholder="E.g. Mark, Anna's friend"
                />
              </label>
            </div>

            <div className="ft-modal__foot ft-modal__foot--split">
              <div>
                <span className="ft-eyebrow">Total</span>
                <p style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--danger)' }}>
                  {peso(fellowshipTotal)}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {fellowshipCount} participant{fellowshipCount === 1 ? '' : 's'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ borderRadius: '9999px' }} onClick={() => setShowFellowshipForm(false)}>
                  {t('cancel') || 'Cancel'}
                </button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '9999px' }}>
                  Record expense
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Designated fund form */}
      {showFundForm && (
        <Modal onClose={() => setShowFundForm(false)} accent={fundData.color || 'var(--primary)'} titleId="ft-fund-title">
          <div className="ft-modal__head">
            <div>
              <h3 className="ft-modal__title" id="ft-fund-title">
                {editingFundId ? 'Edit fund' : 'New designated fund'}
              </h3>
              <p className="ft-modal__sub">A fund is a labelled pocket of the treasury. Assign transactions to it and its balance keeps itself current.</p>
            </div>
            <button className="ft-iconbtn" onClick={() => setShowFundForm(false)} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleFundSubmit} style={{ display: 'contents' }}>
            <div className="ft-modal__body">
              <label className="ft-field">
                <span className="ft-field__label">Fund name</span>
                <input
                  className="ft-input"
                  type="text"
                  value={fundData.name}
                  onChange={(e) => setFundData((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Camp Fund"
                  required
                />
              </label>

              <label className="ft-field">
                <span className="ft-field__label">Description <span>(optional)</span></span>
                <textarea
                  className="ft-input"
                  style={{ minHeight: '4rem' }}
                  value={fundData.description}
                  onChange={(e) => setFundData((f) => ({ ...f, description: e.target.value }))}
                  placeholder="What is this fund for?"
                />
              </label>

              <div className="ft-row">
                <label className="ft-field">
                  <span className="ft-field__label">Goal <span>(optional)</span></span>
                  <input
                    className="ft-input"
                    type="number"
                    min="0"
                    value={fundData.targetAmount}
                    onChange={(e) => setFundData((f) => ({ ...f, targetAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </label>
                <label className="ft-field" style={{ flex: '0 0 6rem' }}>
                  <span className="ft-field__label">Colour</span>
                  <input
                    type="color"
                    value={fundData.color}
                    onChange={(e) => setFundData((f) => ({ ...f, color: e.target.value }))}
                    style={{ width: '100%', height: '2.4rem', padding: 0, border: '1px solid var(--hairline)', borderRadius: 'var(--r-sm)', background: 'none', cursor: 'pointer' }}
                    aria-label="Fund colour"
                  />
                </label>
              </div>

              <label className={`ft-switch ${fundData.autoAssignWeeklyDues ? 'is-on' : ''}`} style={{ '--accent': fundData.color }}>
                <input
                  type="checkbox"
                  checked={fundData.autoAssignWeeklyDues}
                  onChange={(e) => setFundData((f) => ({ ...f, autoAssignWeeklyDues: e.target.checked }))}
                />
                <span className="ft-switch__track"><span className="ft-switch__thumb" /></span>
                <span className="ft-switch__text">
                  <span className="ft-switch__title">Collect weekly dues here</span>
                  <span className="ft-switch__hint">Every new dues payment is routed into this fund. Only one fund can hold this at a time.</span>
                </span>
              </label>

              <p className="ft-note">
                <Info size={14} />
                <span>Deleting a fund never deletes money. Its transactions simply return to the unallocated pot.</span>
              </p>
            </div>

            <div className="ft-modal__foot ft-modal__foot--split">
              {editingFundId ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ borderRadius: '9999px', color: 'var(--danger)' }}
                  onClick={() => handleDeleteFund({ _id: editingFundId, name: fundData.name })}
                >
                  <Trash2 size={15} /> Delete
                </button>
              ) : <span />}
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="btn btn-secondary" style={{ borderRadius: '9999px' }} onClick={() => setShowFundForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ borderRadius: '9999px', background: fundData.color, borderColor: 'transparent' }}>
                  Save fund
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Fund transactions */}
      {fundTxModal.isOpen && fundTxModal.fund && (
        <Modal
          onClose={() => setFundTxModal({ isOpen: false, fund: null, transactions: [], loading: false, page: 1, totalPages: 1 })}
          size="ft-modal--lg"
          accent={fundTxModal.fund.color || 'var(--primary)'}
          titleId="ft-fundtx-title"
        >
          <div className="ft-modal__head">
            <div>
              <h3 className="ft-modal__title" id="ft-fundtx-title">{fundTxModal.fund.name}</h3>
              <p className="ft-modal__sub">
                {peso(fundTxModal.fund.currentBalance)} available · {fundTxModal.fund.transactionCount ?? 0} records
              </p>
            </div>
            <button
              className="ft-iconbtn"
              onClick={() => setFundTxModal({ isOpen: false, fund: null, transactions: [], loading: false, page: 1, totalPages: 1 })}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="ft-modal__body">
            {fundTxModal.loading ? (
              <SkeletonList rows={5} />
            ) : fundTxModal.transactions.length === 0 ? (
              <EmptyState icon={<Coins size={24} />} title="No transactions" text="Nothing has been assigned to this fund yet." />
            ) : (
              <div className="ft-txlist" style={{ display: 'flex' }}>
                {fundTxModal.transactions.map((tx) => (
                  <article key={tx._id} className="ft-txcard">
                    <div className="ft-txcard__top">
                      <div style={{ minWidth: 0 }}>
                        <h4 className="ft-txcard__title">{tx.category}</h4>
                        <div className="ft-txcard__meta">
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {new Date(tx.date).toLocaleDateString()}
                          </span>
                          <span className={`ft-chip ${tx.type === 'INCOME' ? 'ft-chip--in' : 'ft-chip--out'}`}>
                            {tx.type === 'INCOME' ? 'In' : 'Out'}
                          </span>
                        </div>
                      </div>
                      <span className={`ft-amount ${tx.type === 'INCOME' ? 'is-in' : 'is-out'}`}>
                        {tx.type === 'INCOME' ? '+' : '−'}{peso(tx.amount)}
                      </span>
                    </div>
                    {tx.description && <div className="ft-txcard__desc">{tx.description}</div>}
                  </article>
                ))}
              </div>
            )}
          </div>

          {fundTxModal.totalPages > 1 && (
            <div className="ft-modal__foot" style={{ justifyContent: 'center' }}>
              <button className="ft-pager__btn" disabled={fundTxModal.page === 1} onClick={() => loadFundTxPage(fundTxModal.page - 1)}>
                <ChevronLeft size={14} />
              </button>
              <span className="ft-pager__info">Page {fundTxModal.page} of {fundTxModal.totalPages}</span>
              <button className="ft-pager__btn" disabled={fundTxModal.page === fundTxModal.totalPages} onClick={() => loadFundTxPage(fundTxModal.page + 1)}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Modal>
      )}

      {/* Link user */}
      {linkModal.isOpen && (
        <Modal onClose={closeLinkModal} size="ft-modal--sm" accent="var(--primary)" titleId="ft-link-title">
          <div className="ft-modal__head">
            <div>
              <h3 className="ft-modal__title" id="ft-link-title">Link an account</h3>
              <p className="ft-modal__sub">
                Linking lets <strong>{linkModal.member?.name}</strong> receive their own dues statement by email.
              </p>
            </div>
            <button className="ft-iconbtn" onClick={closeLinkModal} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          <div className="ft-modal__body">
            <div className="ft-search">
              <Search size={15} />
              <input
                autoFocus
                className="ft-input"
                type="search"
                value={userSearchQuery}
                onChange={(e) => {
                  setUserSearchQuery(e.target.value);
                  if (!e.target.value.trim()) setUserSearchResults([]);
                }}
                placeholder="Search registered members…"
                aria-label="Search users"
              />
            </div>

            <div className="ft-scrollbox" style={{ padding: 0, maxHeight: '14rem' }}>
              {searchingUsers ? (
                <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Searching…</p>
              ) : userSearchResults.length === 0 ? (
                <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                  {userSearchQuery ? 'No accounts found.' : 'Start typing to search.'}
                </p>
              ) : (
                userSearchResults.map((u) => (
                  <button key={u._id} className="ft-userrow" onClick={() => handleConfirmLink(u._id)}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                      <span className="ft-avatar" aria-hidden="true">{initials(u.displayName)}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{u.displayName}</span>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{u.role}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="ft-modal__foot">
            <button className="btn btn-secondary" style={{ borderRadius: '9999px' }} onClick={closeLinkModal}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Alert */}
      {alertDialog.isOpen && (
        <Modal onClose={closeAlert} size="ft-modal--sm" titleId="ft-alert-title">
          <div className="ft-modal__body" style={{ padding: '2rem 1.5rem 1rem', textAlign: 'center' }}>
            <h3 className="ft-modal__title" id="ft-alert-title">{alertDialog.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>{alertDialog.message}</p>
          </div>
          <div className="ft-modal__foot">
            <button autoFocus className="btn btn-primary" style={{ width: '100%', borderRadius: '9999px' }} onClick={closeAlert}>
              OK
            </button>
          </div>
        </Modal>
      )}

      {/* Receipt lightbox. Uses the same Escape/scroll-lock handling as the
          other dialogs rather than a bare div. */}
      {lightbox && (
        <LightboxOverlay onClose={() => setLightbox('')}>
          <div className="ft-lightbox__bar">
            <a
              className="ft-iconbtn"
              href={lightbox}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open full size"
              style={{ color: '#fff' }}
            >
              <FileText size={18} />
            </a>
            <button className="ft-iconbtn" style={{ color: '#fff' }} onClick={() => setLightbox('')} aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <img src={lightbox} alt="Receipt" onClick={(e) => e.stopPropagation()} />
        </LightboxOverlay>
      )}

      {/* Confirm */}
      {confirmDialog.isOpen && (
        <Modal onClose={closeConfirm} size="ft-modal--sm" accent="var(--danger)" titleId="ft-confirm-title">
          <div className="ft-modal__body" style={{ padding: '1.75rem 1.5rem 1rem', textAlign: 'center' }}>
            <h3 className="ft-modal__title" id="ft-confirm-title">{confirmDialog.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5, margin: 0 }}>{confirmDialog.message}</p>
          </div>
          <div className="ft-modal__foot">
            <button className="btn btn-secondary" style={{ flex: 1, borderRadius: '9999px' }} onClick={closeConfirm}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              style={{ flex: 1, borderRadius: '9999px' }}
              onClick={() => {
                if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                closeConfirm();
              }}
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
