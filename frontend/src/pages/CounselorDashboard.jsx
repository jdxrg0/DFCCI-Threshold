import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Eye, Unlock, Users } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const CounselorDashboard = () => {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!['ADMIN', 'COUNSELOR'].includes(user?.role)) {
      navigate('/dashboard');
      return;
    }
    fetchThreads();
  }, [user, navigate]);

  const fetchThreads = async () => {
    try {
      const res = await api.get('/counselor/threads');
      setThreads(res.data);
    } catch (err) {
      setError('Failed to fetch threads');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (threadId) => {
    try {
      await api.post(`/counselor/threads/${threadId}/request-access`);
      fetchThreads();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request access');
    }
  };

  if (loading) return <div className="container mt-4">Loading...</div>;

  const activeThreads = threads.filter(t => t.counselorConsentSender !== 'Declined' && t.counselorConsentReceiver !== 'Declined');
  const closedThreads = threads.filter(t => t.counselorConsentSender === 'Declined' || t.counselorConsentReceiver === 'Declined');

  return (
    <div className="container" style={{ maxWidth: '800px', paddingBottom: '4rem' }}>
      <PageHeader
        icon={Users}
        title="Counselor Dashboard"
        subtitle="Review escalated Gentle Mirror threads and support members through them."
      />
      {error && <p style={{ color: '#B91C1C' }}>{error}</p>}
      
      <div style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Active Escalations</h3>
        {activeThreads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No active escalations.</p>
        ) : (
          activeThreads.map(thread => (
            <div key={thread._id} className="card mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="badge escalated">Escalated</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {format(new Date(thread.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <p style={{ marginBottom: '1rem' }}>
                Thread between <strong>{thread.receiver?.displayName || 'Unknown'}</strong> and <strong>Anonymous Sender</strong>
              </p>
              
              {thread.counselorConsentSender === 'Approved' && thread.counselorConsentReceiver === 'Approved' ? (
                <Link to={`/mirror/thread/${thread._id}`} className="btn btn-primary" style={{ padding: '0.5rem' }} title="View Thread Details">
                  <Eye size={20} />
                </Link>
              ) : thread.counselorConsentSender === 'Pending' || thread.counselorConsentReceiver === 'Pending' ? (
                <div style={{ backgroundColor: '#FEF3C7', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                  Consent request pending...
                </div>
              ) : (
                <button onClick={() => handleRequestAccess(thread._id)} className="btn btn-secondary" style={{ padding: '0.5rem' }} title="Request to View Thread">
                  <Unlock size={20} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Closed (Access Declined)</h3>
        {closedThreads.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No closed threads.</p>
        ) : (
          closedThreads.map(thread => (
            <div key={thread._id} className="card mb-4" style={{ opacity: 0.7 }}>
              <div className="flex justify-between items-center mb-2">
                <span className="badge" style={{ backgroundColor: '#E5E7EB' }}>Closed</span>
                <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                  {format(new Date(thread.updatedAt), 'MMM d, yyyy h:mm a')}
                </span>
              </div>
              <p style={{ marginBottom: '0.5rem' }}>
                Thread between <strong>{thread.receiver?.displayName || 'Unknown'}</strong> and <strong>Anonymous Sender</strong>
              </p>
              <div style={{ backgroundColor: '#FEE2E2', color: '#B91C1C', padding: '0.75rem', borderRadius: 'var(--radius)', fontSize: '0.875rem' }}>
                Access declined. Encourage both parties to seek support directly.
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default CounselorDashboard;
