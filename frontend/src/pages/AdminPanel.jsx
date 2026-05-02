import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'deletion-requests', 'restore-requests', 'recently-deleted', 'tickets'
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [tickets, setTickets] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'deletion-requests') fetchDeletionRequests();
    if (activeTab === 'restore-requests') fetchRestoreRequests();
    if (activeTab === 'recently-deleted') fetchRecentlyDeleted();
    if (activeTab === 'tickets') fetchTickets();
  }, [user, navigate, activeTab]);

  const fetchRestoreRequests = async () => {
    try {
      const res = await api.get('/threads/admin/restore-requests');
      setRestoreRequests(res.data);
    } catch (err) {
      setError('Failed to fetch restore requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeletionRequests = async () => {
    try {
      const res = await api.get('/threads/admin/deletion-requests');
      setDeletionRequests(res.data);
    } catch (err) {
      setError('Failed to fetch deletion requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentlyDeleted = async () => {
    try {
      const res = await api.get('/threads/admin/recently-deleted');
      setRecentlyDeleted(res.data);
    } catch (err) {
      setError('Failed to fetch recently deleted threads');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      setError('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    try {
      const res = await api.get('/tickets');
      setTickets(res.data);
    } catch (err) {
      setError('Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    if (userId === user._id) {
      alert("You cannot change your own role.");
      return;
    }
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleApproveDeletion = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/approve-deletion`);
      fetchDeletionRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve deletion');
    }
  };

  const handleRejectDeletion = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/reject-deletion`);
      fetchDeletionRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject deletion');
    }
  };

  const handleApproveRestore = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/approve-restore`);
      fetchRestoreRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve restore');
    }
  };

  const handleRejectRestore = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/reject-restore`);
      fetchRestoreRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject restore');
    }
  };

  const handleUpdateTicketStatus = async (id, status) => {
    try {
      await api.patch(`/tickets/${id}/admin`, { status });
      fetchTickets();
    } catch (err) {
      alert(err.response?.data?.msg || 'Failed to update ticket');
    }
  };

  const handleAdminResponse = async (id) => {
    const response = prompt("Enter admin response:");
    if (response !== null) {
      try {
        await api.patch(`/tickets/${id}/admin`, { adminResponse: response });
        fetchTickets();
      } catch (err) {
        alert(err.response?.data?.msg || 'Failed to update response');
      }
    }
  };

  if (loading) return <div className="container mt-4">Loading...</div>;

  return (
    <div className="container" style={{ maxWidth: '800px' }}>
      <button onClick={() => navigate('/dashboard')} className="back-btn">
        <ChevronLeft size={18} /> Back to Dashboard
      </button>
      
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : 'none', color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          User Management
        </button>
        <button 
          onClick={() => setActiveTab('deletion-requests')} 
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'deletion-requests' ? '2px solid var(--primary)' : 'none', color: activeTab === 'deletion-requests' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Deletion Requests
        </button>
        <button 
          onClick={() => setActiveTab('restore-requests')} 
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'restore-requests' ? '2px solid var(--primary)' : 'none', color: activeTab === 'restore-requests' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Restore Requests
        </button>
        <button 
          onClick={() => setActiveTab('recently-deleted')} 
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'recently-deleted' ? '2px solid var(--primary)' : 'none', color: activeTab === 'recently-deleted' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          Recently Deleted
        </button>
        <button 
          onClick={() => setActiveTab('tickets')} 
          style={{ background: 'none', border: 'none', borderBottom: activeTab === 'tickets' ? '2px solid var(--primary)' : 'none', color: activeTab === 'tickets' ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer', padding: '0.5rem 1rem' }}
        >
          System Requests
        </button>
      </div>

      <div className="card">
        {activeTab === 'users' && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Name</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Email</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Verified</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Role</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{u.displayName}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{u.email}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>{u.isVerified ? 'Yes' : 'No'}</td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <span className="badge">{u.role}</span>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    {u._id !== user._id && (
                      <select 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        style={{ padding: '0.25rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)' }}
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="COUNSELOR">COUNSELOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {activeTab === 'deletion-requests' && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Sender</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Receiver</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Requested At</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {deletionRequests.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>No pending requests</td></tr>
              ) : (
                deletionRequests.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{t.sender?.displayName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{t.receiver?.displayName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{new Date(t.deletionRequestedAt).toLocaleDateString()}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button onClick={() => handleApproveDeletion(t._id)} style={{ marginRight: '0.5rem', background: '#10B981', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => handleRejectDeletion(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'restore-requests' && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Sender</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Receiver</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {restoreRequests.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>No pending restore requests</td></tr>
              ) : (
                restoreRequests.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{t.sender?.displayName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{t.receiver?.displayName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>Restore Pending</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button onClick={() => handleApproveRestore(t._id)} style={{ marginRight: '0.5rem', background: '#3B82F6', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Approve</button>
                      <button onClick={() => handleRejectRestore(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>Reject</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'recently-deleted' && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Sender</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Receiver</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Deleted At</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Time Left</th>
              </tr>
            </thead>
            <tbody>
              {recentlyDeleted.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '1rem', textAlign: 'center' }}>No recently deleted threads</td></tr>
              ) : (
                recentlyDeleted.map(t => {
                  const deletedDate = new Date(t.deletedAt);
                  const expiryDate = new Date(deletedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.sender?.displayName}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{t.receiver?.displayName}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{deletedDate.toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{daysLeft} days</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {activeTab === 'tickets' && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>User</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Title</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Type</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.length === 0 ? (
                <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center' }}>No system requests</td></tr>
              ) : (
                tickets.map(t => (
                  <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{t.createdBy?.displayName}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <div style={{ fontWeight: 'bold' }}>{t.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {t.description.length > 50 ? t.description.substring(0, 50) + '...' : t.description}
                      </div>
                      {t.adminResponse && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.25rem' }}>
                          Replied
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{t.type}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <select 
                        value={t.status} 
                        onChange={(e) => handleUpdateTicketStatus(t._id, e.target.value)}
                        style={{ padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--border-color)' }}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <button 
                        onClick={() => handleAdminResponse(t._id)} 
                        style={{ background: 'var(--bg-main)', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '0.25rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        {t.adminResponse ? 'Edit Reply' : 'Reply'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
