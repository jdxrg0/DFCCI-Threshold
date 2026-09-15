import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BookHeart, Send, BookOpen, Inbox, Users, Flame, Calendar, CheckCircle2, Clock, ChevronLeft, ChevronRight, BarChart3, User, Film, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import * as devotionalsApi from '../services/devotionals';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThreadSkeleton from '../components/ThreadSkeleton';
import BibleTracker from '../components/BibleTracker';
import BibleVideos from '../components/BibleVideos';
import PopupModal from '../components/PopupModal';
import { renderAvatarHelper } from '../utils/avatarHelper';
import PageHeader from '../components/PageHeader';
import ModuleTabs from '../components/ModuleTabs';

// ── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ icon, value, label, accent }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '0.85rem 0.4rem',
    background: 'var(--grad-surface)',
    border: '1px solid var(--hairline)',
    borderRadius: 'var(--r-lg)',
    textAlign: 'center',
    gap: '0.2rem',
    minWidth: 0,
  }}>
    <div style={{ color: accent, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
      {icon}
      <span style={{ fontSize: '1.5rem', fontWeight: '900', lineHeight: 1 }}>{value}</span>
    </div>
    <span style={{
      fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.2px', lineHeight: 1.2,
    }}>{label}</span>
  </div>
);

// ── Stats Bar ────────────────────────────────────────────────────────────────
const StatsBar = ({ stats }) => {
  const { t } = useLanguage();
  const items = [
    { label: t('devo_streak'), value: stats.currentStreak, icon: <Flame size={16} />, accent: '#F59E0B' },
    { label: t('devo_longest_streak'), value: stats.longestStreak, icon: <BarChart3 size={16} />, accent: 'var(--primary)' },
    { label: t('devo_this_month'), value: stats.thisMonth, icon: <Calendar size={16} />, accent: '#10B981' },
    { label: t('devo_acknowledged_count'), value: stats.acknowledged, icon: <CheckCircle2 size={16} />, accent: '#8B5CF6' },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
      gap: '0.6rem', marginBottom: '1.25rem',
    }}>
      {items.map(item => <StatPill key={item.label} {...item} />)}
    </div>
  );
};

// ── Mini Calendar Heatmap ────────────────────────────────────────────────────
const MiniCalendar = ({ year: initialYear, month: initialMonth, memberId, onRefresh }) => {
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState([]);
  const { user } = useAuth();
  const hasCustomDatePower = useMemo(() => {
    return user?.customDatePowerExpires && new Date(user.customDatePowerExpires) > new Date();
  }, [user]);
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    title: '',
    message: '',
    isAlert: false,
    onConfirm: null,
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setYear(initialYear);
    setMonth(initialMonth);
  }, [initialYear, initialMonth]);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const params = { year, month };
        if (memberId) params.memberId = memberId;
        const data = await devotionalsApi.getDevotionalCalendar(params);
        setDays(data);
      } catch { /* silent */ }
    };
    fetchCalendar();
  }, [year, month, memberId]);

  const dateSet = useMemo(() => {
    const map = {};
    days.forEach(d => { map[d.date] = d.status; });
    return map;
  }, [days]);

  // Helper to calculate UTC+8 date string with an offset
  const getUTC8DateString = (offsetDays = 0) => {
    const now = new Date();
    const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    if (offsetDays !== 0) {
      utc8Time.setDate(utc8Time.getDate() + offsetDays);
    }
    return utc8Time.toISOString().slice(0, 10);
  };

  const todayStr = getUTC8DateString(0);
  const yesterdayStr = getUTC8DateString(-1);
  const twoDaysAgoStr = getUTC8DateString(-2);

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDow = firstDay.getUTCDay();

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      status: dateSet[dateStr] || null,
      isToday: dateStr === todayStr,
      dateStr
    });
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else {
      setMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else {
      setMonth(m => m + 1);
    }
  };

  const performMarkMissed = async (dateStr) => {
    try {
      await devotionalsApi.markMissed({ date: dateStr });
      // Refresh calendar data
      const params = { year, month };
      if (memberId) params.memberId = memberId;
      const data = await devotionalsApi.getDevotionalCalendar(params);
      setDays(data);
      if (onRefresh) onRefresh();
    } catch (err) {
      setModalConfig({
        isOpen: true,
        title: 'Error',
        message: err.response?.data?.message || 'Failed to mark date.',
        isAlert: true,
        onConfirm: null,
      });
    }
  };

  const handleCellClick = (cell) => {
    if (!cell) return;
    const isClickable = !memberId && !cell.status &&
      (hasCustomDatePower ? cell.dateStr <= todayStr : (cell.dateStr === todayStr || cell.dateStr === yesterdayStr || cell.dateStr === twoDaysAgoStr));
    
    if (!isClickable) return;

    const formattedDate = new Date(cell.dateStr).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    setModalConfig({
      isOpen: true,
      title: 'Confess Missed Devotional',
      message: `Did you miss your devotional on ${formattedDate}?`,
      isAlert: false,
      onConfirm: () => performMarkMissed(cell.dateStr),
    });
  };

  return (
    <div style={{
      background: 'var(--grad-surface)', border: '1px solid var(--hairline)',
      borderRadius: 'var(--r-lg)', padding: '0.85rem', marginBottom: '1.25rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
        <button
          onClick={handlePrevMonth}
          style={{
            border: 'none', background: 'transparent', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '4px'
          }}
        >
          <ChevronLeft size={16} />
        </button>
        <h3 style={{ fontSize: '0.82rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>
          {monthNames[month - 1]} {year}
        </h3>
        <button
          onClick={handleNextMonth}
          style={{
            border: 'none', background: 'transparent', color: 'var(--text-muted)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '4px', borderRadius: '4px'
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
        {dayLabels.map((l, i) => (
          <div key={i} style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)', paddingBottom: '0.2rem' }}>{l}</div>
        ))}
        {cells.map((cell, i) => {
          const isClickable = cell && !memberId && !cell.status &&
            (hasCustomDatePower ? cell.dateStr <= todayStr : (cell.dateStr === todayStr || cell.dateStr === yesterdayStr || cell.dateStr === twoDaysAgoStr));

          return (
            <div
              key={i}
              onClick={() => handleCellClick(cell)}
              title={isClickable ? 'Click to mark as "Did not devotion" (Confessed)' : undefined}
              style={{
                width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: cell?.isToday ? '50%' : '4px', fontSize: '0.65rem', fontWeight: cell?.isToday ? '800' : '600',
                backgroundColor: cell?.status === 'Acknowledged'
                  ? 'color-mix(in srgb, var(--primary) 35%, transparent)'
                  : cell?.status === 'Submitted'
                  ? 'color-mix(in srgb, #10B981 30%, transparent)'
                  : cell?.status === 'Missed'
                  ? 'color-mix(in srgb, #EF4444 30%, transparent)'
                  : cell ? 'color-mix(in srgb, var(--text-muted) 8%, transparent)' : 'transparent',
                color: cell?.status ? 'var(--text-main)' : cell ? 'var(--text-muted)' : 'transparent',
                border: cell?.isToday
                  ? '2px solid var(--primary)'
                  : isClickable
                  ? '1px dashed var(--text-muted)'
                  : 'none',
                cursor: isClickable ? 'pointer' : 'default',
              }}
            >
              {cell?.day || ''}
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.6rem', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'color-mix(in srgb, #10B981 30%, transparent)' }}></span>
          Submitted
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'color-mix(in srgb, var(--primary) 35%, transparent)' }}></span>
          Acknowledged
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: 'color-mix(in srgb, #EF4444 30%, transparent)' }}></span>
          Missed
        </span>
      </div>

      <PopupModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        message={modalConfig.message}
        isAlert={modalConfig.isAlert}
        onConfirm={modalConfig.onConfirm}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
};

// ── Devotional Entry Card (redesigned for mobile) ────────────────────────────
const DevotionalCard = ({ entry, showMember = false }) => {
  const { t } = useLanguage();
  const isAck = entry.status === 'Acknowledged';
  const isMissed = entry.status === 'Missed';

  return (
    <Link
      to={`/devotionals/${entry._id}`}
      style={{ textDecoration: 'none', display: 'block', marginBottom: '0.6rem' }}
    >
      <div className="devotional-card-glass">
        {/* Accent bar at top */}
        <div style={{
          height: '3px',
          background: isAck
            ? 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #8B5CF6))'
            : isMissed
              ? 'linear-gradient(90deg, #64748b, #475569)'
              : 'linear-gradient(90deg, #F59E0B, #FB923C)',
        }} />

        <div style={{ padding: '0.85rem 1rem' }}>
          {/* Top row: passage + status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <div style={{
              fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.3',
              flex: 1, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              <BookOpen size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', marginRight: '0.2rem', color: 'var(--primary)' }} />
              {entry.passage}
            </div>
            <span style={{
              flexShrink: 0, fontSize: '0.65rem', fontWeight: '700',
              padding: '0.2rem 0.55rem', borderRadius: 'var(--r-full)',
              backgroundColor: isAck 
                ? 'color-mix(in srgb, var(--primary) 15%, transparent)' 
                : isMissed 
                  ? 'color-mix(in srgb, #64748b 15%, transparent)' 
                  : 'color-mix(in srgb, #F59E0B 15%, transparent)',
              color: isAck 
                ? 'var(--primary)' 
                : isMissed 
                  ? '#64748b' 
                  : '#D97706',
              display: 'flex', alignItems: 'center', gap: '0.2rem',
            }}>
              {isAck ? (
                <CheckCircle2 size={11} />
              ) : isMissed ? (
                <AlertTriangle size={11} />
              ) : (
                <Clock size={11} />
              )}
              {isAck 
                ? t('devo_status_acknowledged') 
                : isMissed 
                  ? t('devo_status_missed') || 'Missed' 
                  : t('devo_status_submitted')}
            </span>
          </div>

          {/* Summary preview */}
          <p style={{
            fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0',
            lineHeight: '1.5', overflow: 'hidden', textOverflow: 'ellipsis',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {entry.summary}
          </p>

          {/* Bottom meta row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.6rem',
            fontSize: '0.72rem', color: 'var(--text-muted)',
          }}>
            {showMember && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
                <User size={12} /> {entry.member?.displayName || 'Unknown'}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <Calendar size={12} /> {format(new Date(entry.date), 'MMM d, yyyy')}
            </span>
            {isAck && entry.acknowledgedBy && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginLeft: 'auto' }}>
                <CheckCircle2 size={12} /> {entry.acknowledgedBy?.displayName}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

// ── Leader Stats ─────────────────────────────────────────────────────────────
const LeaderStats = ({ stats }) => {
  const { t } = useLanguage();
  const items = [
    { label: t('devo_leader_total'), value: stats.totalThisMonth, accent: 'var(--primary)', icon: <Calendar size={14} /> },
    { label: t('devo_leader_pending'), value: stats.pending, accent: '#F59E0B', icon: <Clock size={14} /> },
    { label: t('devo_leader_acked'), value: stats.acknowledged, accent: '#10B981', icon: <CheckCircle2 size={14} /> },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
      {items.map(item => <StatPill key={item.label} {...item} />)}
    </div>
  );
};

// ── Pagination Component ─────────────────────────────────────────────────────
const Pagination = ({ page, totalPages, onPrev, onNext, t }) => {
  if (totalPages <= 1) return null;
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: '1rem', padding: '0.5rem 0',
    }}>
      <button
        onClick={onPrev} disabled={page === 1}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.5rem 0.85rem', fontSize: '0.82rem', fontWeight: '600',
          borderRadius: 'var(--r-sm)', border: '1.5px solid var(--hairline-strong)',
          backgroundColor: 'var(--surface-solid)', color: 'var(--text-main)',
          cursor: page === 1 ? 'not-allowed' : 'pointer',
          opacity: page === 1 ? 0.4 : 1, fontFamily: 'inherit',
          transition: 'opacity 0.2s',
        }}
      >
        <ChevronLeft size={15} /> {t('previous')}
      </button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
        {t('page_of')(page, totalPages)}
      </span>
      <button
        onClick={onNext} disabled={page === totalPages}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          padding: '0.5rem 0.85rem', fontSize: '0.82rem', fontWeight: '600',
          borderRadius: 'var(--r-sm)', border: '1.5px solid var(--hairline-strong)',
          backgroundColor: 'var(--surface-solid)', color: 'var(--text-main)',
          cursor: page === totalPages ? 'not-allowed' : 'pointer',
          opacity: page === totalPages ? 0.4 : 1, fontFamily: 'inherit',
          transition: 'opacity 0.2s',
        }}
      >
        {t('next')} <ChevronRight size={15} />
      </button>
    </div>
  );
};

// ── Folder Card Component ──────────────────────────────────────────────────
const FolderCard = ({ folder, onClick }) => {
  const latestDateStr = folder.lastEntryDate 
    ? format(new Date(folder.lastEntryDate), 'MMM d, yyyy')
    : 'Never';

  return (
    <div 
      onClick={onClick}
      className="devotional-card-glass"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem', marginBottom: '0.6rem', cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {renderAvatarHelper(folder, 40)}
        <div>
          <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>{folder.displayName}</div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            <span>{folder.total} Total Entries</span>
            <span style={{ color: 'var(--hairline-strong)' }}>•</span>
            <span>Latest: {latestDateStr}</span>
          </div>
        </div>
      </div>
      
      {folder.pending > 0 && (
        <div style={{
          backgroundColor: '#F59E0B', color: '#fff', fontSize: '0.75rem', fontWeight: '800',
          padding: '0.2rem 0.6rem', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '0.3rem'
        }}>
          <Clock size={12} /> {folder.pending} New
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ───────────────────────────────────────────────────────────
const DevotionalDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isLeader = ['ADMIN', 'COUNSELOR'].includes(user?.role);

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('devo_activeTab') || 'my');
  const [devotionals, setDevotionals] = useState([]);
  const [stats, setStats] = useState({ totalEntries: 0, currentStreak: 0, longestStreak: 0, thisMonth: 0, acknowledged: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Leader view state
  const [leaderDevos, setLeaderDevos] = useState([]);
  const [leaderStats, setLeaderStats] = useState({ totalThisMonth: 0, pending: 0, acknowledged: 0 });
  const [leaderLoading, setLeaderLoading] = useState(false);
  const [leaderPage, setLeaderPage] = useState(1);
  const [leaderTotalPages, setLeaderTotalPages] = useState(1);
  const [leaderFilter, setLeaderFilter] = useState('all');
  const [leaderFolders, setLeaderFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [leaderSubTab, setLeaderSubTab] = useState('entries'); // 'entries' | 'tracker'

  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth() + 1;

  useEffect(() => {
    localStorage.setItem('devo_activeTab', activeTab);
  }, [activeTab]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setPage(1);
    setLeaderPage(1);
  };

  useEffect(() => {
    if (activeTab !== 'my') return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await devotionalsApi.listDevotionals({ page: 1, limit: 8 });
        setDevotionals(data.devotionals);
        setTotalPages(data.pages || 1);
      } catch {
        setError('Failed to load devotionals');
      } finally {
        setLoading(false);
      }
      const statsData = await devotionalsApi.getDevotionalStats().catch(() => null);
      if (statsData) setStats(statsData);
    };
    load();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'my' || page <= 1) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await devotionalsApi.listDevotionals({ page, limit: 8 });
        setDevotionals(data.devotionals);
        setTotalPages(data.pages || 1);
      } catch {
        setError('Failed to load devotionals');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeTab, page]);

  useEffect(() => {
    if (activeTab !== 'leader' || !isLeader) return;
    const load = async () => {
      setFoldersLoading(true);
      const foldersData = await devotionalsApi.getLeaderFolders().catch(() => null);
      const statsData = await devotionalsApi.getLeaderStats().catch(() => null);
      if (foldersData) setLeaderFolders(foldersData);
      if (statsData) setLeaderStats(statsData);
      setFoldersLoading(false);
    };
    load();
  }, [activeTab, isLeader]);

  useEffect(() => {
    if (activeTab !== 'leader' || !isLeader || !selectedFolder) return;
    const load = async () => {
      setLeaderLoading(true);
      const params = { page: leaderPage, limit: 10, memberId: selectedFolder._id };
      if (leaderFilter !== 'all') params.status = leaderFilter;
      const data = await devotionalsApi.getLeaderDevotionals(params).catch(() => null);
      if (data) {
        setLeaderDevos(data.devotionals);
        setLeaderTotalPages(data.pages || 1);
      }
      setLeaderLoading(false);
    };
    load();
  }, [activeTab, isLeader, leaderPage, leaderFilter, selectedFolder]);

  const fetchMyDevotionals = async (p) => {
    setLoading(true); setError('');
    try {
      const data = await devotionalsApi.listDevotionals({ page: p, limit: 8 });
      setDevotionals(data.devotionals);
      setTotalPages(data.pages || 1);
    } catch { setError('Failed to load devotionals'); } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const data = await devotionalsApi.getDevotionalStats(); setStats(data); } catch { /* silent */ }
  };

  const fetchLeaderStats = async () => {
    try { const data = await devotionalsApi.getLeaderStats(); setLeaderStats(data); } catch { /* silent */ }
  };

  const fetchLeaderFolders = async () => {
    setFoldersLoading(true);
    try { const data = await devotionalsApi.getLeaderFolders(); setLeaderFolders(data); } catch { /* silent */ } finally { setFoldersLoading(false); }
  };

  const tabs = [
    { id: 'my', label: t('devo_my_tab') || 'Devotionals', short: 'Devos', Icon: Inbox },
    { id: 'bible', label: 'Bible Tracker', short: 'Bible', Icon: BookOpen },
    { id: 'videos', label: 'Why Bible?', short: 'Videos', Icon: Film },
    ...(isLeader ? [{ id: 'leader', label: t('devo_leader_tab') || 'Leader View', short: 'Leader', Icon: Users }] : []),
  ];

  return (
    <div className="container module-shell">
      <PageHeader
        icon={BookHeart}
        title={t('devo_dashboard_title')}
        subtitle={t('devo_desc')}
        actions={
          <>
            <Link to="/docs/devotional-tracker" className="btn btn-secondary page-header-btn-icon" title="Help & Documentation">
              <BookOpen size={18} />
            </Link>
            <Link to="/devotionals/submit" className="btn btn-primary page-header-btn-icon" title={t('devo_submit_title')}>
              <Send size={18} />
            </Link>
          </>
        }
      />

      <ModuleTabs
        tabs={tabs}
        activeId={activeTab}
        onChange={handleTabChange}
        ariaLabel="Devotional sections"
      />

      {error && <p style={{ color: '#EF4444', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}

      {/* ── My Devotionals ── */}
      {activeTab === 'my' && (
        <div style={{ minHeight: '300px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
          <StatsBar stats={stats} />

          {/* Promo Banner for "Why read Bible" videos */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.08), rgba(59, 130, 246, 0.08))',
            border: '1px solid var(--hairline)',
            borderRadius: 'var(--r-lg)',
            padding: '0.85rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: '0 4px 15px rgba(0,0,0,0.01)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)',
                color: 'var(--primary)',
                borderRadius: '50%',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Film size={18} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Why read the Bible?
                </h4>
                <p style={{ margin: '1px 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  Watch short, inspiring videos.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('videos')}
              style={{
                padding: '0.4rem 0.9rem',
                fontSize: '0.72rem',
                fontWeight: '800',
                borderRadius: '999px',
                border: 'none',
                backgroundColor: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 2px 6px color-mix(in srgb, var(--primary) 30%, transparent)',
                flexShrink: 0,
              }}
            >
              Watch Reels
            </button>
          </div>

          <MiniCalendar year={calYear} month={calMonth} onRefresh={() => { fetchMyDevotionals(page); fetchStats(); }} />

          {loading && devotionals.length === 0 ? (
            <ThreadSkeleton />
          ) : devotionals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
              <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center', color: 'color-mix(in srgb, var(--primary) 60%, transparent)' }}>
                <BookOpen size={48} strokeWidth={1.5} />
              </div>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>{t('devo_no_entries')}</p>
              <Link to="/devotionals/submit" style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.7rem 1.5rem', borderRadius: '12px', fontSize: '0.9rem', fontWeight: '700',
                background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, #000))',
                color: '#fff', textDecoration: 'none',
                boxShadow: '0 4px 14px color-mix(in srgb, var(--primary) 30%, transparent)',
              }}>
                <Send size={18} /> {t('devo_submit_first')}
              </Link>
            </div>
          ) : (
            <>
              {devotionals.map(d => <DevotionalCard key={d._id} entry={d} />)}
              <Pagination
                page={page} totalPages={totalPages}
                onPrev={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => Math.min(totalPages, p + 1))}
                t={t}
              />
            </>
          )}
        </div>
      )}

      {/* ── Bible Tracker ── */}
      {activeTab === 'bible' && (
        <BibleTracker />
      )}

      {/* ── Why Bible Videos (Reels) ── */}
      {activeTab === 'videos' && (
        <BibleVideos />
      )}

      {/* ── Leader View ── */}
      {activeTab === 'leader' && isLeader && (
        <div style={{ minHeight: '300px' }}>
          <LeaderStats stats={leaderStats} />

          {!selectedFolder ? (
            <div style={{ opacity: foldersLoading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: foldersLoading ? 'none' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
                <Users size={16} color="var(--primary)" />
                <h3 style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)', margin: 0 }}>Member Folders</h3>
              </div>
              {leaderFolders.map(f => (
                <FolderCard 
                  key={f._id} 
                  folder={f} 
                  onClick={() => { setLeaderDevos([]); setSelectedFolder(f); setLeaderPage(1); setLeaderSubTab('entries'); }} 
                />
              ))}
              {leaderFolders.length === 0 && !foldersLoading && (
                 <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>No members found.</p>
              )}
            </div>
          ) : (
            <div style={{ opacity: leaderLoading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: leaderLoading ? 'none' : 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <button 
                  onClick={() => { setLeaderDevos([]); setSelectedFolder(null); fetchLeaderFolders(); fetchLeaderStats(); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none', background: 'none', color: 'var(--primary)', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer', padding: 0 }}
                >
                  <ChevronLeft size={16} /> Back to Members
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  {renderAvatarHelper(selectedFolder, 26)}
                  <span>{selectedFolder.displayName}</span>
                </div>
              </div>

              {/* Sub-tabs for Folder */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem', padding: '0.25rem', backgroundColor: 'color-mix(in srgb, var(--text-muted) 10%, transparent)', borderRadius: '12px' }}>
                <button
                  onClick={() => setLeaderSubTab('entries')}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '800', fontFamily: 'inherit',
                    backgroundColor: leaderSubTab === 'entries' ? 'var(--primary)' : 'transparent',
                    color: leaderSubTab === 'entries' ? '#fff' : 'var(--text-muted)',
                    boxShadow: leaderSubTab === 'entries' ? '0 4px 10px color-mix(in srgb, var(--primary) 25%, transparent)' : 'none',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  Entries
                </button>
                <button
                  onClick={() => setLeaderSubTab('calendar')}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '800', fontFamily: 'inherit',
                    backgroundColor: leaderSubTab === 'calendar' ? 'var(--primary)' : 'transparent',
                    color: leaderSubTab === 'calendar' ? '#fff' : 'var(--text-muted)',
                    boxShadow: leaderSubTab === 'calendar' ? '0 4px 10px color-mix(in srgb, var(--primary) 25%, transparent)' : 'none',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  Calendar
                </button>
                <button
                  onClick={() => setLeaderSubTab('tracker')}
                  style={{
                    flex: 1, padding: '0.5rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '800', fontFamily: 'inherit',
                    backgroundColor: leaderSubTab === 'tracker' ? 'var(--primary)' : 'transparent',
                    color: leaderSubTab === 'tracker' ? '#fff' : 'var(--text-muted)',
                    boxShadow: leaderSubTab === 'tracker' ? '0 4px 10px color-mix(in srgb, var(--primary) 25%, transparent)' : 'none',
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  Bible Tracker
                </button>
              </div>

              {leaderSubTab === 'entries' ? (
                <>
                  {/* Filters */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1rem' }}>
                    <select
                      value={leaderFilter}
                      onChange={(e) => { setLeaderFilter(e.target.value); setLeaderPage(1); }}
                      style={{
                        flex: 1, padding: '0.55rem 0.65rem', fontSize: '0.82rem', fontWeight: '600',
                        borderRadius: 'var(--r-sm)', border: '1.5px solid var(--hairline-strong)',
                        backgroundColor: 'var(--surface-solid)', color: 'var(--text-main)',
                        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="all">{t('devo_filter_all')}</option>
                      <option value="Submitted">{t('devo_status_submitted')}</option>
                      <option value="Acknowledged">{t('devo_status_acknowledged')}</option>
                      <option value="Missed">{t('devo_status_missed') || 'Missed'}</option>
                    </select>
                  </div>

                  {leaderLoading && leaderDevos.length === 0 ? (
                    <ThreadSkeleton />
                  ) : leaderDevos.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0', fontSize: '0.9rem' }}>{t('devo_no_entries')}</p>
                  ) : (
                    <>
                      {leaderDevos.map(d => <DevotionalCard key={d._id} entry={d} />)}
                      <Pagination
                        page={leaderPage} totalPages={leaderTotalPages}
                        onPrev={() => setLeaderPage(p => Math.max(1, p - 1))}
                        onNext={() => setLeaderPage(p => Math.min(leaderTotalPages, p + 1))}
                        t={t}
                      />
                    </>
                  )}
                </>
              ) : leaderSubTab === 'calendar' ? (
                <div style={{ marginTop: '0.5rem' }}>
                  <MiniCalendar year={calYear} month={calMonth} memberId={selectedFolder._id} />
                </div>
              ) : (
                <div style={{ marginTop: '0.5rem' }}>
                  <BibleTracker targetMemberId={selectedFolder._id} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DevotionalDashboard;
