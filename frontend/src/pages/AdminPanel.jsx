import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, 
  Users, 
  Trash2, 
  RotateCcw, 
  History, 
  MessageSquare,
  Bell,
  BellOff
} from 'lucide-react';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'deletion-requests', 'restore-requests', 'recently-deleted', 'tickets'
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [tickets, setTickets] = useState([]);
  const navigate = useNavigate();

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'deletion-requests', label: 'Deletion', icon: Trash2 },
    { id: 'restore-requests', label: 'Restore', icon: RotateCcw },
    { id: 'recently-deleted', label: 'History', icon: History },
    { id: 'tickets', label: 'Requests', icon: MessageSquare }
  ];

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

  const handleToggleReminders = async (userId) => {
    try {
      await api.put(`/users/${userId}/toggle-reminders`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to toggle reminders');
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
    <div className="container" style={{ maxWidth: '1000px' }}>
      <button onClick={() => navigate('/dashboard')} className="back-btn">
        <ChevronLeft size={18} /> Back to Dashboard
      </button>
      
      <div className="admin-tabs-container">
        {tabs.map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          >
            <tab.icon className="admin-tab-icon" />
            <span className="admin-tab-label-text">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', background: 'transparent', boxShadow: 'none', border: 'none' }}>
        {activeTab === 'users' && (
          <>
            <div className="admin-table-container desktop-admin-table card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Name</th>
                    <th style={{ padding: '1rem' }}>Email</th>
                    <th style={{ padding: '1rem' }}>Verified</th>
                    <th style={{ padding: '1rem' }}>Role</th>
                    <th style={{ padding: '1rem' }}>{t('dues_reminders')}</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '1rem' }}>{u.displayName}</td>
                      <td style={{ padding: '1rem' }}>{u.email}</td>
                      <td style={{ padding: '1rem' }}>{u.isVerified ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className="badge">
                          {u.role === 'ADMIN' && t('role_admin')}
                          {u.role === 'COUNSELOR' && t('role_counselor')}
                          {u.role === 'YOUTH_TREASURER' && t('role_youth_treasurer')}
                          {u.role === 'MEMBER' && t('role_member')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {u.isVerified && (
                          <button 
                            onClick={() => handleToggleReminders(u._id)}
                            style={{ 
                              background: u.subscribedToDuesReminders ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', 
                              color: u.subscribedToDuesReminders ? '#22c55e' : '#ef4444',
                              border: 'none',
                              padding: '0.4rem 0.75rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem'
                            }}
                          >
                            {u.subscribedToDuesReminders ? <Bell size={14} /> : <BellOff size={14} />}
                            {u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
                          </button>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {u._id !== user._id && (
                          <select 
                            value={u.role} 
                            onChange={(e) => handleRoleChange(u._id, e.target.value)}
                            style={{ padding: '0.4rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-main)' }}
                          >
                            <option value="MEMBER">{t('role_member')}</option>
                            <option value="COUNSELOR">{t('role_counselor')}</option>
                            <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
                            <option value="ADMIN">{t('role_admin')}</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-admin-cards">
              {users.map(u => (
                <div key={u._id} className="admin-card">
                  <div className="admin-card-row">
                    <span className="admin-card-label">Name</span>
                    <span className="admin-card-value" style={{ fontWeight: '600' }}>{u.displayName}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Email</span>
                    <span className="admin-card-value">{u.email}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Verified</span>
                    <span className="admin-card-value">{u.isVerified ? 'Yes' : 'No'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">Role</span>
                    <span className="badge">
                      {u.role === 'ADMIN' && t('role_admin')}
                      {u.role === 'COUNSELOR' && t('role_counselor')}
                      {u.role === 'YOUTH_TREASURER' && t('role_youth_treasurer')}
                      {u.role === 'MEMBER' && t('role_member')}
                    </span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-card-label">{t('dues_reminders')}</span>
                    {u.isVerified && (
                      <button 
                        onClick={() => handleToggleReminders(u._id)}
                        style={{ 
                          background: u.subscribedToDuesReminders ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', 
                          color: u.subscribedToDuesReminders ? '#22c55e' : '#ef4444',
                          border: 'none',
                          padding: '0.4rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem'
                        }}
                      >
                        {u.subscribedToDuesReminders ? <Bell size={12} /> : <BellOff size={12} />}
                        {u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
                      </button>
                    )}
                  </div>
                  <div className="admin-card-actions">
                    {u._id !== user._id && (
                      <select 
                        value={u.role} 
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        style={{ padding: '0.6rem', borderRadius: 'var(--radius)', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-main)', width: '100%' }}
                      >
                        <option value="MEMBER">{t('role_member')}</option>
                        <option value="COUNSELOR">{t('role_counselor')}</option>
                        <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
                        <option value="ADMIN">{t('role_admin')}</option>
                      </select>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === 'deletion-requests' && (
          <>
            <div className="admin-table-container desktop-admin-table card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Sender</th>
                    <th style={{ padding: '1rem' }}>Receiver</th>
                    <th style={{ padding: '1rem' }}>Requested At</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {deletionRequests.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No pending requests</td></tr>
                  ) : (
                    deletionRequests.map(t => (
                      <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem' }}>{t.sender?.displayName}</td>
                        <td style={{ padding: '1rem' }}>{t.receiver?.displayName}</td>
                        <td style={{ padding: '1rem' }}>{new Date(t.deletionRequestedAt).toLocaleDateString()}</td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => handleApproveDeletion(t._id)} style={{ marginRight: '0.5rem', background: '#10B981', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Approve</button>
                          <button onClick={() => handleRejectDeletion(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Reject</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-admin-cards">
              {deletionRequests.length === 0 ? (
                <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No pending requests</div>
              ) : (
                deletionRequests.map(t => (
                  <div key={t._id} className="admin-card">
                    <div className="admin-card-row">
                      <span className="admin-card-label">Sender</span>
                      <span className="admin-card-value">{t.sender?.displayName}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Receiver</span>
                      <span className="admin-card-value">{t.receiver?.displayName}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Requested</span>
                      <span className="admin-card-value">{new Date(t.deletionRequestedAt).toLocaleDateString()}</span>
                    </div>
                    <div className="admin-card-actions">
                      <button onClick={() => handleApproveDeletion(t._id)} style={{ background: '#10B981', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Approve</button>
                      <button onClick={() => handleRejectDeletion(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'restore-requests' && (
          <>
            <div className="admin-table-container desktop-admin-table card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Sender</th>
                    <th style={{ padding: '1rem' }}>Receiver</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {restoreRequests.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No pending restore requests</td></tr>
                  ) : (
                    restoreRequests.map(t => (
                      <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem' }}>{t.sender?.displayName}</td>
                        <td style={{ padding: '1rem' }}>{t.receiver?.displayName}</td>
                        <td style={{ padding: '1rem' }}><span className="badge">Restore Pending</span></td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => handleApproveRestore(t._id)} style={{ marginRight: '0.5rem', background: '#3B82F6', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Approve</button>
                          <button onClick={() => handleRejectRestore(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.5rem 0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Reject</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-admin-cards">
              {restoreRequests.length === 0 ? (
                <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No pending restore requests</div>
              ) : (
                restoreRequests.map(t => (
                  <div key={t._id} className="admin-card">
                    <div className="admin-card-row">
                      <span className="admin-card-label">Sender</span>
                      <span className="admin-card-value">{t.sender?.displayName}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Receiver</span>
                      <span className="admin-card-value">{t.receiver?.displayName}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Status</span>
                      <span className="badge">Restore Pending</span>
                    </div>
                    <div className="admin-card-actions">
                      <button onClick={() => handleApproveRestore(t._id)} style={{ background: '#3B82F6', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Approve</button>
                      <button onClick={() => handleRejectRestore(t._id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '0.75rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'recently-deleted' && (
          <>
            <div className="admin-table-container desktop-admin-table card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>Sender</th>
                    <th style={{ padding: '1rem' }}>Receiver</th>
                    <th style={{ padding: '1rem' }}>Deleted At</th>
                    <th style={{ padding: '1rem' }}>Time Left</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyDeleted.length === 0 ? (
                    <tr><td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recently deleted threads</td></tr>
                  ) : (
                    recentlyDeleted.map(t => {
                      const deletedDate = new Date(t.deletedAt);
                      const expiryDate = new Date(deletedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
                      const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '1rem' }}>{t.sender?.displayName}</td>
                          <td style={{ padding: '1rem' }}>{t.receiver?.displayName}</td>
                          <td style={{ padding: '1rem' }}>{deletedDate.toLocaleDateString()}</td>
                          <td style={{ padding: '1rem' }}>{daysLeft} days</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-admin-cards">
              {recentlyDeleted.length === 0 ? (
                <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No recently deleted threads</div>
              ) : (
                recentlyDeleted.map(t => {
                  const deletedDate = new Date(t.deletedAt);
                  const expiryDate = new Date(deletedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
                  const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={t._id} className="admin-card">
                      <div className="admin-card-row">
                        <span className="admin-card-label">Sender</span>
                        <span className="admin-card-value">{t.sender?.displayName}</span>
                      </div>
                      <div className="admin-card-row">
                        <span className="admin-card-label">Receiver</span>
                        <span className="admin-card-value">{t.receiver?.displayName}</span>
                      </div>
                      <div className="admin-card-row">
                        <span className="admin-card-label">Deleted</span>
                        <span className="admin-card-value">{deletedDate.toLocaleDateString()}</span>
                      </div>
                      <div className="admin-card-row">
                        <span className="admin-card-label">Time Left</span>
                        <span className="admin-card-value" style={{ color: daysLeft < 7 ? '#EF4444' : 'inherit', fontWeight: '600' }}>{daysLeft} days</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}

        {activeTab === 'tickets' && (
          <>
            <div className="admin-table-container desktop-admin-table card">
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem' }}>User</th>
                    <th style={{ padding: '1rem' }}>Title & Description</th>
                    <th style={{ padding: '1rem' }}>Type</th>
                    <th style={{ padding: '1rem' }}>Status</th>
                    <th style={{ padding: '1rem' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.length === 0 ? (
                    <tr><td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No system requests</td></tr>
                  ) : (
                    tickets.map(t => (
                      <tr key={t._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '1rem' }}>{t.createdBy?.displayName}</td>
                        <td style={{ padding: '1rem' }}>
                          <div style={{ fontWeight: 'bold' }}>{t.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: '300px' }}>
                            {t.description.length > 80 ? t.description.substring(0, 80) + '...' : t.description}
                          </div>
                          {t.adminResponse && (
                            <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '0.25rem', fontWeight: '600' }}>
                              ✓ Replied
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textTransform: 'capitalize' }}><span className="badge">{t.type}</span></td>
                        <td style={{ padding: '1rem' }}>
                          <select 
                            value={t.status} 
                            onChange={(e) => handleUpdateTicketStatus(t._id, e.target.value)}
                            style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-main)' }}
                          >
                            <option value="open">Open</option>
                            <option value="in-progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <button 
                            onClick={() => handleAdminResponse(t._id)} 
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
                          >
                            {t.adminResponse ? 'Edit Reply' : 'Reply'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mobile-admin-cards">
              {tickets.length === 0 ? (
                <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No system requests</div>
              ) : (
                tickets.map(t => (
                  <div key={t._id} className="admin-card">
                    <div className="admin-card-row">
                      <span className="admin-card-label">User</span>
                      <span className="admin-card-value">{t.createdBy?.displayName}</span>
                    </div>
                    <div style={{ margin: '0.25rem 0' }}>
                      <div className="admin-card-label" style={{ marginBottom: '0.25rem' }}>{t.title}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t.description}</div>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Type</span>
                      <span className="badge">{t.type}</span>
                    </div>
                    <div className="admin-card-row">
                      <span className="admin-card-label">Status</span>
                      <select 
                        value={t.status} 
                        onChange={(e) => handleUpdateTicketStatus(t._id, e.target.value)}
                        style={{ padding: '0.4rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--surface)', color: 'var(--text-main)' }}
                      >
                        <option value="open">Open</option>
                        <option value="in-progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="admin-card-actions">
                      <button 
                        onClick={() => handleAdminResponse(t._id)} 
                        className="btn btn-secondary"
                        style={{ width: '100%', padding: '0.75rem' }}
                      >
                        {t.adminResponse ? 'Edit Reply' : 'Reply'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
