import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ChevronLeft, ArrowLeft, AlertCircle, Wrench, PlusCircle, FileText, CheckCircle, Clock, RefreshCw, User } from 'lucide-react';
import api from '../api';

const TicketView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/tickets/${id}`);
      setTicket(res.data);
    } catch (err) {
      console.error('Failed to fetch ticket:', err);
      setError('Could not load the request.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    let icon, bgColor, color;
    switch (status) {
      case 'open':
        icon = <AlertCircle size={14} />;
        bgColor = 'color-mix(in srgb, #eab308 15%, transparent)';
        color = '#eab308';
        break;
      case 'in-progress':
        icon = <RefreshCw size={14} />;
        bgColor = 'color-mix(in srgb, var(--primary) 15%, transparent)';
        color = 'var(--primary)';
        break;
      case 'resolved':
        icon = <CheckCircle size={14} />;
        bgColor = 'color-mix(in srgb, #10b981 15%, transparent)';
        color = '#10b981';
        break;
      case 'closed':
        icon = <Clock size={14} />;
        bgColor = 'color-mix(in srgb, var(--text-muted) 15%, transparent)';
        color = 'var(--text-muted)';
        break;
      default:
        return null;
    }

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.25rem 0.75rem', borderRadius: '999px',
        backgroundColor: bgColor, color: color,
        fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize'
      }}>
        {icon} {t(`status_${status.replace('-', '_')}`)}
      </div>
    );
  };

  const getTypeBadge = (type) => {
    let icon, bgColor, color;
    switch (type) {
      case 'bug':
        icon = <AlertCircle size={14} />;
        bgColor = 'color-mix(in srgb, #ef4444 15%, transparent)';
        color = '#ef4444';
        break;
      case 'feature':
        icon = <PlusCircle size={14} />;
        bgColor = 'color-mix(in srgb, var(--primary) 15%, transparent)';
        color = 'var(--primary)';
        break;
      case 'modification':
        icon = <Wrench size={14} />;
        bgColor = 'color-mix(in srgb, #8b5cf6 15%, transparent)';
        color = '#8b5cf6';
        break;
      default:
        icon = <FileText size={14} />;
        bgColor = 'color-mix(in srgb, var(--text-muted) 10%, transparent)';
        color = 'var(--text-muted)';
        break;
    }

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.25rem 0.75rem', borderRadius: '6px',
        backgroundColor: bgColor, color: color,
        fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase'
      }}>
        {icon} {t(`type_${type}`)}
      </div>
    );
  };

  if (loading) return <div className="container" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{t('loading')}</div>;
  if (error) return <div className="container" style={{ padding: '3rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>;
  if (!ticket) return null;

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <div className="btn-back-wrapper">
        <button 
          onClick={() => navigate('/tickets/dashboard')} 
          className="btn-back-pill"
        >
          <ChevronLeft size={16} /> {t('back')}
        </button>
      </div>

      <div style={{ padding: 0, marginBottom: '2rem' }} className="ticket-view-header-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
          <div>
            <h1 className="ticket-view-title" style={{ fontSize: '2.1rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '850', letterSpacing: '-0.03em', lineHeight: '1.2' }}>
              {ticket.title}
            </h1>
            <p className="ticket-view-meta" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
              <User size={14} /> {ticket.createdBy.displayName} • {new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
            {getTypeBadge(ticket.type)}
            {getStatusBadge(ticket.status)}
          </div>
        </div>

        <div className="ticket-view-body" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--surface-border)',
          padding: '2rem', 
          borderRadius: '1.25rem', 
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.7',
          fontSize: '1.05rem',
          backdropFilter: 'blur(8px)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          {ticket.description}
        </div>
      </div>

      <div style={{ marginTop: '2.5rem', marginBottom: '2rem' }}>
        <h2 className="ticket-view-response-header" style={{ fontSize: '1.4rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
          {t('admin_response')}
        </h2>
        
        <div className="ticket-view-response-body" style={{ 
          backgroundColor: ticket.adminResponse ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
          border: ticket.adminResponse ? '1px solid var(--surface-border)' : '1px dashed var(--surface-border)',
          borderRadius: '1.25rem',
          padding: '2rem',
          backdropFilter: 'blur(8px)'
        }}>
          {ticket.adminResponse ? (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-main)', fontSize: '1.02rem' }}>
              {ticket.adminResponse}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem', fontWeight: '500' }}>
              {t('no_admin_response')}
            </div>
          )}
        </div>
      </div>

      <div className="btn-back-wrapper" style={{ marginTop: '3rem' }}>
        <button 
          onClick={() => navigate('/tickets/dashboard')} 
          className="btn-back-pill"
        >
          <ChevronLeft size={16} /> {t('back')}
        </button>
      </div>
    </div>
  );
};

export default TicketView;
