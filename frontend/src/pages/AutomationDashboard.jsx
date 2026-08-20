import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Calendar, Plus, Trash2, X, MessageSquare, Clock, Link as LinkIcon, Edit2, List,
  Timer, BookOpen, Key, Copy, Play, Eye, Search, Users, RotateCcw, CheckCircle2,
  AlertTriangle, XCircle, Info, Send, Target, Zap, RefreshCw, Pause
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';
import { generateQueueFromAssignments } from '../utils/excelParser';
import MemberDirectory from '../components/MemberDirectory';
import PopupModal from '../components/PopupModal';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

/* ──────────────────────────────────────────────────────────────────────────
   Automation Hub — the admin console for scheduled Messenger dispatches.

   Each schedule owns a GitHub Actions workflow file; the backend scheduler
   fires that workflow on a UTC cron with a fully resolved message. This page
   is where an admin answers the three operational questions:

     1. Will it fire?     → status rail + per-card next-run countdown
     2. What will it say? → the Preview action, resolved by the same backend
                            code path the cron uses
     3. Did it work?      → last-run state on the card, full history behind it

   Times are entered and displayed in the browser's local zone and stored as
   UTC crons, which is why every cron string round-trips through the helpers
   below rather than being shown raw.
   ────────────────────────────────────────────────────────────────────────── */

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

const DAY_PRESETS = [
  { label: 'Weekdays', days: [1, 2, 3, 4, 5] },
  { label: 'Weekend', days: [0, 6] },
  { label: 'Every day', days: [0, 1, 2, 3, 4, 5, 6] }
];

/* Placeholders the backend replaces on every run, whatever the roles are. */
const BUILTIN_TOKENS = ['Date', 'WeeklyCode'];

/* A reminder is resolved on a different code path that substitutes far less:
   the person, the role name, the weekly code, and the calendar roles. No date
   token is replaced there, so offering one would only ever be sent literally. */
const REMINDER_TOKENS = ['Name', 'Role', 'WeeklyCode'];
const REMINDER_DATE_TOKENS = ['date', 'date next sunday', 'date_next_sunday', 'date_today', 'date_tomorrow'];

const EMPTY_FORM = {
  name: '',
  targetUrl: '',
  targetRole: '',
  advanceWeeks: 1,
  message: '',
  time: '12:00',
  selectedDays: [],
  enableCodeBroadcast: false,
  codeTime: '08:00',
  codeSelectedDays: [],
  codeTemplate: 'DFCCI-S-LU-{DATE}',
  roleReminders: []
};

/* EMPTY_FORM carries nested arrays, so every reset takes a fresh clone — one
   in-place edit would otherwise poison the constant for the page's lifetime. */
const makeEmptyForm = () => ({
  ...EMPTY_FORM,
  selectedDays: [],
  codeSelectedDays: [],
  roleReminders: []
});

const NEW_REMINDER = {
  daysPrior: [2, 4],
  messageTemplate: 'Hi {Name}! Just a reminder that you are on {Role} this Sunday. Please confirm when you can.'
};

const LOCAL_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

/* ── Cron helpers ─────────────────────────────────────────────────────────
   The stored cron is always `m h * * d[,d…]` in UTC. Converting a local
   weekday to UTC can shift the day, which is why the day set is rebuilt from
   a real Date rather than by offsetting numbers. */

const localToUtcCron = (timeString, localDays) => {
  if (!timeString || !localDays || localDays.length === 0) return '';

  const [hours, minutes] = timeString.split(':').map(Number);
  const utcDays = new Set();
  let utcHours = 0;
  let utcMinutes = 0;

  localDays.forEach(localDayOfWeek => {
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    date.setDate(date.getDate() + (localDayOfWeek - date.getDay()));

    utcMinutes = date.getUTCMinutes();
    utcHours = date.getUTCHours();
    utcDays.add(date.getUTCDay());
  });

  return `${utcMinutes} ${utcHours} * * ${Array.from(utcDays).sort().join(',')}`;
};

const utcCronToLocal = (cronString) => {
  const parts = (cronString || '').split(' ');
  if (parts.length !== 5) return { time: '12:00', days: [] };

  const utcMinutes = parseInt(parts[0], 10);
  const utcHours = parseInt(parts[1], 10);
  if (Number.isNaN(utcHours) || Number.isNaN(utcMinutes)) return { time: '12:00', days: [] };

  const days = new Set();
  let time = '';

  parts[4].split(',').map(Number).forEach(utcDay => {
    // 1 Jan 2023 was a Sunday, so +utcDay lands on the matching weekday.
    const date = new Date(Date.UTC(2023, 0, 1 + utcDay, utcHours, utcMinutes));
    days.add(date.getDay());
    if (!time) {
      time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  });

  return { time: time || '12:00', days: Array.from(days).sort() };
};

const describeCron = (cronString) => {
  const { time, days } = utcCronToLocal(cronString);
  if (days.length === 0) return 'No schedule';

  const [h, m] = time.split(':').map(Number);
  const label = new Date(2023, 0, 1, h, m).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  let when;
  if (days.length === 7) when = 'day';
  else if (days.length === 2 && days.includes(0) && days.includes(6)) when = 'weekend';
  else if (days.length === 5 && !days.includes(0) && !days.includes(6)) when = 'weekday';
  else when = days.map(d => DAYS_OF_WEEK[d].label).join(', ');

  return `Every ${when} at ${label}`;
};

const nextRunAt = (cronString, from = new Date()) => {
  const parts = (cronString || '').split(' ');
  if (parts.length !== 5) return null;

  const utcMinutes = parseInt(parts[0], 10);
  const utcHours = parseInt(parts[1], 10);
  if (Number.isNaN(utcHours) || Number.isNaN(utcMinutes)) return null;

  const utcDays = parts[4].split(',').map(Number);

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = new Date(from);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    candidate.setUTCHours(utcHours, utcMinutes, 0, 0);
    if (utcDays.includes(candidate.getUTCDay()) && candidate > from) return candidate;
  }
  return null;
};

const formatCountdown = (target, from = new Date()) => {
  if (!target) return '';
  const diff = target - from;
  if (diff <= 0) return 'now';

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const countdownLabel = (target, from) => {
  const value = formatCountdown(target, from);
  return value === 'now' ? 'due now' : `in ${value}`;
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const formatDateKey = (key) => {
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1)
    .toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatTimestamp = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/* Lineups fall on Sundays, so a reminder offset is really a weekday. Admins
   reason in "Wednesday", not in "four days before". */
const reminderDayLabel = (offset) => {
  if (offset === 0) return 'Sun · day of';
  const weekday = DAYS_OF_WEEK[(7 - (offset % 7)) % 7].label;
  const weeks = Math.floor(offset / 7);
  return weeks > 0 ? `${weekday} · ${weeks}w before` : weekday;
};

/* ── Token helpers ───────────────────────────────────────────────────────── */

const TOKEN_RE = /\{([^{}]+)\}/g;

const tokensIn = (text) => {
  const found = [];
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text || '')) !== null) found.push(match[1].trim());
  return found;
};

const isKnownToken = (token, knownRoles) => {
  const needle = token.trim().toLowerCase();
  if (BUILTIN_TOKENS.some(t => t.toLowerCase() === needle)) return true;
  if (['date next sunday', 'date_next_sunday', 'date_today', 'date_tomorrow', 'name', 'role']
    .includes(needle)) return true;
  return knownRoles.some(role => role.toLowerCase() === needle);
};

/* Renders {Presider} as a chip so a typo'd tag is visible at a glance. */
const renderWithTokens = (text, knownRoles) => {
  const nodes = [];
  let cursor = 0;
  let match;
  TOKEN_RE.lastIndex = 0;

  while ((match = TOKEN_RE.exec(text || '')) !== null) {
    if (match.index > cursor) nodes.push(text.slice(cursor, match.index));
    const known = isKnownToken(match[1], knownRoles);
    nodes.push(
      <span key={`${match.index}-${match[1]}`} className={`ah-token${known ? '' : ' is-unknown'}`}>
        {match[0]}
      </span>
    );
    cursor = match.index + match[0].length;
  }

  if (cursor < (text || '').length) nodes.push(text.slice(cursor));
  return nodes;
};

/* Mirrors the substitution the scheduler performs, for the composer preview. */
const resolveSample = (template, roles, dateKey, weeklyCode) => {
  if (!template) return '';
  let out = template;

  if (dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const formatted = new Date(y, (m || 1) - 1, d || 1)
      .toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' })
      .toUpperCase();
    out = out
      .replace(/{Date Next Sunday}/gi, formatted)
      .replace(/{DATE_NEXT_SUNDAY}/gi, formatted)
      .replace(/{DATE_TOMORROW}/gi, formatted)
      .replace(/{DATE_TODAY}/gi, formatted)
      .replace(/{Date}/gi, formatted);
  }

  Object.keys(roles || {}).forEach(role => {
    const safe = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`{${safe}}`, 'gi'), roles[role]);
  });

  return out.replace(/{WeeklyCode}/gi, weeklyCode || 'DFCCI-S-LU-…');
};

/* ── Shared modal shell ──────────────────────────────────────────────────── */

function Modal({ icon: Icon, title, subtitle, onClose, children, footer, size = '' }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="ah-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`ah-panel ${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="ah-panel-head">
          <div>
            <h3>{Icon && <Icon size={20} />}{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ah-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ah-panel-body">{children}</div>
        {footer && <div className="ah-panel-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/* A refresh in the middle of composing should not lose the draft. Read it once,
   as initial state, rather than patching state in after the first render. */
const readDraft = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem('ma_draft') || 'null');
    if (!parsed || !parsed.isModalOpen) return null;
    // A draft written by an older build — or a corrupted one — must not be able
    // to hand the editor something it will try to map over.
    if (parsed.formData && !Array.isArray(parsed.formData.roleReminders)) {
      parsed.formData.roleReminders = [];
    }
    return parsed;
  } catch {
    return null; // a corrupt draft is not worth surfacing
  }
};

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function AutomationDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && user.role !== 'ADMIN') navigate('/dashboard');
  }, [user, navigate]);

  // ── Data ────────────────────────────────────────────────────────────────
  const [schedules, setSchedules] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [weeklyCodeConfig, setWeeklyCodeConfig] = useState(null);

  // ── Chrome ──────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [now, setNow] = useState(() => new Date());
  const [toasts, setToasts] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isAlert: false });

  // ── Editor ──────────────────────────────────────────────────────────────
  const [draft] = useState(readDraft);
  const [isEditorOpen, setIsEditorOpen] = useState(Boolean(draft));
  const [editingId, setEditingId] = useState(draft?.editingId || null);
  const [formData, setFormData] = useState(draft ? { ...makeEmptyForm(), ...draft.formData } : makeEmptyForm());
  const [isRoleMode, setIsRoleMode] = useState(Boolean(draft?.isRoleMode));
  // True when this schedule's per-date queue tracks the message template.
  const [autoQueue, setAutoQueue] = useState(Boolean(draft?.autoQueue));
  const [loadedQueue, setLoadedQueue] = useState(draft?.messageQueue || []);
  /* The templates that produced loadedQueue. Rebuilding needs them to tell a
     message an admin typed by hand from one the old template generated. */
  const [savedTemplate, setSavedTemplate] = useState(draft?.savedTemplate || null);
  const [isSaving, setIsSaving] = useState(false);

  const [queueFor, setQueueFor] = useState(null);      // schedule id
  const [queueDraft, setQueueDraft] = useState([]);
  const [queueSearch, setQueueSearch] = useState('');
  const [queueTab, setQueueTab] = useState('upcoming');
  const [openQueueDate, setOpenQueueDate] = useState(null);
  const [confirmations, setConfirmations] = useState({}); // schedule id -> payload, or null when it failed

  const [runsFor, setRunsFor] = useState(null);        // schedule id
  const [runsData, setRunsData] = useState({});        // schedule id -> /runs payload
  const [preview, setPreview] = useState(null);        // { schedule, data }
  const [showCodePanel, setShowCodePanel] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  // Weekly-code panel form
  const [codeTemplateDraft, setCodeTemplateDraft] = useState('DFCCI-S-LU-{DATE}');
  const [enableDispatch, setEnableDispatch] = useState(false);
  const [dispatchUrl, setDispatchUrl] = useState('');
  const [dispatchDay, setDispatchDay] = useState('0');
  const [dispatchTime, setDispatchTime] = useState('13:00');
  const [dispatchMessage, setDispatchMessage] = useState('Here is the weekly code: {WeeklyCode}');
  const [isSavingDispatch, setIsSavingDispatch] = useState(false);

  const messageRef = useRef(null);
  const askedForConfirmations = useRef(new Set());

  const showAlert = (title, message) =>
    setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true });
  const showConfirm = (title, message, onConfirm) =>
    setPopup({ isOpen: true, title, message, onConfirm, isAlert: false });

  const toast = useCallback((message, tone = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5200);
  }, []);

  // Countdowns stay honest without hammering re-renders.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // ── Loading ─────────────────────────────────────────────────────────────
  const fetchSchedules = useCallback(async () => {
    try {
      const res = await api.get('/automation/schedules');
      setSchedules(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load schedules', error);
      toast('Could not load schedules.', 'error');
    }
  }, [toast]);

  const fetchWeeklyCodeConfig = useCallback(async () => {
    try {
      const res = await api.get('/settings/weekly-code');
      setWeeklyCodeConfig(res.data);
      if (res.data) {
        setCodeTemplateDraft(res.data.template || 'DFCCI-S-LU-{DATE}');
        setEnableDispatch(res.data.enableDispatch || false);
        setDispatchUrl(res.data.dispatchUrl || '');
        const cronParts = (res.data.dispatchCron || '0 13 * * 0').split(' ');
        if (cronParts.length >= 5) {
          setDispatchTime(`${cronParts[1].padStart(2, '0')}:${cronParts[0].padStart(2, '0')}`);
          setDispatchDay(cronParts[4]);
        }
        setDispatchMessage(res.data.dispatchMessage || 'Here is the weekly code: {WeeklyCode}');
      }
    } catch (err) {
      console.error('Failed to fetch weekly code config:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchSchedules(),
        fetchWeeklyCodeConfig(),
        (async () => {
          try {
            const res = await api.get('/calendar');
            if (cancelled) return;
            const roles = new Set();
            const map = {};
            res.data.forEach(item => {
              Object.keys(item.roles || {}).forEach(r => roles.add(r));
              if (Object.keys(item.roles || {}).length > 0) map[item.targetDate] = item.roles;
            });
            setAvailableRoles(Array.from(roles));
            setAssignments(map);
          } catch (err) {
            console.error('Failed to load roles', err);
          }
        })()
      ]);
      if (!cancelled) setIsLoading(false);
    };

    load();

    return () => { cancelled = true; };
  }, [fetchSchedules, fetchWeeklyCodeConfig]);

  /* Role schedules rebuild their per-date queue from the serving calendar every
     time the template changes, so it is derived rather than stored. The rebuild
     is a merge, not a replacement: a per-date chat URL, the sent flag, and any
     message an admin hand-edited from the queue have to survive a template
     change, otherwise saving the editor quietly undoes that work. */
  const messageQueue = useMemo(() => {
    if (!autoQueue) return loadedQueue;
    if (!formData.message) return [];

    const generated = generateQueueFromAssignments(assignments, formData.message, formData.codeTemplate);
    if (loadedQueue.length === 0) return generated;

    const previous = new Map(loadedQueue.map(item => [item.targetDate, item]));
    // What the stored template produced for each date; anything else is an edit.
    const baseline = new Map(savedTemplate
      ? generateQueueFromAssignments(assignments, savedTemplate.message, savedTemplate.codeTemplate)
        .map(item => [item.targetDate, item.messageText])
      : []);

    return generated.map(item => {
      const prior = previous.get(item.targetDate);
      if (!prior) return item;
      const isHandEdited = Boolean(prior.messageText)
        && prior.messageText !== item.messageText
        && prior.messageText !== baseline.get(item.targetDate);
      return {
        ...item,
        ...(prior.overrideChatUrl ? { overrideChatUrl: prior.overrideChatUrl } : {}),
        messageText: isHandEdited ? prior.messageText : item.messageText,
        isSent: Boolean(prior.isSent)
      };
    });
  }, [autoQueue, loadedQueue, savedTemplate, formData.message, formData.codeTemplate, assignments]);

  // Auto-save the editor draft
  useEffect(() => {
    localStorage.setItem('ma_draft', JSON.stringify({
      isModalOpen: isEditorOpen, formData, editingId, messageQueue, isRoleMode, autoQueue, savedTemplate
    }));
  }, [isEditorOpen, formData, editingId, messageQueue, isRoleMode, autoQueue, savedTemplate]);

  // ── Derived state ───────────────────────────────────────────────────────
  const today = todayKey();

  const decorated = useMemo(() => schedules.map(schedule => {
    const upcoming = (schedule.messageQueue || [])
      .filter(q => !q.isSent && q.targetDate >= today)
      .sort((a, b) => a.targetDate.localeCompare(b.targetDate));

    return {
      ...schedule,
      isActive: schedule.isActive !== false,
      nextRun: schedule.isActive === false ? null : nextRunAt(schedule.cronTime, now),
      upcomingCount: upcoming.length,
      nextItem: upcoming[0] || null
    };
  }), [schedules, now, today]);

  const counts = useMemo(() => ({
    all: decorated.length,
    group: decorated.filter(s => !s.targetRole).length,
    role: decorated.filter(s => s.targetRole).length,
    paused: decorated.filter(s => !s.isActive).length
  }), [decorated]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return decorated
      .filter(s => {
        if (filter === 'group' && s.targetRole) return false;
        if (filter === 'role' && !s.targetRole) return false;
        if (filter === 'paused' && s.isActive) return false;
        if (!needle) return true;
        return `${s.scheduleName} ${s.message} ${s.targetRole || ''}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        if (a.nextRun && b.nextRun) return a.nextRun - b.nextRun;
        if (a.nextRun) return -1;
        if (b.nextRun) return 1;
        return a.scheduleName.localeCompare(b.scheduleName);
      });
  }, [decorated, filter, search]);

  const nextUp = useMemo(
    () => decorated.filter(s => s.isActive && s.nextRun).sort((a, b) => a.nextRun - b.nextRun)[0] || null,
    [decorated]
  );

  const queuedTotal = useMemo(
    () => decorated.reduce((sum, s) => sum + s.upcomingCount, 0),
    [decorated]
  );

  const sampleDate = useMemo(
    () => Object.keys(assignments).filter(k => k >= today).sort()[0] || Object.keys(assignments).sort().pop() || '',
    [assignments, today]
  );

  const unknownTokens = useMemo(
    () => Array.from(new Set(tokensIn(formData.message).filter(t => !isKnownToken(t, availableRoles)))),
    [formData.message, availableRoles]
  );

  /* A reminder can only fire for a lineup the run actually looks at, and the
     run looks `advanceWeeks` weeks ahead — so offsets beyond that are dead. */
  const reminderHorizon = (isRoleMode ? parseInt(formData.advanceWeeks, 10) || 1 : 1) * 7;

  const reminderOffsets = useMemo(
    () => Array.from({ length: reminderHorizon + 1 }, (_, i) => i),
    [reminderHorizon]
  );

  const composerPreview = useMemo(
    () => resolveSample(formData.message, assignments[sampleDate], sampleDate, weeklyCodeConfig?.currentCode),
    [formData.message, assignments, sampleDate, weeklyCodeConfig]
  );

  // ── Editor ──────────────────────────────────────────────────────────────
  const openEditor = (schedule = null) => {
    if (schedule) {
      const main = utcCronToLocal(schedule.cronTime);
      const code = schedule.codeCronTime ? utcCronToLocal(schedule.codeCronTime) : { time: '08:00', days: [] };
      setEditingId(schedule._id);
      setFormData({
        name: schedule.scheduleName,
        targetUrl: schedule.chatUrl || '',
        targetRole: schedule.targetRole || '',
        advanceWeeks: schedule.advanceWeeks || 1,
        message: schedule.message,
        time: main.time,
        selectedDays: main.days,
        enableCodeBroadcast: schedule.enableCodeBroadcast || false,
        codeTime: code.time,
        codeSelectedDays: code.days,
        codeTemplate: schedule.codeTemplate || 'DFCCI-S-LU-{DATE}',
        roleReminders: (schedule.roleReminders || []).map(rule => ({
          role: rule.role || '',
          daysPrior: [...(rule.daysPrior || [])],
          messageTemplate: rule.messageTemplate || ''
        }))
      });
      setLoadedQueue(schedule.messageQueue || []);
      // What the stored queue was generated from, so a later rebuild can tell a
      // hand-edited message from one the old template produced.
      setSavedTemplate({ message: schedule.message, codeTemplate: schedule.codeTemplate || 'DFCCI-S-LU-{DATE}' });
      setIsRoleMode(Boolean(schedule.targetRole));
      setAutoQueue(Boolean(schedule.targetRole) || (schedule.messageQueue || []).length > 0);
    } else {
      setEditingId(null);
      setFormData(makeEmptyForm());
      setLoadedQueue([]);
      setSavedTemplate(null);
      setIsRoleMode(false);
      setAutoQueue(false);
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingId(null);
    setFormData(makeEmptyForm());
    setLoadedQueue([]);
    setSavedTemplate(null);
    setIsRoleMode(false);
    setAutoQueue(false);
  };

  const toggleDay = (dayValue, isCode = false) => {
    setFormData(prev => {
      const key = isCode ? 'codeSelectedDays' : 'selectedDays';
      const current = prev[key];
      return {
        ...prev,
        [key]: current.includes(dayValue) ? current.filter(d => d !== dayValue) : [...current, dayValue]
      };
    });
  };

  const addReminder = () => setFormData(prev => ({
    ...prev,
    roleReminders: [...prev.roleReminders, {
      role: availableRoles[0] || '',
      daysPrior: [...NEW_REMINDER.daysPrior],
      messageTemplate: NEW_REMINDER.messageTemplate
    }]
  }));

  const updateReminder = (index, patch) => setFormData(prev => ({
    ...prev,
    roleReminders: prev.roleReminders.map((rule, i) => (i === index ? { ...rule, ...patch } : rule))
  }));

  const removeReminder = (index) => setFormData(prev => ({
    ...prev,
    roleReminders: prev.roleReminders.filter((_, i) => i !== index)
  }));

  const toggleReminderDay = (index, offset) => setFormData(prev => ({
    ...prev,
    roleReminders: prev.roleReminders.map((rule, i) => {
      if (i !== index) return rule;
      const daysPrior = rule.daysPrior.includes(offset)
        ? rule.daysPrior.filter(d => d !== offset)
        : [...rule.daysPrior, offset].sort((a, b) => a - b);
      return { ...rule, daysPrior };
    })
  }));

  const insertToken = (token) => {
    const field = messageRef.current;
    const snippet = `{${token}}`;
    if (!field) {
      setFormData(prev => ({ ...prev, message: `${prev.message}${snippet}` }));
      return;
    }
    const { selectionStart, selectionEnd, value } = field;
    const next = `${value.slice(0, selectionStart)}${snippet}${value.slice(selectionEnd)}`;
    setFormData(prev => ({ ...prev, message: next }));
    requestAnimationFrame(() => {
      field.focus();
      const caret = selectionStart + snippet.length;
      field.setSelectionRange(caret, caret);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.selectedDays.length === 0) {
      showAlert('Pick a day', 'Choose at least one day for this schedule to run on.');
      return;
    }
    if (formData.enableCodeBroadcast && formData.codeSelectedDays.length === 0) {
      showAlert('Pick a day', 'Choose at least one day for the confirmation code broadcast.');
      return;
    }

    const incomplete = formData.roleReminders.find(
      rule => !rule.role || rule.daysPrior.length === 0 || !rule.messageTemplate.trim()
    );
    if (incomplete) {
      showAlert('Finish the reminder', 'Every role reminder needs a role, at least one day, and a message.');
      return;
    }

    /* Saving sends the whole queue, and for an auto-queue schedule that queue is
       rebuilt from the serving calendar. If the calendar has not arrived — a
       failed fetch, or a restored draft that reopened the editor before the
       request landed — rebuilding would send an empty queue and silently strand
       every lineup. */
    if (autoQueue && Object.keys(assignments).length === 0) {
      showAlert(
        isLoading ? 'Still loading' : 'No serving calendar',
        isLoading
          ? 'The serving calendar is still loading. Give it a moment and save again.'
          : 'The serving calendar has no assignments, so saving now would clear this schedule’s queue. Fill in the calendar first.'
      );
      return;
    }

    const payload = {
      scheduleName: formData.name,
      cronTime: localToUtcCron(formData.time, formData.selectedDays),
      codeCronTime: formData.enableCodeBroadcast
        ? localToUtcCron(formData.codeTime, formData.codeSelectedDays)
        : '',
      enableCodeBroadcast: formData.enableCodeBroadcast,
      codeTemplate: formData.codeTemplate,
      chatUrl: formData.targetUrl,
      targetRole: isRoleMode ? formData.targetRole : '',
      advanceWeeks: isRoleMode ? parseInt(formData.advanceWeeks, 10) : 1,
      message: formData.message,
      messageQueue,
      roleReminders: formData.roleReminders
    };

    try {
      setIsSaving(true);
      if (editingId) {
        const res = await api.put(`/automation/schedule/${editingId}`, payload);
        setSchedules(prev => prev.map(s => (s._id === editingId ? res.data.data : s)));
        toast('Schedule updated.', 'success');
      } else {
        const res = await api.post('/automation/schedule', payload);
        setSchedules(prev => [res.data.data, ...prev]);
        toast('Schedule created.', 'success');
      }
      closeEditor();
    } catch (error) {
      const detail = error.response?.data?.msg || error.response?.data?.error || error.message;
      console.error('Failed to save automation:', error.response?.data || error.message);
      showAlert('Could not save', detail);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Card actions ────────────────────────────────────────────────────────
  const handleToggleActive = async (schedule) => {
    const next = !schedule.isActive;
    setBusyId(schedule._id);
    try {
      const res = await api.patch(`/automation/schedule/${schedule._id}/active`, { isActive: next });
      setSchedules(prev => prev.map(s => (s._id === schedule._id ? res.data.data : s)));
      toast(next ? `"${schedule.scheduleName}" resumed.` : `"${schedule.scheduleName}" paused.`, next ? 'success' : 'warning');
    } catch (error) {
      toast(error.response?.data?.msg || 'Could not change the schedule state.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handlePreview = async (schedule) => {
    setBusyId(schedule._id);
    try {
      const res = await api.post(`/automation/schedule/${schedule._id}/run`, { actionType: 'MAIN', dryRun: true });
      setPreview({ schedule, data: res.data.data });
    } catch (error) {
      toast(error.response?.data?.msg || 'Could not resolve a preview.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRunNow = (schedule) => {
    showConfirm(
      'Send now?',
      `This dispatches "${schedule.scheduleName}" immediately — real messages, right now. Preview it first if you are unsure.`,
      async () => {
        setBusyId(schedule._id);
        try {
          const res = await api.post(`/automation/schedule/${schedule._id}/run`, { actionType: 'MAIN' });
          const { result, schedule: updated } = res.data.data;
          if (updated) setSchedules(prev => prev.map(s => (s._id === schedule._id ? updated : s)));
          toast(
            result.ok ? `Dispatched — ${result.detail}` : `Nothing sent: ${result.detail}`,
            result.ok ? 'success' : 'warning'
          );
        } catch (error) {
          toast(error.response?.data?.msg || 'The run failed.', 'error');
        } finally {
          setBusyId(null);
        }
      }
    );
  };

  const handleDuplicate = async (schedule) => {
    setBusyId(schedule._id);
    try {
      const res = await api.post(`/automation/schedule/${schedule._id}/duplicate`);
      setSchedules(prev => [res.data.data, ...prev]);
      toast('Copy created — it starts paused so nothing double-sends.', 'success');
    } catch (error) {
      toast(error.response?.data?.msg || 'Could not duplicate the schedule.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (schedule) => {
    showConfirm(
      'Delete schedule',
      `"${schedule.scheduleName}" will be removed from the database and its GitHub workflow deleted. Pause it instead if you only want to stop it for now.`,
      async () => {
        try {
          await api.delete(`/automation/schedule/${schedule._id}`);
          setSchedules(prev => prev.filter(s => s._id !== schedule._id));
          toast('Schedule deleted.', 'success');
        } catch {
          toast('Failed to delete the schedule.', 'error');
        }
      }
    );
  };

  const openQueue = (schedule) => {
    setQueueFor(schedule._id);
    setQueueDraft((schedule.messageQueue || []).map(q => ({ ...q })));
    setQueueSearch('');
    setQueueTab('upcoming');
    setOpenQueueDate(null);
    loadConfirmations(schedule._id);
  };

  /* Who has replied with their confirmation code. The reader bot writes on its
     own two-hourly cadence, so this is refetched each time the queue is opened
     rather than cached for the session — but only once per open. */
  const loadConfirmations = async (scheduleId) => {
    if (askedForConfirmations.current.has(scheduleId)) return;
    askedForConfirmations.current.add(scheduleId);
    try {
      const res = await api.get(`/automation/schedule/${scheduleId}/confirmations`);
      setConfirmations(prev => ({ ...prev, [scheduleId]: res.data }));
    } catch {
      // A missing confirmation view is not worth interrupting the admin over;
      // the rows simply render without a chip.
      setConfirmations(prev => ({ ...prev, [scheduleId]: null }));
    } finally {
      askedForConfirmations.current.delete(scheduleId);
    }
  };

  /* Run history is read from its own endpoint rather than the schedules payload,
     because that request is what resolves pending GitHub run links. */
  const openRuns = async (schedule) => {
    setRunsFor(schedule._id);
    try {
      const res = await api.get(`/automation/schedule/${schedule._id}/runs`);
      setRunsData(prev => ({ ...prev, [schedule._id]: res.data }));
    } catch {
      // The already-loaded runHistory stays on screen.
    }
  };

  const saveQueueItem = async (item) => {
    try {
      await api.patch(`/automation/schedule/${queueFor}/queue`, {
        targetDate: item.targetDate,
        messageText: item.messageText,
        overrideChatUrl: item.overrideChatUrl
      });
      setSchedules(prev => prev.map(s => {
        if (s._id !== queueFor) return s;
        const queue = (s.messageQueue || []).map(q =>
          q.targetDate === item.targetDate
            ? { ...q, messageText: item.messageText, overrideChatUrl: item.overrideChatUrl }
            : q
        );
        return { ...s, messageQueue: queue };
      }));
      toast(`${formatDateKey(item.targetDate)} saved.`, 'success');
    } catch {
      toast('Could not save that queue item.', 'error');
    }
  };

  const copyToClipboard = (value, label = 'Copied') => {
    navigator.clipboard?.writeText(value);
    toast(`${label} copied to clipboard.`, 'success');
  };

  // ── Weekly code panel ───────────────────────────────────────────────────
  const saveWeeklyCode = async (options = {}) => {
    try {
      setIsSavingDispatch(true);
      const [hr, min] = dispatchTime.split(':');
      const res = await api.put('/settings/weekly-code', {
        template: codeTemplateDraft,
        enableDispatch,
        dispatchUrl,
        dispatchCron: `${parseInt(min, 10)} ${parseInt(hr, 10)} * * ${dispatchDay}`,
        dispatchMessage,
        ...options
      });
      setWeeklyCodeConfig(res.data);
      toast(options.forceGenerate ? `New code: ${res.data.currentCode}` : 'Weekly code settings saved.', 'success');
    } catch {
      toast('Could not save the weekly code settings.', 'error');
    } finally {
      setIsSavingDispatch(false);
    }
  };

  // ── Render pieces ───────────────────────────────────────────────────────
  const queueSchedule = decorated.find(s => s._id === queueFor);
  const runsSchedule = decorated.find(s => s._id === runsFor);

  const filteredQueue = useMemo(() => {
    const needle = queueSearch.trim().toLowerCase();
    return queueDraft
      .filter(q => (queueTab === 'upcoming' ? q.targetDate >= today : q.targetDate < today))
      .filter(q => !needle
        || q.targetDate.includes(needle)
        || (q.messageText || '').toLowerCase().includes(needle)
        || Object.values(q.parsedRoles || {}).some(v => String(v).toLowerCase().includes(needle)))
      .sort((a, b) => (queueTab === 'upcoming'
        ? a.targetDate.localeCompare(b.targetDate)
        : b.targetDate.localeCompare(a.targetDate)));
  }, [queueDraft, queueTab, queueSearch, today]);

  const runRows = useMemo(() => {
    const enriched = runsFor ? runsData[runsFor] : null;
    const rows = enriched?.runs || runsSchedule?.runHistory || [];
    return [...rows].sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [runsFor, runsData, runsSchedule]);

  return (
    <div className="ah-shell">
      <PageHeader
        className="ah-page-header"
        icon={Zap}
        title="Automation Hub"
        subtitle="Scheduled group messages and personalised role reminders, with every dispatch resolved from the serving calendar."
        actions={
          <>
            <Link to="/docs/automation-hub" className="btn btn-secondary page-header-btn-icon" title="Help & documentation">
              <BookOpen size={18} />
            </Link>
            <button type="button" className="btn btn-secondary page-header-btn" onClick={() => navigate('/automation-hub/calendar')}>
              <Calendar size={16} /> Calendar
            </button>
            <button type="button" className="btn btn-primary page-header-btn" onClick={() => openEditor()}>
              <Plus size={16} /> New schedule
            </button>
          </>
        }
      />

      {/* ── Status rail ── */}
      <div className="ah-stats">
        <div className="ah-stat">
          <span className="ah-stat-head"><Send size={13} /> Running</span>
          <span className="ah-stat-value">{counts.all - counts.paused}<span className="ah-stat-total">{` / ${counts.all}`}</span></span>
          <span className="ah-stat-foot">{counts.paused > 0 ? `${counts.paused} paused` : 'All schedules active'}</span>
        </div>

        <div className="ah-stat">
          <span className="ah-stat-head"><Timer size={13} /> Next dispatch</span>
          <span className="ah-stat-value">{nextUp ? formatCountdown(nextUp.nextRun, now) : '—'}</span>
          <span className="ah-stat-foot">{nextUp ? nextUp.scheduleName : 'Nothing scheduled'}</span>
        </div>

        <div className="ah-stat">
          <span className="ah-stat-head"><List size={13} /> Queued lineups</span>
          <span className="ah-stat-value">{queuedTotal}</span>
          <span className="ah-stat-foot">{availableRoles.length} role{availableRoles.length === 1 ? '' : 's'} on the calendar</span>
        </div>

        <div className="ah-stat">
          <span className="ah-stat-head"><Key size={13} /> Weekly code</span>
          <span className="ah-stat-value is-code">{weeklyCodeConfig?.currentCode || '—'}</span>
          <span className="ah-stat-foot">
            {weeklyCodeConfig?.lastGeneratedDate
              ? `Generated ${formatTimestamp(weeklyCodeConfig.lastGeneratedDate)}`
              : 'Regenerates every Sunday'}
          </span>
          <div className="ah-stat-action">
            <button
              type="button"
              className="ah-icon-btn"
              title="Weekly code settings"
              onClick={() => setShowCodePanel(true)}
            >
              <Edit2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="ah-toolbar">
        <div className="ah-search">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search schedules, roles or message text…"
            aria-label="Search schedules"
          />
        </div>

        <div className="ah-segment" role="tablist" aria-label="Filter schedules">
          {[
            { key: 'all', label: 'All', count: counts.all },
            { key: 'group', label: 'Group chat', count: counts.group },
            { key: 'role', label: 'Role', count: counts.role },
            { key: 'paused', label: 'Paused', count: counts.paused }
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={filter === tab.key}
              className={`ah-segment-btn${filter === tab.key ? ' is-active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span className="ah-segment-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <button type="button" className="btn btn-secondary" onClick={() => setShowMembers(true)}>
          <Users size={16} /> Members
        </button>
      </div>

      {/* ── Schedules ── */}
      {isLoading ? (
        <div className="ah-grid">
          {[0, 1, 2].map(i => <div key={i} className="ah-skeleton" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="ah-empty">
          <div className="ah-empty-icon"><Calendar size={28} /></div>
          <h3>{schedules.length === 0 ? 'No schedules yet' : 'Nothing matches that filter'}</h3>
          <p>
            {schedules.length === 0
              ? 'Create a schedule to send a recurring group message, or to nudge whoever is assigned to a role on the serving calendar.'
              : 'Try a different search term, or switch back to All.'}
          </p>
          {schedules.length === 0
            ? <button type="button" className="btn btn-primary" onClick={() => openEditor()}><Plus size={16} /> Create schedule</button>
            : <button type="button" className="btn btn-secondary" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</button>}
        </div>
      ) : (
        <div className="ah-grid">
          {visible.map(schedule => {
            const busy = busyId === schedule._id;
            const last = schedule.lastRun;
            return (
              <article key={schedule._id} className={`ah-card${schedule.isActive ? '' : ' is-paused'}`}>
                <div className="ah-card-top">
                  <div style={{ minWidth: 0 }}>
                    <h3 className="ah-card-title">{schedule.scheduleName}</h3>
                    <div className="ah-chips">
                      <span className="ah-chip ah-chip--primary">
                        <Clock size={11} /> {describeCron(schedule.cronTime)}
                      </span>
                      {schedule.isActive ? (
                        schedule.nextRun && (
                          <span className="ah-chip ah-chip--muted">
                            <Timer size={11} /> {countdownLabel(schedule.nextRun, now)}
                          </span>
                        )
                      ) : (
                        <span className="ah-chip ah-chip--warning"><Pause size={11} /> Paused</span>
                      )}
                      {schedule.targetRole && (
                        <span className="ah-chip ah-chip--info"><Target size={11} /> {schedule.targetRole}</span>
                      )}
                      {schedule.enableCodeBroadcast && (
                        <span className="ah-chip ah-chip--muted"><Key size={11} /> Code broadcast</span>
                      )}
                      {schedule.roleReminders?.length > 0 && (
                        <span className="ah-chip ah-chip--muted">
                          <Users size={11} /> {schedule.roleReminders.length} reminder{schedule.roleReminders.length === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={schedule.isActive}
                    aria-label={schedule.isActive ? 'Pause schedule' : 'Resume schedule'}
                    title={schedule.isActive ? 'Pause' : 'Resume'}
                    className="ah-switch"
                    disabled={busy}
                    onClick={() => handleToggleActive(schedule)}
                  />
                </div>

                {schedule.targetRole ? (
                  <div className="ah-target">
                    <LinkIcon size={13} />
                    <span>
                      {schedule.nextItem?.parsedRoles?.[schedule.targetRole]
                        ? `Next: ${schedule.nextItem.parsedRoles[schedule.targetRole]} · ${formatDateKey(schedule.nextItem.targetDate)}`
                        : 'Sent to whoever holds this role — resolved per lineup'}
                    </span>
                  </div>
                ) : (
                  <a className="ah-target" href={schedule.chatUrl || '#'} target="_blank" rel="noopener noreferrer">
                    <LinkIcon size={13} />
                    <span>{schedule.chatUrl ? schedule.chatUrl.replace(/^https?:\/\//, '') : 'No chat URL set'}</span>
                  </a>
                )}

                <div className="ah-message">
                  <MessageSquare size={13} className="ah-message-icon" />
                  {renderWithTokens(schedule.message, availableRoles)}
                </div>

                <div className="ah-card-foot">
                  <span className="ah-runstate" title={last?.detail || ''}>
                    <span className={`ah-dot ah-dot--${last?.status || 'idle'}`} />
                    {last
                      ? <>Last run <strong>{formatTimestamp(last.at)}</strong></>
                      : <>Never run yet</>}
                  </span>

                  <div className="ah-card-actions">
                    <button type="button" className="ah-icon-btn" title="Preview next message" disabled={busy} onClick={() => handlePreview(schedule)}>
                      <Eye size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn" title="Send now" disabled={busy || !schedule.isActive} onClick={() => handleRunNow(schedule)}>
                      <Play size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn" title={`Message queue (${schedule.upcomingCount} upcoming)`} onClick={() => openQueue(schedule)}>
                      <List size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn" title="Run history" onClick={() => openRuns(schedule)}>
                      <RotateCcw size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn" title="Edit" onClick={() => openEditor(schedule)}>
                      <Edit2 size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn" title="Duplicate" disabled={busy} onClick={() => handleDuplicate(schedule)}>
                      <Copy size={15} />
                    </button>
                    <button type="button" className="ah-icon-btn is-danger" title="Delete" onClick={() => handleDelete(schedule)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Editor ── */}
      {isEditorOpen && (
        <Modal
          icon={editingId ? Edit2 : Plus}
          title={editingId ? 'Edit schedule' : 'New schedule'}
          subtitle={`Times are in ${LOCAL_ZONE} and stored as UTC.`}
          onClose={closeEditor}
          footer={
            <>
              <span className="ah-foot-note">
                {formData.selectedDays.length > 0
                  ? `Cron: ${localToUtcCron(formData.time, formData.selectedDays)} UTC`
                  : 'Select at least one day'}
              </span>
              <button type="button" className="btn btn-secondary" onClick={closeEditor}>Cancel</button>
              <button type="submit" form="ah-editor-form" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create schedule'}
              </button>
            </>
          }
        >
          <form id="ah-editor-form" onSubmit={handleSubmit} style={{ display: 'contents' }}>
            {/* 1 — What is it */}
            <div className="ah-section">
              <div className="ah-section-title"><Info size={15} /> Basics</div>
              <div className="ah-field">
                <label className="ah-label" htmlFor="ah-name">Schedule name</label>
                <input
                  id="ah-name"
                  type="text"
                  className="ah-input"
                  placeholder="e.g. Sunday lineup reminder"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="ah-field">
                <span className="ah-label">Who receives it</span>
                <div className="ah-choice-grid">
                  <button
                    type="button"
                    className={`ah-choice${isRoleMode ? '' : ' is-active'}`}
                    onClick={() => { setIsRoleMode(false); setFormData(prev => ({ ...prev, targetRole: '' })); }}
                  >
                    <span className="ah-choice-title"><MessageSquare size={14} /> A group chat</span>
                    <span className="ah-choice-desc">One fixed Messenger thread. Best for announcements.</span>
                  </button>
                  <button
                    type="button"
                    className={`ah-choice${isRoleMode ? ' is-active' : ''}`}
                    onClick={() => { setIsRoleMode(true); setAutoQueue(true); setFormData(prev => ({ ...prev, targetUrl: '' })); }}
                  >
                    <span className="ah-choice-title"><Target size={14} /> Whoever holds a role</span>
                    <span className="ah-choice-desc">Looks up the serving calendar and messages that person directly.</span>
                  </button>
                </div>
              </div>

              {isRoleMode ? (
                <div className="ah-field-row">
                  <div className="ah-field">
                    <label className="ah-label" htmlFor="ah-role"><Target size={13} /> Target role</label>
                    <select
                      id="ah-role"
                      className="ah-select"
                      value={formData.targetRole}
                      onChange={(e) => setFormData({ ...formData, targetRole: e.target.value })}
                      required
                    >
                      <option value="">Select a role…</option>
                      {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                  <div className="ah-field">
                    <label className="ah-label" htmlFor="ah-weeks"><Clock size={13} /> Lineups per run</label>
                    <select
                      id="ah-weeks"
                      className="ah-select"
                      value={formData.advanceWeeks}
                      onChange={(e) => setFormData({ ...formData, advanceWeeks: e.target.value })}
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{`Next ${n} week${n > 1 ? 's' : ''}`}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="ah-field">
                  <label className="ah-label" htmlFor="ah-url"><LinkIcon size={13} /> Target chat URL</label>
                  <input
                    id="ah-url"
                    type="url"
                    className="ah-input"
                    placeholder="https://m.me/j/…"
                    value={formData.targetUrl}
                    onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                    required
                  />
                </div>
              )}

              {isRoleMode && availableRoles.length === 0 && (
                <div className="ah-callout ah-callout--warning">
                  <AlertTriangle size={14} />
                  <span>
                    The serving calendar has no roles yet, so there is nobody to target.
                    Fill it in from <Link to="/automation-hub/calendar">Calendar</Link> first.
                  </span>
                </div>
              )}
            </div>

            {/* 2 — When */}
            <div className="ah-section">
              <div className="ah-section-title"><Clock size={15} /> When it runs</div>
              <div className="ah-field-row">
                <div className="ah-field">
                  <label className="ah-label" htmlFor="ah-time">Time (local)</label>
                  <input
                    id="ah-time"
                    type="time"
                    className="ah-input"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required
                  />
                </div>
                <div className="ah-field">
                  <span className="ah-label">Shortcuts</span>
                  <div className="ah-day-presets">
                    {DAY_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        className="ah-mini-btn"
                        onClick={() => setFormData(prev => ({ ...prev, selectedDays: preset.days }))}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button type="button" className="ah-mini-btn" onClick={() => setFormData(prev => ({ ...prev, selectedDays: [] }))}>
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              <div className="ah-field">
                <span className="ah-label"><Calendar size={13} /> Repeat on</span>
                <div className="ah-days">
                  {DAYS_OF_WEEK.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      aria-pressed={formData.selectedDays.includes(day.value)}
                      className={`ah-day${formData.selectedDays.includes(day.value) ? ' is-on' : ''}`}
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <span className="ah-hint">
                  {formData.selectedDays.length > 0
                    ? `${describeCron(localToUtcCron(formData.time, formData.selectedDays))} · next on ${
                      nextRunAt(localToUtcCron(formData.time, formData.selectedDays))?.toLocaleString([], {
                        weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                      }) || '—'}`
                    : 'Pick the days this message should go out.'}
                </span>
              </div>
            </div>

            {/* 3 — What it says */}
            <div className="ah-section">
              <div className="ah-section-head">
                <span className="ah-section-title"><MessageSquare size={15} /> Message</span>
                <span className="ah-hint">{formData.message.length} chars</span>
              </div>

              <div className="ah-field">
                <span className="ah-label">Insert a placeholder</span>
                <div className="ah-tokens">
                  {[...BUILTIN_TOKENS, ...availableRoles].map(token => (
                    <button key={token} type="button" className="ah-token-btn" onClick={() => insertToken(token)}>
                      {`{${token}}`}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                ref={messageRef}
                className="ah-textarea"
                placeholder={'Hi {Presider}, you are serving on {Date}. Confirmation code: {WeeklyCode}'}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />

              {unknownTokens.length > 0 && (
                <div className="ah-callout ah-callout--warning">
                  <AlertTriangle size={14} />
                  <span>
                    {unknownTokens.map(t => `{${t}}`).join(', ')} {unknownTokens.length === 1 ? 'does not match' : 'do not match'} any
                    calendar role or built-in placeholder, so {unknownTokens.length === 1 ? 'it' : 'they'} will be sent literally.
                  </span>
                </div>
              )}

              <div className="ah-field">
                <span className="ah-label">
                  <Eye size={13} /> Preview{sampleDate ? ` · using ${formatDateKey(sampleDate)}` : ''}
                </span>
                <div className="ah-preview">{composerPreview}</div>
              </div>
            </div>

            {/* 4 — Confirmation code */}
            <div className="ah-section">
              <div className="ah-toggle-row">
                <div className="ah-toggle-copy">
                  <strong>Confirmation code broadcast</strong>
                  <span className="ah-hint">A second, separate post with the week&apos;s lineup code.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.enableCodeBroadcast}
                  aria-label="Enable confirmation code broadcast"
                  className="ah-switch"
                  onClick={() => setFormData(prev => ({ ...prev, enableCodeBroadcast: !prev.enableCodeBroadcast }))}
                />
              </div>

              {formData.enableCodeBroadcast && (
                <>
                  <div className="ah-field-row">
                    <div className="ah-field">
                      <label className="ah-label" htmlFor="ah-code-time">Code time (local)</label>
                      <input
                        id="ah-code-time"
                        type="time"
                        className="ah-input"
                        value={formData.codeTime}
                        onChange={(e) => setFormData({ ...formData, codeTime: e.target.value })}
                      />
                    </div>
                    <div className="ah-field">
                      <label className="ah-label" htmlFor="ah-code-template">Code template</label>
                      <input
                        id="ah-code-template"
                        type="text"
                        className="ah-input"
                        value={formData.codeTemplate}
                        onChange={(e) => setFormData({ ...formData, codeTemplate: e.target.value })}
                        placeholder="DFCCI-S-LU-{DATE}"
                      />
                    </div>
                  </div>

                  <div className="ah-field">
                    <span className="ah-label"><Calendar size={13} /> Broadcast the code on</span>
                    <div className="ah-days">
                      {DAYS_OF_WEEK.map(day => (
                        <button
                          key={day.value}
                          type="button"
                          aria-pressed={formData.codeSelectedDays.includes(day.value)}
                          className={`ah-day${formData.codeSelectedDays.includes(day.value) ? ' is-on' : ''}`}
                          onClick={() => toggleDay(day.value, true)}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                    <span className="ah-hint">
                      {'{DATE}'} becomes the lineup date as MMDDYY — so {formData.codeTemplate.replace(/{DATE}/gi, '032526')}.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* 5 — Personal nudges */}
            <div className="ah-section">
              <div className="ah-section-head">
                <span className="ah-section-title"><Users size={15} /> Role reminders</span>
                <span className="ah-hint">
                  {formData.roleReminders.length === 0
                    ? 'None'
                    : `${formData.roleReminders.length} rule${formData.roleReminders.length === 1 ? '' : 's'}`}
                </span>
              </div>

              <span className="ah-hint">
                A private message to whoever holds a role, sent a set number of days before their
                lineup. These go out on the daily run, separately from the message above.
              </span>

              {formData.roleReminders.length === 0 && (
                <div className="ah-callout">
                  <Info size={14} />
                  <span>No reminders on this schedule. Add one to nudge a person before their date.</span>
                </div>
              )}

              {formData.roleReminders.map((rule, idx) => {
                const strays = tokensIn(rule.messageTemplate)
                  .filter(token => REMINDER_DATE_TOKENS.includes(token.trim().toLowerCase()));
                const unreachable = rule.daysPrior.filter(offset => offset > reminderHorizon);
                const nextName = rule.role ? assignments[sampleDate]?.[rule.role] : '';
                return (
                  <div key={idx} className="ah-queue-item" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                    <div className="ah-field-row">
                      <div className="ah-field">
                        <span className="ah-label"><Target size={13} /> Role</span>
                        <select
                          className="ah-select"
                          value={rule.role}
                          onChange={(e) => updateReminder(idx, { role: e.target.value })}
                        >
                          <option value="">Select a role…</option>
                          {availableRoles.map(role => <option key={role} value={role}>{role}</option>)}
                        </select>
                        {nextName && <span className="ah-hint">Next: {nextName}</span>}
                      </div>
                      <div className="ah-field">
                        <span className="ah-label"><Calendar size={13} /> Send on</span>
                        <div className="ah-day-presets">
                          {reminderOffsets.map(offset => (
                            <button
                              key={offset}
                              type="button"
                              aria-pressed={rule.daysPrior.includes(offset)}
                              className={`ah-day${rule.daysPrior.includes(offset) ? ' is-on' : ''}`}
                              style={{ padding: '0.4rem 0.55rem' }}
                              onClick={() => toggleReminderDay(idx, offset)}
                              title={`${offset} day${offset === 1 ? '' : 's'} before the lineup`}
                            >
                              {reminderDayLabel(offset)}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="ah-field">
                      <span className="ah-label"><MessageSquare size={13} /> Message</span>
                      <div className="ah-tokens">
                        {[...REMINDER_TOKENS, ...availableRoles].map(token => (
                          <button
                            key={token}
                            type="button"
                            className="ah-token-btn"
                            onClick={() => updateReminder(idx, {
                              messageTemplate: `${rule.messageTemplate}{${token}}`
                            })}
                          >
                            {`{${token}}`}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="ah-textarea"
                        style={{ minHeight: '6rem' }}
                        value={rule.messageTemplate}
                        onChange={(e) => updateReminder(idx, { messageTemplate: e.target.value })}
                        placeholder="Hi {Name}! Just a reminder that you are on {Role} this Sunday."
                      />
                    </div>

                    {strays.length > 0 && (
                      <div className="ah-callout ah-callout--warning">
                        <AlertTriangle size={14} />
                        <span>
                          {strays.map(t => `{${t}}`).join(', ')} {strays.length === 1 ? 'is' : 'are'} not replaced in
                          reminders — only {'{Name}'}, {'{Role}'}, {'{WeeklyCode}'} and role names are. It would be sent literally.
                        </span>
                      </div>
                    )}

                    {unreachable.length > 0 && (
                      <div className="ah-callout ah-callout--warning">
                        <AlertTriangle size={14} />
                        <span>
                          {unreachable.map(o => reminderDayLabel(o)).join(', ')} never fires: this schedule only looks
                          {` ${isRoleMode ? formData.advanceWeeks : 1} `}week ahead.
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="ah-icon-btn is-danger"
                        title="Remove this reminder"
                        onClick={() => removeReminder(idx)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="ah-day-presets">
                <button
                  type="button"
                  className="ah-mini-btn"
                  onClick={addReminder}
                  disabled={availableRoles.length === 0}
                >
                  + Add reminder
                </button>
              </div>
            </div>

            {autoQueue && messageQueue.length > 0 && (
              <div className="ah-callout">
                <Info size={14} />
                <span>
                  {messageQueue.length} lineup{messageQueue.length === 1 ? '' : 's'} will be generated from the serving
                  calendar when you save. Each one can be edited individually afterwards from the queue.
                </span>
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* ── Queue ── */}
      {queueFor && queueSchedule && (
        <Modal
          icon={List}
          title="Message queue"
          subtitle={queueSchedule.scheduleName}
          size="ah-panel--wide"
          onClose={() => setQueueFor(null)}
          footer={<button type="button" className="btn btn-secondary" onClick={() => setQueueFor(null)}>Done</button>}
        >
          <div className="ah-toolbar" style={{ marginBottom: 0 }}>
            <div className="ah-search">
              <Search size={16} />
              <input
                type="search"
                value={queueSearch}
                onChange={(e) => setQueueSearch(e.target.value)}
                placeholder="Search a date, name or message…"
                aria-label="Search the queue"
              />
            </div>
            <div className="ah-segment">
              {['upcoming', 'archived'].map(tab => (
                <button
                  key={tab}
                  type="button"
                  className={`ah-segment-btn${queueTab === tab ? ' is-active' : ''}`}
                  onClick={() => { setQueueTab(tab); setOpenQueueDate(null); }}
                >
                  {tab === 'upcoming' ? 'Upcoming' : 'Archived'}
                  <span className="ah-segment-count">
                    {queueDraft.filter(q => (tab === 'upcoming' ? q.targetDate >= today : q.targetDate < today)).length}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {filteredQueue.length === 0 ? (
            <div className="ah-callout">
              <Info size={14} />
              <span>
                {queueDraft.length === 0
                  ? 'This schedule has no queue. Role schedules build one from the serving calendar when you save them.'
                  : 'No queue items match that filter.'}
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {filteredQueue.map(item => {
                const isOpen = openQueueDate === item.targetDate;
                const roles = item.parsedRoles || {};
                const assignee = queueSchedule.targetRole ? roles[queueSchedule.targetRole] : null;
                return (
                  <div key={item.targetDate} className={`ah-queue-item${isOpen ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="ah-queue-head"
                      aria-expanded={isOpen}
                      onClick={() => setOpenQueueDate(isOpen ? null : item.targetDate)}
                    >
                      <span className="ah-queue-date">{formatDateKey(item.targetDate)}</span>
                      <span className="ah-queue-sub">
                        {assignee ? `${queueSchedule.targetRole}: ${assignee}` : (item.messageText || '').slice(0, 80)}
                      </span>
                      {item.isSent
                        ? <span className="ah-chip ah-chip--success"><CheckCircle2 size={11} /> Sent</span>
                        : item.targetDate < today
                          ? <span className="ah-chip ah-chip--muted">Archived</span>
                          : <span className="ah-chip ah-chip--warning">Pending</span>}
                      {(() => {
                        // Absent whenever the reader bot has told us nothing — a
                        // missing chip is honest, an invented "0 of 0" is not.
                        const state = confirmations[queueFor]?.byDate?.[item.targetDate];
                        if (!state) return null;
                        if (state.requiredCount === 0) {
                          return <span className="ah-chip ah-chip--muted">No roles tracked</span>;
                        }
                        if (state.isComplete) {
                          return <span className="ah-chip ah-chip--success"><CheckCircle2 size={11} /> Confirmed</span>;
                        }
                        return (
                          <span
                            className={`ah-chip ${state.receivedCount > 0 ? 'ah-chip--info' : 'ah-chip--muted'}`}
                            title={`Waiting on ${state.missing.join(', ')}`}
                          >
                            {state.receivedCount} of {state.requiredCount} confirmed
                          </span>
                        );
                      })()}
                    </button>

                    {isOpen && (
                      <div className="ah-queue-body">
                        {Object.keys(roles).length > 0 && (
                          <div className="ah-role-chips">
                            {Object.entries(roles).map(([role, name]) => (
                              <span key={role} className="ah-role-chip">{role}: <b>{name}</b></span>
                            ))}
                          </div>
                        )}

                        {item.weeklyConfirmationCode && (
                          <div className="ah-chips">
                            <span className="ah-chip ah-chip--primary ah-chip--code">
                              <Key size={11} /> {item.weeklyConfirmationCode}
                            </span>
                            <button
                              type="button"
                              className="ah-icon-btn"
                              title="Copy code"
                              onClick={() => copyToClipboard(item.weeklyConfirmationCode, 'Code')}
                            >
                              <Copy size={13} />
                            </button>
                          </div>
                        )}

                        <div className="ah-field">
                          <label className="ah-label">Override chat URL (optional)</label>
                          <input
                            type="url"
                            className="ah-input"
                            placeholder="Send this one to a different thread"
                            value={item.overrideChatUrl || ''}
                            onChange={(e) => setQueueDraft(prev => prev.map(q =>
                              q.targetDate === item.targetDate ? { ...q, overrideChatUrl: e.target.value } : q))}
                          />
                        </div>

                        <div className="ah-field">
                          <label className="ah-label">Message for this date</label>
                          <textarea
                            className="ah-textarea"
                            style={{ minHeight: '7rem' }}
                            value={item.messageText || ''}
                            onChange={(e) => setQueueDraft(prev => prev.map(q =>
                              q.targetDate === item.targetDate ? { ...q, messageText: e.target.value } : q))}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button type="button" className="btn btn-primary" onClick={() => saveQueueItem(item)}>
                            Save this date
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Modal>
      )}

      {/* ── Preview ── */}
      {preview && (
        <Modal
          icon={Eye}
          title="Dispatch preview"
          subtitle={`${preview.schedule.scheduleName} — resolved by the scheduler, nothing sent`}
          onClose={() => setPreview(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setPreview(null)}>Close</button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!preview.data?.shouldDispatch || !preview.schedule.isActive}
                onClick={() => { const s = preview.schedule; setPreview(null); handleRunNow(s); }}
              >
                <Play size={15} /> Send now
              </button>
            </>
          }
        >
          {!preview.data?.shouldDispatch ? (
            <div className="ah-callout ah-callout--warning">
              <AlertTriangle size={14} />
              <span><strong>This run would send nothing.</strong><br />{preview.data?.reason}</span>
            </div>
          ) : (
            <>
              {preview.data.items?.length > 0 && (
                <div className="ah-chips">
                  {preview.data.items.map(d => (
                    <span key={d} className="ah-chip ah-chip--primary"><Calendar size={11} /> {formatDateKey(d)}</span>
                  ))}
                </div>
              )}

              {preview.data.message && (
                <div className="ah-field">
                  <span className="ah-label"><MessageSquare size={13} /> To the group chat</span>
                  <div className="ah-preview">{preview.data.message}</div>
                </div>
              )}

              {preview.data.reminderTasks?.length > 0 && (
                <div className="ah-field">
                  <span className="ah-label">
                    <Send size={13} /> Direct messages ({preview.data.reminderTasks.length})
                  </span>
                  {preview.data.reminderTasks.map((task, i) => (
                    <div key={i} className="ah-queue-item" style={{ padding: 'var(--sp-3) var(--sp-4)' }}>
                      <div className="ah-queue-sub" style={{ marginBottom: 'var(--sp-2)' }}>
                        {task.url.replace(/^https?:\/\//, '')}
                      </div>
                      <div className="ah-preview" style={{ borderLeftColor: 'var(--info)' }}>{task.message}</div>
                    </div>
                  ))}
                </div>
              )}

              {preview.data.codeMessage && (
                <div className="ah-field">
                  <span className="ah-label"><Key size={13} /> Confirmation code post</span>
                  <div className="ah-preview">{preview.data.codeMessage}</div>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {/* ── Run history ── */}
      {runsFor && runsSchedule && (
        <Modal
          icon={RotateCcw}
          title="Run history"
          subtitle={runsSchedule.scheduleName}
          onClose={() => setRunsFor(null)}
          footer={<button type="button" className="btn btn-secondary" onClick={() => setRunsFor(null)}>Close</button>}
        >
          {runRows.length === 0 ? (
            <div className="ah-callout">
              <Info size={14} />
              <span>No runs recorded yet. History starts collecting from the next dispatch — cron or manual.</span>
            </div>
          ) : (
            <div>
              {runRows.map((run, i) => (
                <div key={`${run.at}-${i}`} className="ah-run-row">
                  {run.status === 'success'
                    ? <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: 2 }} />
                    : run.status === 'error'
                      ? <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
                      : <AlertTriangle size={16} style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 2 }} />}
                  <div className="ah-run-meta">
                    <span className="ah-run-title">
                      {run.status === 'success' ? 'Dispatched' : run.status === 'error' ? 'Failed' : 'Skipped'}
                      <span className="ah-chip ah-chip--muted">{run.actionType}</span>
                      <span className="ah-chip ah-chip--muted">{run.trigger === 'manual' ? 'Manual' : 'Cron'}</span>
                      {run.recipients > 0 && (
                        <span className="ah-chip ah-chip--muted">{run.recipients} message{run.recipients === 1 ? '' : 's'}</span>
                      )}
                      {run.ghRunConclusion && (
                        <span className={`ah-chip ${run.ghRunConclusion === 'success' ? 'ah-chip--success' : 'ah-chip--danger'}`}>
                          {run.ghRunConclusion}
                        </span>
                      )}
                      {run.ghRunUrl && (
                        <a
                          className="ah-chip ah-chip--info"
                          href={run.ghRunUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <LinkIcon size={11} /> View run
                        </a>
                      )}
                    </span>
                    <span className="ah-run-detail">{run.detail}</span>
                  </div>
                  <span className="ah-run-time">{formatTimestamp(run.at)}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Weekly code ── */}
      {showCodePanel && (
        <Modal
          icon={Key}
          title="Weekly code"
          subtitle="Generated every Sunday at 12:00 PM Manila time"
          onClose={() => setShowCodePanel(false)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCodePanel(false)}>Close</button>
              <button type="button" className="btn btn-primary" disabled={isSavingDispatch} onClick={() => saveWeeklyCode()}>
                {isSavingDispatch ? 'Saving…' : 'Save settings'}
              </button>
            </>
          }
        >
          <div className="ah-section">
            <div className="ah-section-head">
              <span className="ah-section-title"><Key size={15} /> Active code</span>
              <div style={{ display: 'flex', gap: '0.15rem' }}>
                <button
                  type="button"
                  className="ah-icon-btn"
                  title="Copy code"
                  onClick={() => copyToClipboard(weeklyCodeConfig?.currentCode || '', 'Code')}
                >
                  <Copy size={15} />
                </button>
                <button
                  type="button"
                  className="ah-icon-btn"
                  title="Regenerate now"
                  disabled={isSavingDispatch}
                  onClick={() => saveWeeklyCode({ forceGenerate: true })}
                >
                  <RefreshCw size={15} />
                </button>
              </div>
            </div>
            <div className="ah-stat-value is-code" style={{ textAlign: 'center' }}>
              {weeklyCodeConfig?.currentCode || 'Not generated yet'}
            </div>
            <span className="ah-hint" style={{ textAlign: 'center' }}>
              Use <code>{'{WeeklyCode}'}</code> in any message to inject it.
            </span>

            <div className="ah-field">
              <label className="ah-label" htmlFor="ah-wc-template">Code template</label>
              <input
                id="ah-wc-template"
                type="text"
                className="ah-input"
                value={codeTemplateDraft}
                onChange={(e) => setCodeTemplateDraft(e.target.value)}
              />
              <span className="ah-hint">{'{DATE}'} becomes next Sunday as MMDDYY.</span>
            </div>
          </div>

          <div className="ah-section">
            <div className="ah-toggle-row">
              <div className="ah-toggle-copy">
                <strong>Auto-dispatch the code</strong>
                <span className="ah-hint">Post the code to one chat on a weekly schedule.</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enableDispatch}
                aria-label="Enable weekly code auto-dispatch"
                className="ah-switch"
                onClick={() => setEnableDispatch(v => !v)}
              />
            </div>

            <div className="ah-field">
              <label className="ah-label" htmlFor="ah-wc-url">Target chat URL</label>
              <input
                id="ah-wc-url"
                type="url"
                className="ah-input"
                placeholder="https://www.messenger.com/t/…"
                value={dispatchUrl}
                onChange={(e) => setDispatchUrl(e.target.value)}
                disabled={!enableDispatch}
              />
            </div>

            <div className="ah-field-row">
              <div className="ah-field">
                <label className="ah-label" htmlFor="ah-wc-day">Day</label>
                <select
                  id="ah-wc-day"
                  className="ah-select"
                  value={dispatchDay}
                  onChange={(e) => setDispatchDay(e.target.value)}
                  disabled={!enableDispatch}
                >
                  {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((d, i) => (
                    <option key={d} value={String(i)}>{d}</option>
                  ))}
                </select>
              </div>
              <div className="ah-field">
                <label className="ah-label" htmlFor="ah-wc-time">Time (Manila)</label>
                <input
                  id="ah-wc-time"
                  type="time"
                  className="ah-input"
                  value={dispatchTime}
                  onChange={(e) => setDispatchTime(e.target.value)}
                  disabled={!enableDispatch}
                />
              </div>
            </div>

            <div className="ah-field">
              <label className="ah-label" htmlFor="ah-wc-msg">Message</label>
              <textarea
                id="ah-wc-msg"
                className="ah-textarea"
                style={{ minHeight: '6rem' }}
                value={dispatchMessage}
                onChange={(e) => setDispatchMessage(e.target.value)}
                placeholder="Here is the code: {WeeklyCode}"
                disabled={!enableDispatch}
              />
              <span className="ah-hint">
                Sends as: {dispatchMessage.replace(/{WeeklyCode}/gi, weeklyCodeConfig?.currentCode || 'DFCCI-S-LU-…')}
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Member directory ── */}
      {showMembers && (
        <Modal
          icon={Users}
          title="Member directory"
          subtitle="Names here must match the serving calendar exactly, or a role reminder cannot be delivered."
          size="ah-panel--wide"
          onClose={() => setShowMembers(false)}
        >
          <MemberDirectory showAlert={showAlert} showConfirm={showConfirm} />
        </Modal>
      )}

      {/* ── Toasts ── */}
      {toasts.length > 0 && createPortal(
        <div className="ah-toasts" role="status" aria-live="polite">
          {toasts.map(t => (
            <div key={t.id} className={`ah-toast ah-toast--${t.tone}`}>
              {t.tone === 'success' ? <CheckCircle2 size={15} />
                : t.tone === 'error' ? <XCircle size={15} />
                  : t.tone === 'warning' ? <AlertTriangle size={15} />
                    : <Info size={15} />}
              <span>{t.message}</span>
            </div>
          ))}
        </div>,
        document.body
      )}

      <PopupModal
        isOpen={popup.isOpen}
        onClose={() => setPopup({ ...popup, isOpen: false })}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
      />
    </div>
  );
}
