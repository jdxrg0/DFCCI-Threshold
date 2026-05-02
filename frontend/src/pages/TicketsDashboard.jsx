import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PlusCircle, FileText, AlertCircle, Wrench, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import api from '../api';

const TicketsDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets/my-tickets');
      setTickets(res.data);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return <AlertCircle size={16} className="text-yellow-500" />;
      case 'in-progress': return <RefreshCw size={16} className="text-blue-500" />;
      case 'resolved': return <CheckCircle size={16} className="text-green-500" />;
      case 'closed': return <Clock size={16} className="text-gray-500" />;
      default: return null;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'bug': return <AlertCircle size={18} />;
      case 'feature': return <PlusCircle size={18} />;
      case 'modification': return <Wrench size={18} />;
      default: return <FileText size={18} />;
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            {t('system_requests')}
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>{t('system_requests_desc')}</p>
        </div>
        <Link to="/tickets/create" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <PlusCircle size={18} /> <span className="hide-text-mobile">{t('create_request')}</span>
        </Link>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontWeight: '600', color: 'var(--text-main)' }}>
          {t('my_requests')}
        </h2>

        {loading ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>{t('loading')}</p>
        ) : tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <FileText size={48} style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
            <p>{t('no_requests')}</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tickets.map(ticket => (
              <div key={ticket._id} style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '1rem',
                backgroundColor: 'var(--bg-card)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.25rem', 
                      fontSize: '0.8rem', padding: '0.25rem 0.5rem', 
                      backgroundColor: 'var(--bg-color)', borderRadius: '4px',
                      color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold'
                    }}>
                      {getTypeIcon(ticket.type)} {t(`type_${ticket.type}`)}
                    </span>
                    <span style={{ 
                      display: 'flex', alignItems: 'center', gap: '0.25rem', 
                      fontSize: '0.8rem', padding: '0.25rem 0.5rem', 
                      backgroundColor: 'var(--bg-color)', borderRadius: '4px',
                      color: 'var(--text-muted)', textTransform: 'capitalize', fontWeight: 'bold'
                    }}>
                      {getStatusIcon(ticket.status)} {t(`status_${ticket.status.replace('-', '_')}`)}
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.25rem', fontWeight: '600' }}>
                    {ticket.title}
                  </h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Link to={`/tickets/${ticket._id}`} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}>
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
