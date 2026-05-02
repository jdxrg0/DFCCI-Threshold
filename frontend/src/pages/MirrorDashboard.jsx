import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Send, Inbox, Archive, FolderOpen, Folder, ChevronDown, ChevronRight, User, Trash2, BookOpen } from 'lucide-react';
import api from '../api';
import ThreadCard from '../components/ThreadCard';
import ThreadSkeleton from '../components/ThreadSkeleton';
import { useLanguage } from '../context/LanguageContext';

// ── Collapsible folder for a single recipient ──────────────────────────────
const RecipientFolder = ({ name, threads }) => {
  const [open, setOpen] = useState(false);

  // Summarise statuses for the collapsed badge row
  const statusCounts = threads.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="recipient-folder">
      {/* ── Folder header (always visible) ── */}
      <button
        className="recipient-folder__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        title={`${open ? 'Collapse' : 'Expand'} threads with ${name}`}
      >
        <span className="recipient-folder__icon">
          {open ? <FolderOpen size={20} /> : <Folder size={20} />}
        </span>

        <span className="recipient-folder__name">
          <User size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
          {name}
        </span>

        {/* Status pills */}
        <span className="recipient-folder__meta">
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className={`badge ${status.toLowerCase()}`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>
              {count} {status}
            </span>
          ))}
          <span className="recipient-folder__count">{threads.length} thread{threads.length !== 1 ? 's' : ''}</span>
        </span>

        <span className="recipient-folder__chevron">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {/* ── Thread list (expands below) ── */}
      {open && (
        <div className="recipient-folder__body">
          {threads.map(thread => (
            <ThreadCard key={thread._id} thread={thread} type="sent" />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Main Dashboard ─────────────────────────────────────────────────────────
const MirrorDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('gm_activeTab') || 'received');
  const [displayedTab, setDisplayedTab] = useState('received');
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useLanguage();

  useEffect(() => {
    fetchThreads();
    setCurrentPage(1);
    localStorage.setItem('gm_activeTab', activeTab);
  }, [activeTab]);

  const fetchThreads = async () => {
    setLoading(true);
    setError('');
    try {
      let res;
      if (activeTab === 'archive') {
        res = await api.get('/threads/archive');
      } else if (activeTab === 'deleted') {
        res = await api.get('/threads/recently-deleted');
      } else {
        res = await api.get(`/threads?type=${activeTab}`);
      }
      setThreads(res.data);
      setDisplayedTab(activeTab); // Update displayed logic only when new data is ready
    } catch (err) {
      setError('Failed to load threads');
    } finally {
      setLoading(false);
    }
  };

  // Group sent threads by receiver's displayName
  const groupedSent = React.useMemo(() => {
    if (displayedTab !== 'sent') return null;
    return threads.reduce((groups, thread) => {
      const name = thread.receiver?.displayName || 'Unknown';
      if (!groups[name]) groups[name] = [];
      groups[name].push(thread);
      return groups;
    }, {});
  }, [displayedTab, threads]);

  const isSent = displayedTab === 'sent';
  const displayItems = isSent 
    ? Object.entries(groupedSent || {}).sort(([a], [b]) => a.localeCompare(b))
    : threads;

  const itemsPerPage = 5;
  const totalPages = Math.ceil(displayItems.length / itemsPerPage) || 1;
  const currentItems = displayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="container mirror-dashboard-container" style={{ maxWidth: '800px' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="dashboard-title" style={{ fontSize: '2rem', color: 'var(--primary)' }}>{t('gentle_mirror_dashboard')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/docs/gentle-mirror" className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Help & Documentation">
            <BookOpen size={20} />
          </Link>
          <Link to="/mirror/send" className="btn btn-primary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Send a Mirror">
            <Send size={20} />
          </Link>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="dashboard-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { key: 'received', label: t('received'), Icon: Inbox },
          { key: 'sent',     label: t('sent'),     Icon: Send  },
          { key: 'archive',  label: t('archive'),  Icon: Archive },
          { key: 'deleted',  label: t('deleted'),  Icon: Trash2 },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className="dashboard-tab-btn"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
            }}
            title={label}
          >
            <span className="dashboard-tab-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon size={20} className="dashboard-tab-icon" />
              <span className="dashboard-tab-label" style={{ fontSize: '0.9rem' }}>{label}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}

      <div style={{ minHeight: '400px', position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s ease', pointerEvents: loading ? 'none' : 'auto' }}>
        {loading && threads.length === 0 ? (
          <ThreadSkeleton />
        ) : threads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            {t('no_threads')}
          </p>
        ) : isSent ? (
          /* ── Grouped Sent view ── */
          <div>
            {currentItems.map(([name, recipientThreads]) => (
              <RecipientFolder key={name} name={name} threads={recipientThreads} />
            ))}
          </div>
        ) : (
          /* ── Flat list for Received / Archive / Deleted ── */
          <div>
            {currentItems.map(thread => (
              <ThreadCard key={thread._id} thread={thread} type={displayedTab === 'archive' || displayedTab === 'deleted' ? 'received' : displayedTab} />
            ))}
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
            disabled={currentPage === 1}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
          >
            {t('previous')}
          </button>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('page_of')(currentPage, totalPages)}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
            disabled={currentPage === totalPages}
            className="btn btn-secondary"
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
          >
            {t('next')}
          </button>
        </div>
      )}
    </div>
  );
};

export default MirrorDashboard;
