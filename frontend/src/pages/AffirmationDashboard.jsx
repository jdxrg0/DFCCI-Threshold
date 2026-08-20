import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sun, Inbox, Send, BookOpen, User, ChevronRight, ChevronDown, Folder, FolderOpen, Eye, Tag } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import ThreadSkeleton from '../components/ThreadSkeleton';
import MyFruits from '../components/MyFruits';
import EndorseFruit from '../components/EndorseFruit';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';
import ModuleTabs from '../components/ModuleTabs';

const AffirmationCard = ({ affirmation, type }) => {
  const isSender = type === 'sent';
  const otherParty = isSender ? affirmation.receiver : affirmation.sender;
  const { t } = useLanguage();

  return (
    <div className="affirmation-card-glass mb-4">

      {affirmation.topic && (
        <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.1rem', lineHeight: '1.2' }}>
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
        <Link to={`/affirm/${affirmation._id}`} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '9999px', fontWeight: '700' }} title="View Affirmation">
          <Eye size={14} />
          <span style={{ marginLeft: '0.35rem' }}>View</span>
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
    <div className="recipient-folder-glass">
      <button
        className="recipient-folder-glass__header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="recipient-folder-glass__icon" style={{ color: 'var(--primary)' }}>
          {open ? <FolderOpen size={20} /> : <Folder size={20} />}
        </span>
        <span className="recipient-folder-glass__name">
          <User size={14} style={{ opacity: 0.6, flexShrink: 0, color: 'var(--primary)' }} />
          {name}
        </span>
        <span className="recipient-folder-glass__meta">
          {Object.entries(statusCounts).map(([status, count]) => {
            if (status !== 'Received') return null;
            return (
              <span key={status} className={`badge`} style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)', fontWeight: '700' }}>
                {count} {t('sl_status_received')}
              </span>
            );
          })}
          <span className="recipient-folder-glass__count">{affirmations.length} total</span>
        </span>
        <span className="recipient-folder-glass__chevron">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && (
        <div className="recipient-folder-glass__body">
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

  const TABS = [
    { id: 'received',  label: t('sl_received'),   Icon: Inbox, short: 'Received' },
    { id: 'sent',      label: t('sl_sent'),       Icon: Send,  short: 'Sent' },
    { id: 'my_fruits', label: t('my_fruits_tab'), Icon: User,  short: 'My Fruits' },
    { id: 'endorse',   label: t('endorse_tab'),   Icon: Tag,   short: 'Endorse' },
  ];

  return (
    <div className="container mirror-dashboard-container" style={{ maxWidth: '800px' }}>
      
      {/* ── BREATHTAKING MESH gradient HERO BANNER ── */}
      <div className="affirmation-hero-banner">
        <PageHeader
          className="page-header--flush"
          icon={Sun}
          title={t('shining_light_dashboard')}
          subtitle="Encourage one another daily, highlight spiritual fruits, and share God's light."
          actions={
            <>
              <Link to="/docs/shining-light" className="btn btn-secondary page-header-btn-icon" title="Help & Documentation">
                <BookOpen size={18} />
              </Link>
              <Link to="/affirm/send" className="btn btn-primary page-header-btn" title={t('send_shining_light')}>
                <Send size={16} />
                <span>Send Light</span>
              </Link>
            </>
          }
        />
      </div>

      {/* ── SECTION TABS ── */}
      <ModuleTabs
        tabs={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Shining Light sections"
      />

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
