import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookHeart, Send, BookOpen, Inbox, Users, Flame, Eye, Calendar, CheckCircle2, Clock, ChevronLeft, ChevronRight, BarChart3, User } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThreadSkeleton from '../components/ThreadSkeleton';
import BibleTracker from '../components/BibleTracker';
import { renderAvatarHelper } from '../utils/avatarHelper';

// ── Stat Pill ────────────────────────────────────────────────────────────────
const StatPill = ({ icon, value, label, accent }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '0.85rem 0.4rem',
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
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
      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '1.25rem',
    }}>
      {items.map(item => <StatPill key={item.label} {...item} />)}
    </div>
  );
};

// ── Mini Calendar Heatmap ────────────────────────────────────────────────────
const MiniCalendar = ({ year, month }) => {
  const [days, setDays] = useState([]);

  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const res = await api.get('/devotionals/calendar', { params: { year, month } });
        setDays(res.data);
      } catch { /* silent */ }
    };
    fetchCalendar();
  }, [year, month]);

  const dateSet = useMemo(() => {
    const map = {};
    days.forEach(d => { map[d.date] = d.status; });
    return map;
  }, [days]);

  const firstDay = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDow = firstDay.getUTCDay();
  const today = new Date().toISOString().slice(0, 10);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, status: dateSet[dateStr] || null, isToday: dateStr === today });
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div style={{
      backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: '12px', padding: '0.85rem', marginBottom: '1.25rem',
    }}>
      <h3 style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.6rem', textAlign: 'center' }}>
        {monthNames[month - 1]} {year}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', textAlign: 'center' }}>
        {dayLabels.map((l, i) => (
          <div key={i} style={{ fontSize: '0.6rem', fontWeight: '700', color: 'var(--text-muted)', paddingBottom: '0.2rem' }}>{l}</div>
        ))}
        {cells.map((cell, i) => (
          <div key={i} style={{
            width: '100%', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: cell?.isToday ? '50%' : '4px', fontSize: '0.65rem', fontWeight: cell?.isToday ? '800' : '600',
            backgroundColor: cell?.status === 'Acknowledged'
              ? 'color-mix(in srgb, var(--primary) 35%, transparent)'
              : cell?.status === 'Submitted'
              ? 'color-mix(in srgb, #10B981 30%, transparent)'
              : cell ? 'color-mix(in srgb, var(--text-muted) 8%, transparent)' : 'transparent',
            color: cell?.status ? 'var(--text-main)' : cell ? 'var(--text-muted)' : 'transparent',
            border: cell?.isToday ? '2px solid var(--primary)' : 'none',
          }}>
            {cell?.day || ''}
          </div>
        ))}
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
      </div>
    </div>
  );
};

// ── Devotional Entry Card (redesigned for mobile) ────────────────────────────
const DevotionalCard = ({ entry, showMember = false }) => {
  const { t } = useLanguage();
  const isAck = entry.status === 'Acknowledged';

  return (
    <Link
      to={`/devotionals/${entry._id}`}
      style={{ textDecoration: 'none', display: 'block', marginBottom: '0.6rem' }}
    >
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}>
        {/* Accent bar at top */}
        <div style={{
          height: '3px',
          background: isAck
            ? 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 60%, #8B5CF6))'
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
              padding: '0.2rem 0.55rem', borderRadius: '999px',
              backgroundColor: isAck ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'color-mix(in srgb, #F59E0B 15%, transparent)',
              color: isAck ? 'var(--primary)' : '#D97706',
              display: 'flex', alignItems: 'center', gap: '0.2rem',
            }}>
              {isAck ? <CheckCircle2 size={11} /> : <Clock size={11} />}
              {isAck ? t('devo_status_acknowledged') : t('devo_status_submitted')}
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
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
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
          borderRadius: '10px', border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--card-bg)', color: 'var(--text-main)',
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
          borderRadius: '10px', border: '1.5px solid var(--border-color)',
          backgroundColor: 'var(--card-bg)', color: 'var(--text-main)',
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
const FolderCard = ({ folder, onClick }) => (
  <div 
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '1rem', backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
      borderRadius: '12px', marginBottom: '0.6rem', cursor: 'pointer',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)', transition: 'transform 0.15s ease'
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      {renderAvatarHelper(folder, 40)}
      <div>
        <div style={{ fontSize: '1rem', fontWeight: '800', color: 'var(--text-main)' }}>{folder.displayName}</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
          {folder.total} Total Entries
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

// ── Main Dashboard ───────────────────────────────────────────────────────────
const DevotionalDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
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
    setPage(1);
    setLeaderPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'my') { fetchMyDevotionals(1); fetchStats(); }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'my' && page > 1) fetchMyDevotionals(page);
  }, [page]);

  useEffect(() => {
    if (activeTab === 'leader' && isLeader) { fetchLeaderFolders(); fetchLeaderStats(); }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'leader' && isLeader && selectedFolder) {
      fetchLeaderDevotionals(leaderPage);
    }
  }, [leaderPage, leaderFilter, selectedFolder]);

  const fetchMyDevotionals = async (p) => {
    setLoading(true); setError('');
    try {
      const res = await api.get('/devotionals', { params: { page: p, limit: 8 } });
      setDevotionals(res.data.devotionals);
      setTotalPages(res.data.pages || 1);
    } catch { setError('Failed to load devotionals'); } finally { setLoading(false); }
  };

  const fetchStats = async () => {
    try { const res = await api.get('/devotionals/stats'); setStats(res.data); } catch { /* silent */ }
  };

  const fetchLeaderDevotionals = async (p) => {
    if (!selectedFolder) return;
    setLeaderLoading(true);
    try {
      const params = { page: p, limit: 10, memberId: selectedFolder._id };
      if (leaderFilter !== 'all') params.status = leaderFilter;
      const res = await api.get('/devotionals/leader/all', { params });
      setLeaderDevos(res.data.devotionals);
      setLeaderTotalPages(res.data.pages || 1);
    } catch { /* silent */ } finally { setLeaderLoading(false); }
  };

  const fetchLeaderStats = async () => {
    try { const res = await api.get('/devotionals/leader/stats'); setLeaderStats(res.data); } catch { /* silent */ }
  };

  const fetchLeaderFolders = async () => {
    setFoldersLoading(true);
    try { const res = await api.get('/devotionals/leader/folders'); setLeaderFolders(res.data); } catch { /* silent */ } finally { setFoldersLoading(false); }
  };

  const tabs = [
    { key: 'my', label: t('devo_my_tab') || 'Devotionals', Icon: Inbox },
    { key: 'bible', label: 'Bible Tracker', Icon: BookOpen },
    ...(isLeader ? [{ key: 'leader', label: t('devo_leader_tab') || 'Leader View', Icon: Users }] : []),
  ];

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '0 0.75rem 5rem' }}>
      {/* ── Hero Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: '1rem', padding: '0.5rem 0',
      }}>
        <h1 style={{
          fontSize: '1.4rem', fontWeight: '900', color: 'var(--primary)', margin: 0,
          display: 'flex', alignItems: 'center', gap: '0.4rem',
        }}>
          <BookHeart size={24} /> {t('devo_dashboard_title')}
        </h1>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <Link to="/docs/devotional-tracker" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '38px', height: '38px', borderRadius: '10px',
            backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)',
            color: 'var(--text-muted)', textDecoration: 'none',
            transition: 'background-color 0.2s',
          }}>
            <BookOpen size={18} />
          </Link>
          <Link to="/devotionals/submit" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '38px', height: '38px', borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, #000))',
            color: '#fff', textDecoration: 'none', boxShadow: '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent)',
            transition: 'transform 0.15s ease',
          }}>
            <Send size={18} />
          </Link>
        </div>
      </div>

      {/* ── Bottom Navigation Tabs ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        backgroundColor: 'color-mix(in srgb, var(--card-bg) 85%, transparent)', 
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '0.35rem 0.5rem', paddingBottom: 'calc(0.35rem + env(safe-area-inset-bottom, 0px))',
        zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.06)'
      }}>
        {tabs.map(({ key, label, Icon }) => {
          const isActive = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                flex: 1, padding: '0.3rem', border: 'none', background: 'transparent',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.2s'
              }}
            >
              <div style={{
                padding: '0.2rem 1rem', borderRadius: '999px',
                backgroundColor: isActive ? 'var(--primary)' : 'color-mix(in srgb, var(--text-muted) 15%, transparent)',
                color: isActive ? '#fff' : 'var(--text-muted)',
                transition: 'background-color 0.2s, color 0.2s'
              }}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span style={{ fontSize: '0.55rem', fontWeight: isActive ? '800' : '600', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</span>
            </button>
          );
        })}
      </div>

      {error && <p style={{ color: '#EF4444', textAlign: 'center', fontSize: '0.85rem' }}>{error}</p>}

      {/* ── My Devotionals ── */}
      {activeTab === 'my' && (
        <div style={{ minHeight: '300px', opacity: loading ? 0.5 : 1, transition: 'opacity 0.2s', pointerEvents: loading ? 'none' : 'auto' }}>
          <StatsBar stats={stats} />
          <MiniCalendar year={calYear} month={calMonth} />

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
                    flex: 1, padding: '0.45rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '800', fontFamily: 'inherit',
                    backgroundColor: leaderSubTab === 'entries' ? 'var(--card-bg)' : 'transparent',
                    color: leaderSubTab === 'entries' ? 'var(--text-main)' : 'var(--text-muted)',
                    boxShadow: leaderSubTab === 'entries' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  Entries
                </button>
                <button
                  onClick={() => setLeaderSubTab('tracker')}
                  style={{
                    flex: 1, padding: '0.45rem', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: '800', fontFamily: 'inherit',
                    backgroundColor: leaderSubTab === 'tracker' ? 'var(--card-bg)' : 'transparent',
                    color: leaderSubTab === 'tracker' ? 'var(--text-main)' : 'var(--text-muted)',
                    boxShadow: leaderSubTab === 'tracker' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.2s',
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
                        borderRadius: '10px', border: '1.5px solid var(--border-color)',
                        backgroundColor: 'var(--card-bg)', color: 'var(--text-main)',
                        fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
                      }}
                    >
                      <option value="all">{t('devo_filter_all')}</option>
                      <option value="Submitted">{t('devo_status_submitted')}</option>
                      <option value="Acknowledged">{t('devo_status_acknowledged')}</option>
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
