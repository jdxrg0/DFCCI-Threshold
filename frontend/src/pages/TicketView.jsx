import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft, AlertCircle, Wrench, PlusCircle, FileText, CheckCircle, Clock, RefreshCw, User } from 'lucide-react';
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
        bgColor = 'rgba(234, 179, 8, 0.15)';
        color = '#eab308';
        break;
      case 'in-progress':
        icon = <RefreshCw size={14} />;
        bgColor = 'rgba(59, 130, 246, 0.15)';
        color = '#3b82f6';
        break;
      case 'resolved':
        icon = <CheckCircle size={14} />;
        bgColor = 'rgba(34, 197, 94, 0.15)';
        color = '#22c55e';
        break;
      case 'closed':
        icon = <Clock size={14} />;
        bgColor = 'rgba(107, 114, 128, 0.15)';
        color = '#6b7280';
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
    let icon;
    switch (type) {
      case 'bug': icon = <AlertCircle size={14} />; break;
      case 'feature': icon = <PlusCircle size={14} />; break;
      case 'modification': icon = <Wrench size={14} />; break;
      default: icon = <FileText size={14} />; break;
    }

    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.25rem 0.75rem', borderRadius: '4px',
        backgroundColor: 'var(--bg-color)', color: 'var(--text-muted)',
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
      <button 
        onClick={() => navigate('/tickets/dashboard')} 
        className="btn btn-secondary"
        style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }}
      >
        <ArrowLeft size={16} /> {t('back')}
      </button>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.75rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              {ticket.title}
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <User size={14} /> {ticket.createdBy.displayName} • {new Date(ticket.createdAt).toLocaleString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {getTypeBadge(ticket.type)}
            {getStatusBadge(ticket.status)}
          </div>
        </div>

        <div style={{ 
          backgroundColor: 'var(--bg-color)', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          color: 'var(--text-main)',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.6'
        }}>
          {ticket.description}
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '600' }}>
        {t('admin_response')}
      </h2>
      
      <div className="card" style={{ 
        backgroundColor: ticket.adminResponse ? 'var(--bg-card)' : 'transparent',
        border: ticket.adminResponse ? '1px solid var(--border-color)' : '1px dashed var(--border-color)',
      }}>
        {ticket.adminResponse ? (
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', color: 'var(--text-main)' }}>
            {ticket.adminResponse}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
            {t('no_admin_response')}
          </div>
        )}
      </div>
    </div>
  );
};

export default TicketView;
