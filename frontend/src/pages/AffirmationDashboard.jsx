import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Inbox, Send, BookOpen, User, ChevronRight, ChevronDown, Folder, FolderOpen, Eye, Tag } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import ThreadSkeleton from '../components/ThreadSkeleton';
import MyFruits from '../components/MyFruits';
import EndorseFruit from '../components/EndorseFruit';
import { useLanguage } from '../context/LanguageContext';

const AffirmationCard = ({ affirmation, type }) => {
  const isSender = type === 'sent';
  const otherParty = isSender ? affirmation.receiver : affirmation.sender;
  const { t } = useLanguage();

  return (
    <div className="card thread-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', borderLeft: '4px solid var(--primary)', padding: '0.65rem 1rem', marginBottom: '0.5rem' }}>

      {affirmation.topic && (
        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.2rem', lineHeight: '1.2' }}>
          {affirmation.topic}
        </div>
      )}

      {/* Name + view button — single row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
          <Tag size={14} className="text-muted" style={{ flexShrink: 0 }} />
          <h3 style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
            {isSender ? t('sl_to')(otherParty?.displayName || 'Unknown') : t('sl_from')('Anonymous')}
          </h3>
        </div>
        <Link to={`/affirm/${affirmation._id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }} title="View Affirmation">
          <Eye size={16} />
          <span style={{ marginLeft: '0.4rem' }}>View</span>
        </Link>
      </div>

      <div className="thread-meta" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <span>{format(new Date(affirmation.createdAt), 'MMM d, yyyy h:mm a')}</span>
        {affirmation.status === 'Received' && (
          <span className="badge" style={{ fontWeight: '700', backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)', flexShrink: 0 }}>
            {t('sl_status_received')}
          </span>
        )}
      </div>
    </div>
  );
};

const RecipientFolder = ({ name, affirmations }) => {
  const [open, setOpen] = useState(false);
  const { t } = useLanguage();

  const statusCounts = affirmations.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="recipient-folder">
      <button
        className="recipient-folder__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="recipient-folder__icon" style={{ color: 'var(--primary)' }}>
          {open ? <FolderOpen size={20} /> : <Folder size={20} />}
        </span>
        <span className="recipient-folder__name">
          <User size={14} style={{ opacity: 0.6, flexShrink: 0 }} />
          {name}
        </span>
        <span className="recipient-folder__meta">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (status !== 'Received') return null;
            return (
              <span key={status} className={`badge`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)' }}>
                {count} {t('sl_status_received')}
              </span>
            );
          })}
          <span className="recipient-folder__count">{affirmations.length} total</span>
        </span>
        <span className="recipient-folder__chevron">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && (
        <div className="recipient-folder__body">
          {affirmations.map(aff => (
            <AffirmationCard key={aff._id} affirmation={aff} type="sent" />
          ))}
        </div>
      )}
    </div>
  );
};

const AffirmationDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('sl_activeTab') || 'received');
  const [affirmations, setAffirmations] = useState({ received: [], sent: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    fetchAffirmations();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    localStorage.setItem('sl_activeTab', activeTab);
  }, [activeTab]);

  const fetchAffirmations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/affirmations');
      setAffirmations(res.data);
    } catch (err) {
      setError('Failed to load affirmations');
    } finally {
      setLoading(false);
    }
  };

  const currentList = activeTab === 'received' ? affirmations.received : affirmations.sent;
  const isSent = activeTab === 'sent';

  const groupedSent = React.useMemo(() => {
    if (!isSent) return null;
    return currentList.reduce((groups, aff) => {
      const name = aff.receiver?.displayName || 'Unknown';
      if (!groups[name]) groups[name] = [];
      groups[name].push(aff);
      return groups;
    }, {});
  }, [isSent, currentList]);

  const displayItems = isSent 
    ? Object.entries(groupedSent || {}).sort(([a], [b]) => a.localeCompare(b))
    : currentList;

  const itemsPerPage = 5;
  const totalPages = Math.ceil(displayItems.length / itemsPerPage) || 1;
  const paginatedItems = displayItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="container mirror-dashboard-container" style={{ maxWidth: '800px' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="dashboard-title" style={{ fontSize: '2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sun size={28} /> {t('shining_light_dashboard')}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/docs/shining-light" className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Help & Documentation">
            <BookOpen size={20} />
          </Link>
          <Link to="/affirm/send" className="btn btn-primary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('send_shining_light')}>
            <Send size={20} />
          </Link>
        </div>
      </div>

      <div className="dashboard-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { key: 'received', label: t('sl_received'), Icon: Inbox },
          { key: 'sent',     label: t('sl_sent'),     Icon: Send  },
          { key: 'my_fruits', label: t('my_fruits_tab'), Icon: User },
          { key: 'endorse',  label: t('endorse_tab'), Icon: Tag },
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
              <span className="dashboard-tab-label" style={{ fontSize: '0.9rem', fontWeight: activeTab === key ? 'bold' : 'normal' }}>{label}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#EF4444' }}>{error}</p>}

      <div style={{ minHeight: '400px', position: 'relative', opacity: loading && (activeTab === 'received' || activeTab === 'sent') ? 0.6 : 1, transition: 'opacity 0.2s ease', pointerEvents: loading ? 'none' : 'auto' }}>
        {activeTab === 'my_fruits' ? (
          <MyFruits />
        ) : activeTab === 'endorse' ? (
          <EndorseFruit />
        ) : loading && currentList.length === 0 ? (
          <ThreadSkeleton />
        ) : currentList.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
            {t('sl_no_affirmations')}
          </p>
        ) : isSent ? (
          <div>
            {paginatedItems.map(([name, recipientAffirmations]) => (
              <RecipientFolder key={name} name={name} affirmations={recipientAffirmations} />
            ))}
          </div>
        ) : (
          <div>
            {paginatedItems.map(aff => (
              <AffirmationCard key={aff._id} affirmation={aff} type="received" />
            ))}
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (activeTab === 'received' || activeTab === 'sent') && (
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

export default AffirmationDashboard;
