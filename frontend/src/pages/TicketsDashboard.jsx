import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { PlusCircle, FileText, AlertCircle, Wrench, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import * as ticketsApi from '../services/tickets';
import PageHeader from '../components/PageHeader';

const TicketsDashboard = () => {
  const { t } = useLanguage();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchTickets = async () => {
      try {
        const data = await ticketsApi.listMyTickets();
        if (!cancelled) setTickets(data);
      } catch (err) {
        console.error('Failed to fetch tickets:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTickets();
    return () => { cancelled = true; };
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle size={14} />;
      case 'in-progress': return <RefreshCw size={14} />;
      case 'resolved': return <CheckCircle size={14} />;
      case 'closed': return <Clock size={14} />;
      default: return null;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bug': return <AlertCircle size={14} />;
      case 'feature': return <PlusCircle size={14} />;
      case 'modification': return <Wrench size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'open':
        return { color: '#eab308', backgroundColor: 'color-mix(in srgb, #eab308 15%, transparent)', fontWeight: '700', borderRadius: '9999px', fontSize: '0.8rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' };
      case 'in-progress':
        return { color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', fontWeight: '700', borderRadius: '9999px', fontSize: '0.8rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' };
      case 'resolved':
        return { color: '#10b981', backgroundColor: 'color-mix(in srgb, #10b981 15%, transparent)', fontWeight: '700', borderRadius: '9999px', fontSize: '0.8rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' };
      case 'closed':
        return { color: 'var(--text-muted)', backgroundColor: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', fontWeight: '700', borderRadius: '9999px', fontSize: '0.8rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' };
      default:
        return { color: 'var(--text-muted)', backgroundColor: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', fontWeight: '700', borderRadius: '9999px', fontSize: '0.8rem', padding: '0.25rem 0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' };
    }
  };

  const getTypeBadgeStyle = (type) => {
    switch (type) {
      case 'bug':
        return { color: '#ef4444', backgroundColor: 'color-mix(in srgb, #ef4444 15%, transparent)', fontWeight: '700', borderRadius: '6px', fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase' };
      case 'feature':
        return { color: 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', fontWeight: '700', borderRadius: '6px', fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase' };
      case 'modification':
        return { color: '#8b5cf6', backgroundColor: 'color-mix(in srgb, #8b5cf6 15%, transparent)', fontWeight: '700', borderRadius: '6px', fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase' };
      default:
        return { color: 'var(--text-muted)', backgroundColor: 'color-mix(in srgb, var(--text-muted) 15%, transparent)', fontWeight: '700', borderRadius: '6px', fontSize: '0.8rem', padding: '0.25rem 0.5rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', textTransform: 'uppercase' };
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      
      {/* ── BREATHTAKING MESH GRADIENT HERO BANNER ── */}
      <div className="ticket-hero-banner">
        <PageHeader
          className="page-header--flush"
          icon={Wrench}
          title={t('system_requests')}
          subtitle={t('system_requests_desc')}
          actions={
            <Link to="/tickets/create" className="btn btn-primary page-header-btn">
              <PlusCircle size={16} />
              <span>New Request</span>
            </Link>
          }
        />
      </div>

      <div style={{ padding: 0 }}>
        <h2 style={{ fontSize: '1.4rem', marginBottom: '1.5rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
          {t('my_requests')}
        </h2>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>{t('loading')}</p>
        ) : tickets.length === 0 ? (
          <div className="ticket-card-glass" style={{ justifyContent: 'center', flexDirection: 'column', textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5, color: 'var(--primary)' }} />
            <p style={{ fontWeight: '500', margin: 0 }}>{t('no_requests')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.map(ticket => (
              <div key={ticket._id} className="ticket-card-glass">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={getTypeBadgeStyle(ticket.type)}>
                      {getTypeIcon(ticket.type)} {t(`type_${ticket.type}`)}
                    </span>
                    <span style={getStatusBadgeStyle(ticket.status)}>
                      {getStatusIcon(ticket.status)} {t(`status_${ticket.status.replace('-', '_')}`)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.35rem', fontWeight: '800', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ticket.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, fontWeight: '500' }}>
                    {new Date(ticket.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Link to={`/tickets/${ticket._id}`} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '9999px', fontWeight: '700' }}>
                    {t('view_request')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketsDashboard;
