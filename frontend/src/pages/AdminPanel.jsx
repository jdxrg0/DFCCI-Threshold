import React, { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import PopupModal from '../components/PopupModal';
import { PRESETS, renderPresetSvg } from '../utils/avatarHelper';
import { 
  ChevronLeft, 
  ChevronDown,
  Users, 
  Trash2, 
  RotateCcw, 
  History, 
  MessageSquare,
  Bell,
  BellOff,
  UserCog,
  Mail,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  ShieldAlert,
  UserCheck,
  Search,
  X
} from 'lucide-react';

const AdminPanel = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'deletion-requests', 'restore-requests', 'recently-deleted', 'tickets', 'emails'
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [restoreRequests, setRestoreRequests] = useState([]);
  const [recentlyDeleted, setRecentlyDeleted] = useState([]);
  const [tickets, setTickets] = useState([]);
  const navigate = useNavigate();

  // Outgoing Emails State
  const [emails, setEmails] = useState([]);
  const [emailsSearch, setEmailsSearch] = useState('');
  const [emailsStatus, setEmailsStatus] = useState('');
  const [emailsPage, setEmailsPage] = useState(1);
  const [emailsTotalPages, setEmailsTotalPages] = useState(1);
  const [emailsTotalCount, setEmailsTotalCount] = useState(0);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [resendingId, setResendingId] = useState(null);

  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isAlert: false, isPrompt: false, promptValue: '' });

  const showAlert = (title, message) => setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true, isPrompt: false, promptValue: '' });
  const showConfirm = (title, message, onConfirm) => setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: false, promptValue: '' });
  const showPrompt = (title, message, onConfirm) => setPopup({ isOpen: true, title, message, onConfirm, isAlert: false, isPrompt: true, promptValue: '' });

  // Responsive device detector
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'deletion-requests', label: 'Deletion', icon: Trash2 },
    { id: 'restore-requests', label: 'Restore', icon: RotateCcw },
    { id: 'recently-deleted', label: 'History', icon: History },
    { id: 'tickets', label: 'Requests', icon: MessageSquare },
    { id: 'emails', label: t('admin_emails_tab') || 'Emails', icon: Mail }
  ];

  const getBadgeCount = (id) => {
    if (id === 'deletion-requests') return deletionRequests.length;
    if (id === 'restore-requests') return restoreRequests.length;
    if (id === 'tickets') return tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;
    return 0;
  };

  // Parallel initial data load to populate counts & metrics instantly
  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/dashboard');
      return;
    }
    const initLoad = async () => {
      try {
        setLoading(true);
        await Promise.allSettled([
          fetchUsers(),
          fetchDeletionRequests(),
          fetchRestoreRequests(),
          fetchRecentlyDeleted(),
          fetchTickets(),
          fetchEmails()
        ]);
      } catch (err) {
        console.error("Admin parallel initialization error", err);
      } finally {
        setLoading(false);
      }
    };
    initLoad();
  }, [user, navigate]);

  // Fresh re-fetch of individual lists on tab selection
  useEffect(() => {
    if (user?.role !== 'ADMIN' || loading) return;
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'deletion-requests') fetchDeletionRequests();
    if (activeTab === 'restore-requests') fetchRestoreRequests();
    if (activeTab === 'recently-deleted') fetchRecentlyDeleted();
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'emails') fetchEmails();
  }, [activeTab, emailsSearch, emailsStatus, emailsPage]);

  const fetchEmails = async () => {
    try {
      setEmailsLoading(true);
      const res = await api.get('/emails', {
        params: {
          page: emailsPage,
          limit: 10,
          search: emailsSearch,
          status: emailsStatus
        }
      });
      setEmails(res.data.emails);
      setEmailsTotalPages(res.data.totalPages);
      setEmailsTotalCount(res.data.totalCount);
    } catch (err) {
      setError('Failed to fetch email logs');
    } finally {
      setEmailsLoading(false);
      setLoading(false);
    }
  };

  const handleResendEmail = async (id) => {
    try {
      setResendingId(id);
      await api.post(`/emails/${id}/resend`);
      showAlert('Success', t('email_resend_success'));
      fetchEmails();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || t('email_resend_error'));
    } finally {
      setResendingId(null);
    }
  };

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
      showAlert('Error', 'You cannot change your own role.');
      return;
    }
    try {
      await api.put(`/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleToggleReminders = async (userId) => {
    try {
      await api.put(`/users/${userId}/toggle-reminders`);
      fetchUsers();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to toggle reminders');
    }
  };

  const handleRequestNameChange = async (userId) => {
    try {
      await api.put(`/users/${userId}/request-name-change`);
      fetchUsers();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to request name change');
    }
  };

  const handleApproveDeletion = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/approve-deletion`);
      fetchDeletionRequests();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to approve deletion');
    }
  };

  const handleRejectDeletion = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/reject-deletion`);
      fetchDeletionRequests();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to reject deletion');
    }
  };

  const handleApproveRestore = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/approve-restore`);
      fetchRestoreRequests();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to approve restore');
    }
  };

  const handleRejectRestore = async (id) => {
    try {
      await api.put(`/threads/admin/${id}/reject-restore`);
      fetchRestoreRequests();
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to reject restore');
    }
  };

  const handleUpdateTicketStatus = async (id, status) => {
    try {
      await api.patch(`/tickets/${id}/admin`, { status });
      fetchTickets();
    } catch (err) {
      showAlert('Error', err.response?.data?.msg || 'Failed to update ticket');
    }
  };

  const handleAdminResponse = (id) => {
    showPrompt('Admin Response', 'Enter admin response:', async (response) => {
      if (response && response.trim() !== '') {
        try {
          await api.patch(`/tickets/${id}/admin`, { adminResponse: response.trim() });
          fetchTickets();
        } catch (err) {
          showAlert('Error', err.response?.data?.msg || 'Failed to update response');
        }
      }
    });
  };

  const handleDeleteUser = (id) => {
    showConfirm('Delete User', 'Are you sure you want to delete this user? This action cannot be undone.', async () => {
      try {
        await api.delete(`/users/${id}`);
        fetchUsers();
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'Failed to delete user');
      }
    });
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '1rem' }}>
      <RefreshCw size={40} className="spin" style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '1rem' }}>Initializing Admin Workspace...</span>
    </div>
  );

  // Compute summary stats
  const totalUsers = users.length;
  const verifiedUsers = users.filter(u => u.isVerified).length;
  const pendingApprovals = deletionRequests.length + restoreRequests.length;
  const activeTickets = tickets.filter(t => t.status === 'open' || t.status === 'in-progress').length;
  const emailVolume = emailsTotalCount;

  return (
    <div className="container" style={{ maxWidth: '1080px', padding: isMobile ? '1rem 0.75rem 5.5rem' : '2rem 1.5rem' }}>
      
      {/* Centered Premium Header */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: isMobile ? '1.5rem' : '2rem', position: 'relative' }}>
        <div className="btn-back-wrapper">
          <button 
            onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/dashboard')} 
            className="btn-back-pill"
          >
            <ChevronLeft size={16} /> {t('back')}
          </button>
        </div>
        <h2 style={{
          fontSize: isMobile ? '1.6rem' : '2.2rem',
          fontWeight: '900',
          textAlign: 'center',
          margin: 0,
          background: 'linear-gradient(135deg, #a78bfa 0%, #3b82f6 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.03em',
          textShadow: '0 4px 12px rgba(59, 130, 246, 0.1)',
        }}>
          Admin Dashboard
        </h2>
        <p style={{ margin: '0.35rem 0 0', fontSize: isMobile ? '0.8rem' : '0.9rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          System Administration and Platform Integrity Control
        </p>
      </div>
      
      {/* 2-Column Responsive Dashboard Layout */}
      <div style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? '1rem' : '1.5rem',
        alignItems: 'flex-start',
        width: '100%',
        marginTop: '1.5rem'
      }}>
        
        {/* Navigation panel */}
        {!isMobile && (
          /* Desktop Vertical Sidebar Navigation */
          <div style={{
            width: '240px',
            flexShrink: 0,
            background: 'var(--surface)',
            border: '1px solid var(--surface-border)',
            borderRadius: '1rem',
            padding: '0.6rem',
            boxShadow: 'var(--shadow-sm)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            position: 'sticky',
            top: '2rem'
          }}>
            <div style={{ padding: '0.5rem 0.75rem 0.25rem', fontSize: '0.72rem', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Control Center
            </div>
            {tabs.map(tab => {
              const active = activeTab === tab.id;
              const TabIcon = tab.icon;
              const badgeCount = getBadgeCount(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '0.75rem',
                    border: 'none',
                    background: active ? 'var(--primary-glow)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--text-muted)',
                    fontWeight: active ? '700' : '600',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: active ? '0 4px 12px rgba(59, 130, 246, 0.08)' : 'none'
                  }}
                  onMouseEnter={e => { if(!active) e.currentTarget.style.color = 'var(--text-main)'; }}
                  onMouseLeave={e => { if(!active) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <TabIcon size={16} className="admin-tab-icon" style={{ strokeWidth: active ? '2.5' : '2' }} />
                    <span>{tab.label}</span>
                  </div>
                  {badgeCount > 0 && (
                    <span style={{
                      background: tab.id === 'tickets' ? '#8b5cf6' : '#ef4444',
                      color: 'white',
                      borderRadius: '9999px',
                      fontSize: '0.65rem',
                      fontWeight: '800',
                      padding: '0.1rem 0.4rem',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                    }}>
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Content Column */}
        <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
          <div className="card" style={{ padding: '0', overflow: 'hidden', background: 'transparent', boxShadow: 'none', border: 'none' }}>
        {activeTab === 'users' && (() => {
          const getInitials = (name) => {
            if (!name) return '?';
            const parts = name.trim().split(/\s+/);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            return name.trim().substring(0, 2).toUpperCase();
          };
          
          const getRoleGradient = (role) => {
            if (role === 'ADMIN') return 'linear-gradient(135deg, #c084fc 0%, #6366f1 100%)';
            if (role === 'YOUTH_TREASURER') return 'linear-gradient(135deg, #34d399 0%, #0d9488 100%)';
            if (role === 'COUNSELOR') return 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)';
            return 'linear-gradient(135deg, #94a3b8 0%, #475569 100%)';
          };

          return (
            <>
              {/* Desktop Modern Glass Table */}
              <div className="admin-table-container desktop-admin-table card" style={{
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                borderRadius: '1.25rem',
                boxShadow: 'var(--shadow-sm)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>User Details</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Verification</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Role</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dues Subscriptions</th>
                      <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                        
                        {/* Avatar & Name */}
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {u.profilePicture ? (
                              PRESETS.includes(u.profilePicture) ? (
                                renderPresetSvg(u.profilePicture, 40, { flexShrink: 0 })
                              ) : (
                                <img
                                  src={u.profilePicture}
                                  alt={u.displayName}
                                  style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '9999px',
                                    objectFit: 'cover',
                                    border: '2px solid var(--border-color)',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    flexShrink: 0
                                  }}
                                />
                              )
                            ) : (
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '9999px',
                                background: getRoleGradient(u.role),
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '800',
                                fontSize: '0.9rem',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                flexShrink: 0
                              }}>
                                {getInitials(u.displayName)}
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.92rem' }}>{u.displayName}</span>
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>{u.email}</span>
                            </div>
                          </div>
                        </td>

                        {/* Verified Badge */}
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', background: u.isVerified ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)', color: u.isVerified ? '#10b981' : '#f59e0b', padding: '0.3rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700' }}>
                            {u.isVerified ? <CheckCircle size={12} /> : <ShieldAlert size={12} />}
                            {u.isVerified ? 'Verified' : 'Unverified'}
                          </div>
                        </td>

                        {/* Role Chip */}
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{
                            background: u.role === 'ADMIN' ? 'rgba(192,132,252,0.15)' : u.role === 'YOUTH_TREASURER' ? 'rgba(52,211,153,0.15)' : u.role === 'COUNSELOR' ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.15)',
                            color: u.role === 'ADMIN' ? '#c084fc' : u.role === 'YOUTH_TREASURER' ? '#34d399' : u.role === 'COUNSELOR' ? '#fbbf24' : '#94a3b8',
                            padding: '0.3rem 0.65rem',
                            borderRadius: '0.5rem',
                            fontSize: '0.75rem',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em'
                          }}>
                            {u.role === 'ADMIN' && t('role_admin')}
                            {u.role === 'COUNSELOR' && t('role_counselor')}
                            {u.role === 'YOUTH_TREASURER' && t('role_youth_treasurer')}
                            {u.role === 'MEMBER' && t('role_member')}
                          </span>
                        </td>

                        {/* Reminders Toggle & Name Change */}
                        <td style={{ padding: '1rem 1.25rem' }}>
                          {u.isVerified ? (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button 
                                onClick={() => handleToggleReminders(u._id)}
                                style={{ 
                                  background: u.subscribedToDuesReminders ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', 
                                  color: u.subscribedToDuesReminders ? '#22c55e' : 'var(--text-muted)',
                                  border: `1px solid ${u.subscribedToDuesReminders ? 'rgba(34,197,94,0.2)' : 'var(--border-color)'}`,
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                              >
                                {u.subscribedToDuesReminders ? <Bell size={13} style={{ fill: 'rgba(34,197,94,0.1)' }} /> : <BellOff size={13} />}
                                {u.subscribedToDuesReminders ? t('reminders_enabled') : t('reminders_disabled')}
                              </button>

                              <button 
                                onClick={() => handleRequestNameChange(u._id)}
                                style={{ 
                                  background: u.nameChangeRequested ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', 
                                  color: u.nameChangeRequested ? '#f59e0b' : 'var(--text-main)',
                                  border: `1px solid ${u.nameChangeRequested ? 'rgba(245,158,11,0.2)' : 'var(--border-color)'}`,
                                  padding: '0.4rem 0.8rem',
                                  borderRadius: '9999px',
                                  fontSize: '0.75rem',
                                  cursor: 'pointer',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.4rem',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                              >
                                <UserCog size={13} />
                                {u.nameChangeRequested ? 'Change Pending' : 'Request Rename'}
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Require Verification</span>
                          )}
                        </td>

                        {/* Interactive Edit / Role Actions */}
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          {u._id !== user._id ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem' }}>
                              <select 
                                value={u.role} 
                                onChange={(e) => handleRoleChange(u._id, e.target.value)}
                                style={{ 
                                  padding: '0.35rem 0.6rem', 
                                  borderRadius: '0.5rem', 
                                  border: '1px solid var(--border-color)', 
                                  background: 'rgba(0,0,0,0.2)', 
                                  color: 'var(--text-main)',
                                  fontSize: '0.82rem',
                                  fontWeight: '600',
                                  outline: 'none',
                                  cursor: 'pointer'
                                }}
                              >
                                <option value="MEMBER">{t('role_member')}</option>
                                <option value="COUNSELOR">{t('role_counselor')}</option>
                                <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
                                <option value="ADMIN">{t('role_admin')}</option>
                              </select>
                              <button 
                                onClick={() => handleDeleteUser(u._id)}
                                style={{ 
                                  background: 'rgba(239,68,68,0.08)', 
                                  border: '1px solid rgba(239,68,68,0.15)', 
                                  color: '#ef4444', 
                                  cursor: 'pointer', 
                                  padding: '0.4rem', 
                                  borderRadius: '0.5rem',
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center',
                                  transition: 'all 0.2s',
                                  outline: 'none'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                title="Delete User"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingRight: '0.5rem' }}>Current Session</span>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Glass Card Deck */}
              <div className="mobile-admin-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {users.map(u => (
                  <div key={u._id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-sm)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)'
                  }}>
                    {/* Member Top Bar */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {u.profilePicture ? (
                        PRESETS.includes(u.profilePicture) ? (
                          renderPresetSvg(u.profilePicture, 34, { flexShrink: 0 })
                        ) : (
                          <img
                            src={u.profilePicture}
                            alt={u.displayName}
                            style={{
                              width: '34px',
                              height: '34px',
                              borderRadius: '9999px',
                              objectFit: 'cover',
                              border: '1.5px solid var(--border-color)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                              flexShrink: 0
                            }}
                          />
                        )
                      ) : (
                        <div style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '9999px',
                          background: getRoleGradient(u.role),
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '800',
                          fontSize: '0.85rem',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                          flexShrink: 0
                        }}>
                          {getInitials(u.displayName)}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.displayName}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.02rem' }}>
                          {u.email}
                        </span>
                      </div>
                      
                      {/* Compact Role Badge in Header */}
                      <span style={{
                        background: u.role === 'ADMIN' ? 'rgba(192,132,252,0.15)' : u.role === 'YOUTH_TREASURER' ? 'rgba(52,211,153,0.15)' : u.role === 'COUNSELOR' ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.15)',
                        color: u.role === 'ADMIN' ? '#c084fc' : u.role === 'YOUTH_TREASURER' ? '#34d399' : u.role === 'COUNSELOR' ? '#fbbf24' : '#94a3b8',
                        padding: '0.2rem 0.4rem',
                        borderRadius: '0.3rem',
                        fontSize: '0.65rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        flexShrink: 0
                      }}>
                        {u.role === 'ADMIN' && t('role_admin')}
                        {u.role === 'COUNSELOR' && t('role_counselor')}
                        {u.role === 'YOUTH_TREASURER' && t('role_youth_treasurer')}
                        {u.role === 'MEMBER' && t('role_member')}
                      </span>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

                    {/* Metadata & Quick Actions Fields */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        color: u.isVerified ? '#10b981' : '#f59e0b',
                        fontSize: '0.72rem',
                        fontWeight: '700'
                      }}>
                        {u.isVerified ? <CheckCircle size={10} /> : <ShieldAlert size={10} />}
                        {u.isVerified ? 'Verified' : 'Unverified'}
                      </div>

                      {u.isVerified && (
                        <div style={{ display: 'flex', gap: '0.3rem' }}>
                          <button 
                            onClick={() => handleToggleReminders(u._id)}
                            style={{ 
                              background: u.subscribedToDuesReminders ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)', 
                              color: u.subscribedToDuesReminders ? '#22c55e' : 'var(--text-muted)',
                              border: `1px solid ${u.subscribedToDuesReminders ? 'rgba(34,197,94,0.2)' : 'var(--border-color)'}`,
                              padding: '0.25rem 0.45rem',
                              borderRadius: '9999px',
                              fontSize: '0.68rem',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              outline: 'none'
                            }}
                          >
                            {u.subscribedToDuesReminders ? <Bell size={10} style={{ fill: 'rgba(34,197,94,0.1)' }} /> : <BellOff size={10} />}
                            Dues
                          </button>

                          <button 
                            onClick={() => handleRequestNameChange(u._id)}
                            style={{ 
                              background: u.nameChangeRequested ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)', 
                              color: u.nameChangeRequested ? '#f59e0b' : 'var(--text-main)',
                              border: `1px solid ${u.nameChangeRequested ? 'rgba(245,158,11,0.2)' : 'var(--border-color)'}`,
                              padding: '0.25rem 0.45rem',
                              borderRadius: '9999px',
                              fontSize: '0.68rem',
                              cursor: 'pointer',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.2rem',
                              outline: 'none'
                            }}
                          >
                            <UserCog size={10} />
                            Rename
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mobile Card Actions */}
                    {u._id !== user._id && (
                      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                        <select 
                          value={u.role} 
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          style={{ 
                            padding: '0.4rem', 
                            borderRadius: '0.4rem', 
                            border: '1px solid var(--border-color)', 
                            background: 'rgba(0,0,0,0.2)', 
                            color: 'var(--text-main)', 
                            flex: 1, 
                            fontSize: '0.78rem',
                            fontWeight: '600',
                            outline: 'none'
                          }}
                        >
                          <option value="MEMBER">{t('role_member')}</option>
                          <option value="COUNSELOR">{t('role_counselor')}</option>
                          <option value="YOUTH_TREASURER">{t('role_youth_treasurer')}</option>
                          <option value="ADMIN">{t('role_admin')}</option>
                        </select>
                        <button 
                          onClick={() => handleDeleteUser(u._id)}
                          style={{ 
                            background: 'rgba(239,68,68,0.08)', 
                            border: '1px solid rgba(239,68,68,0.2)', 
                            color: '#ef4444', 
                            cursor: 'pointer', 
                            padding: '0.4rem 0.6rem', 
                            borderRadius: '0.4rem', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0,
                            outline: 'none'
                          }}
                          title="Delete User"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          );
        })()}

        {activeTab === 'deletion-requests' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {deletionRequests.length === 0 ? (
              <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '1.25rem' }}>
                <Trash2 size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-main)', fontWeight: '700' }}>No Deletion Requests</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>There are no active thread deletion requests needing approval.</p>
              </div>
            ) : (
              deletionRequests.map(t => (
                <div key={t._id} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: isMobile ? '0.75rem' : '1.25rem',
                  padding: isMobile ? '0.75rem' : '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '0.6rem' : '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  transition: 'transform 0.2s'
                }} className="card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                      Pending Approval
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {new Date(t.deletionRequestedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>

                  {/* Flow Bridge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: isMobile ? '0.5rem' : '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Sender</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sender?.displayName || 'Unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0 0.4rem', fontSize: '0.8rem' }}>
                      ➔
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Receiver</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.receiver?.displayName || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
                    <button 
                      onClick={() => handleApproveDeletion(t._id)} 
                      style={{ 
                        flex: 1, 
                        background: 'rgba(16, 185, 129, 0.1)', 
                        border: '1px solid rgba(16, 185, 129, 0.25)', 
                        color: '#10b981', 
                        padding: isMobile ? '0.45rem' : '0.55rem', 
                        borderRadius: isMobile ? '0.5rem' : '0.75rem', 
                        cursor: 'pointer', 
                        fontWeight: '700',
                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)'}
                    >
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button 
                      onClick={() => handleRejectDeletion(t._id)} 
                      style={{ 
                        flex: 1, 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        border: '1px solid rgba(239, 68, 68, 0.15)', 
                        color: '#ef4444', 
                        padding: isMobile ? '0.45rem' : '0.55rem', 
                        borderRadius: isMobile ? '0.5rem' : '0.75rem', 
                        cursor: 'pointer', 
                        fontWeight: '700',
                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    >
                      <Trash2 size={13} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'restore-requests' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {restoreRequests.length === 0 ? (
              <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '1.25rem' }}>
                <RotateCcw size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-main)', fontWeight: '700' }}>No Restore Requests</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>There are no active thread restore requests needing approval.</p>
              </div>
            ) : (
              restoreRequests.map(t => (
                <div key={t._id} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: isMobile ? '0.75rem' : '1.25rem',
                  padding: isMobile ? '0.75rem' : '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: isMobile ? '0.6rem' : '1rem',
                  boxShadow: 'var(--shadow-sm)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  transition: 'transform 0.2s'
                }} className="card-hover">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', background: 'var(--primary-glow)', padding: '0.2rem 0.5rem', borderRadius: '9999px' }}>
                      Restore Pending
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      Needs Verification
                    </span>
                  </div>

                  {/* Flow Bridge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: isMobile ? '0.5rem' : '0.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Sender</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sender?.displayName || 'Unknown'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0 0.4rem', fontSize: '0.8rem' }}>
                      ➔
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Receiver</span>
                      <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.receiver?.displayName || 'Unknown'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.1rem' }}>
                    <button 
                      onClick={() => handleApproveRestore(t._id)} 
                      style={{ 
                        flex: 1, 
                        background: 'var(--primary-glow)', 
                        border: '1px solid rgba(59, 130, 246, 0.25)', 
                        color: 'var(--primary)', 
                        padding: isMobile ? '0.45rem' : '0.55rem', 
                        borderRadius: isMobile ? '0.5rem' : '0.75rem', 
                        cursor: 'pointer', 
                        fontWeight: '700',
                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                    >
                      <RotateCcw size={13} /> Restore
                    </button>
                    <button 
                      onClick={() => handleRejectRestore(t._id)} 
                      style={{ 
                        flex: 1, 
                        background: 'rgba(239, 68, 68, 0.08)', 
                        border: '1px solid rgba(239, 68, 68, 0.15)', 
                        color: '#ef4444', 
                        padding: isMobile ? '0.45rem' : '0.55rem', 
                        borderRadius: isMobile ? '0.5rem' : '0.75rem', 
                        cursor: 'pointer', 
                        fontWeight: '700',
                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.35rem',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                    >
                      <Trash2 size={13} /> Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'recently-deleted' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            {recentlyDeleted.length === 0 ? (
              <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '1.25rem' }}>
                <History size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-main)', fontWeight: '700' }}>No Deleted Threads</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>There are no recently deleted message logs in the 60-day archive.</p>
              </div>
            ) : (
              recentlyDeleted.map(t => {
                const deletedDate = new Date(t.deletedAt);
                const expiryDate = new Date(deletedDate.getTime() + 60 * 24 * 60 * 60 * 1000);
                const daysLeft = Math.ceil((expiryDate - new Date()) / (1000 * 60 * 60 * 24));
                const percentLeft = Math.max(0, Math.min(100, (daysLeft / 60) * 100));

                let statusColor = '#10b981';
                if (daysLeft < 15) {
                  statusColor = '#ef4444';
                } else if (daysLeft < 30) {
                  statusColor = '#f59e0b';
                }

                return (
                  <div key={t._id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: isMobile ? '0.75rem' : '1.25rem',
                    padding: isMobile ? '0.75rem' : '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '0.5rem' : '0.85rem',
                    boxShadow: 'var(--shadow-sm)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    transition: 'transform 0.2s'
                  }} className="card-hover">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                        Archived Log
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                        Deleted {deletedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Flow Bridge */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: isMobile ? '0.4rem 0.6rem' : '0.6rem 0.75rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Sender</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sender?.displayName || 'Unknown'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)', padding: '0 0.4rem', fontSize: '0.8rem' }}>
                        ➔
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right', minWidth: 0 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>Receiver</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.receiver?.displayName || 'Unknown'}</span>
                      </div>
                    </div>

                    {/* Timeline Progression Meter */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Retention Window</span>
                        <span style={{ color: statusColor, fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Clock size={10} /> {daysLeft} days remaining
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: 'var(--border-color)', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ width: `${percentLeft}%`, height: '100%', background: statusColor, borderRadius: '9999px', transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {tickets.length === 0 ? (
              <div className="card text-center" style={{ gridColumn: '1 / -1', padding: '3rem 2rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '1.25rem' }}>
                <MessageSquare size={40} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '0.75rem' }} />
                <h4 style={{ margin: '0 0 0.25rem', color: 'var(--text-main)', fontWeight: '700' }}>No Active Requests</h4>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>There are no system request tickets logged currently.</p>
              </div>
            ) : (
              tickets.map(t => {
                const isResolved = t.status === 'resolved' || t.status === 'closed';
                
                return (
                  <div key={t._id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: isMobile ? '0.75rem' : '1.25rem',
                    padding: isMobile ? '0.75rem' : '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isMobile ? '0.5rem' : '1rem',
                    boxShadow: 'var(--shadow-sm)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    position: 'relative'
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        background: t.type === 'bug' ? 'rgba(239,68,68,0.12)' : t.type === 'feature' ? 'rgba(59,130,246,0.12)' : 'rgba(139,92,246,0.12)',
                        color: t.type === 'bug' ? '#ef4444' : t.type === 'feature' ? '#3b82f6' : '#8b5cf6',
                        padding: '0.2rem 0.45rem',
                        borderRadius: '9999px',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em'
                      }}>
                        {t.type}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                        by {t.createdBy?.displayName || 'Member'}
                      </span>
                    </div>

                    {/* Content */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: isMobile ? '0.9rem' : '1rem', fontWeight: '800', letterSpacing: '-0.01em' }}>
                        {t.title}
                      </h4>
                      <p style={{ margin: 0, fontSize: isMobile ? '0.8rem' : '0.85rem', color: 'var(--text-muted)', lineHeight: '1.35' }}>
                        {t.description}
                      </p>
                    </div>

                    {/* Dialog Speech bubble (Admin Reply) */}
                    {t.adminResponse && (
                      <div style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border-color)',
                        borderRadius: isMobile ? '0.5rem' : '0.75rem',
                        padding: isMobile ? '0.5rem' : '0.75rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.15rem',
                        position: 'relative'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.72rem', color: 'var(--primary)', fontWeight: '700' }}>
                          <CheckCircle size={11} /> Admin Response
                        </div>
                        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-main)', lineHeight: '1.3' }}>
                          {t.adminResponse}
                        </p>
                      </div>
                    )}

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

                    {/* Actions Panel */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select 
                        value={t.status} 
                        onChange={(e) => handleUpdateTicketStatus(t._id, e.target.value)}
                        style={{ 
                          padding: isMobile ? '0.4rem 0.5rem' : '0.5rem 0.6rem', 
                          borderRadius: isMobile ? '0.5rem' : '0.75rem', 
                          border: '1px solid var(--border-color)', 
                          background: 'rgba(0,0,0,0.2)', 
                          color: 'var(--text-main)',
                          fontSize: isMobile ? '0.78rem' : '0.82rem',
                          fontWeight: '700',
                          outline: 'none',
                          cursor: 'pointer',
                          flex: 1
                        }}
                      >
                        <option value="open">🟢 Open</option>
                        <option value="in-progress">🟡 In Progress</option>
                        <option value="resolved">🔵 Resolved</option>
                        <option value="closed">⚪ Closed</option>
                      </select>

                      <button 
                        onClick={() => handleAdminResponse(t._id)} 
                        className="btn btn-secondary"
                        style={{ 
                          padding: isMobile ? '0.4rem 0.6rem' : '0.5rem 0.75rem', 
                          fontSize: isMobile ? '0.78rem' : '0.82rem',
                          borderRadius: isMobile ? '0.5rem' : '0.75rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          fontWeight: '700'
                        }}
                      >
                        <MessageSquare size={12} /> {t.adminResponse ? 'Edit Reply' : 'Reply'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'emails' && (
          <>
            {/* Filters panel */}
            <div className="card" style={{
              padding: isMobile ? '0.75rem' : '1.25rem',
              marginBottom: isMobile ? '0.75rem' : '1.25rem',
              display: 'flex',
              gap: isMobile ? '0.5rem' : '1rem',
              flexWrap: 'wrap',
              alignItems: 'center',
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              borderRadius: isMobile ? '0.75rem' : '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)'
            }}>
              {/* Search Bar Input */}
              <div style={{ flex: 1, minWidth: '220px', position: 'relative', display: 'flex', alignItems: 'center' }}>
                <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  value={emailsSearch}
                  onChange={(e) => {
                    setEmailsSearch(e.target.value);
                    setEmailsPage(1);
                  }}
                  placeholder={t('email_search_placeholder')}
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                    borderRadius: '0.75rem',
                    border: '1px solid var(--border-color)',
                    background: 'rgba(0,0,0,0.15)',
                    color: 'var(--text-main)',
                    fontSize: '0.88rem',
                    fontWeight: '600',
                    outline: 'none',
                    transition: 'border 0.2s'
                  }}
                />
              </div>

              {/* Status Select */}
              <select
                value={emailsStatus}
                onChange={(e) => {
                  setEmailsStatus(e.target.value);
                  setEmailsPage(1);
                }}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '0.75rem',
                  border: '1px solid var(--border-color)',
                  background: 'rgba(0,0,0,0.15)',
                  color: 'var(--text-main)',
                  minWidth: '160px',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">📨 {t('email_all_statuses')}</option>
                <option value="sent">🟢 {t('email_status_sent')}</option>
                <option value="failed">🔴 {t('email_status_failed')}</option>
              </select>
            </div>

            {/* Desktop Table View */}
            <div className="admin-table-container desktop-admin-table card" style={{
              background: 'var(--surface)',
              border: '1px solid var(--surface-border)',
              borderRadius: '1.25rem',
              boxShadow: 'var(--shadow-sm)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              overflow: 'hidden'
            }}>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('email_to')}</th>
                    <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('email_subject')}</th>
                    <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('email_sent_at')}</th>
                    <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('email_status')}</th>
                    <th style={{ padding: '1rem 1.25rem', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        {emailsLoading ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <RefreshCw size={16} className="spin" /> Hydrating Logs...
                          </div>
                        ) : t('email_no_logs')}
                      </td>
                    </tr>
                  ) : (
                    emails.map(email => (
                      <tr key={email._id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.2s' }} className="table-row-hover">
                        <td style={{ padding: '1rem 1.25rem', fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{email.to}</td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.88rem', color: 'var(--text-main)', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {email.subject}
                        </td>
                        <td style={{ padding: '1rem 1.25rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {new Date(email.sentAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td style={{ padding: '1rem 1.25rem' }}>
                          <span style={{
                            background: email.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: email.status === 'sent' ? '#22c55e' : '#ef4444',
                            padding: '0.25rem 0.6rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: '700'
                          }}>
                            {email.status === 'sent' ? t('email_status_sent') : t('email_status_failed')}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => setEmailPreview(email)}
                              style={{ 
                                background: 'rgba(255,255,255,0.03)', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-main)',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.2s',
                                outline: 'none'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => handleResendEmail(email._id)}
                              disabled={resendingId === email._id}
                              style={{ 
                                background: 'var(--primary-glow)', 
                                border: '1px solid rgba(59,130,246,0.2)', 
                                color: 'var(--primary)',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '0.5rem',
                                fontSize: '0.78rem',
                                cursor: 'pointer',
                                fontWeight: '700',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.35rem',
                                transition: 'all 0.2s',
                                outline: 'none'
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = 'rgba(59,130,246,0.15)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'var(--primary-glow)'}
                            >
                              <RefreshCw size={13} className={resendingId === email._id ? 'spin' : ''} />
                              {resendingId === email._id ? 'Resending' : 'Resend'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="mobile-admin-cards" style={{ flexDirection: 'column', gap: '0.5rem' }}>
              {emails.length === 0 ? (
                <div className="card text-center" style={{ padding: '2rem', color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: '0.75rem' }}>
                  {emailsLoading ? 'Loading Logs...' : t('email_no_logs')}
                </div>
              ) : (
                emails.map(email => (
                  <div key={email._id} style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--surface-border)',
                    padding: '0.75rem',
                    borderRadius: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    boxShadow: 'var(--shadow-sm)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>To: {email.to}</span>
                      <span style={{
                        background: email.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: email.status === 'sent' ? '#22c55e' : '#ef4444',
                        padding: '0.15rem 0.45rem',
                        borderRadius: '9999px',
                        fontSize: '0.68rem',
                        fontWeight: '700',
                        flexShrink: 0
                      }}>
                        {email.status === 'sent' ? 'Sent' : 'Failed'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                      <span style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {email.subject}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {new Date(email.sentAt).toLocaleString()}
                      </span>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: 0 }} />

                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        onClick={() => setEmailPreview(email)}
                        style={{ 
                          flex: 1, 
                          background: 'rgba(255,255,255,0.03)', 
                          border: '1px solid var(--border-color)', 
                          color: 'var(--text-main)',
                          padding: '0.45rem', 
                          borderRadius: '0.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          outline: 'none'
                        }}
                      >
                        <Eye size={12} /> View
                      </button>
                      <button
                        onClick={() => handleResendEmail(email._id)}
                        disabled={resendingId === email._id}
                        style={{ 
                          flex: 1, 
                          background: 'var(--primary-glow)', 
                          border: '1px solid rgba(59,130,246,0.2)', 
                          color: 'var(--primary)',
                          padding: '0.45rem', 
                          borderRadius: '0.5rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: '0.3rem',
                          fontSize: '0.78rem',
                          fontWeight: '700',
                          outline: 'none'
                        }}
                      >
                        <RefreshCw size={12} className={resendingId === email._id ? 'spin' : ''} />
                        {resendingId === email._id ? 'Resending' : 'Resend'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Controls */}
            {emailsTotalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.75rem', marginBottom: '1.75rem' }}>
                <button
                  disabled={emailsPage === 1}
                  onClick={() => setEmailsPage(prev => Math.max(prev - 1, 1))}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', fontWeight: '700' }}
                >
                  {t('previous')}
                </button>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '700' }}>
                  {t('page_of')(emailsPage, emailsTotalPages)}
                </span>
                <button
                  disabled={emailsPage === emailsTotalPages}
                  onClick={() => setEmailsPage(prev => Math.min(prev + 1, emailsTotalPages))}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', borderRadius: '0.75rem', fontWeight: '700' }}
                >
                  {t('next')}
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </div>
      </div>

      <PopupModal 
        isOpen={popup.isOpen}
        onClose={() => setPopup(p => ({ ...p, isOpen: false }))}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
        isPrompt={popup.isPrompt}
        promptValue={popup.promptValue}
        onPromptChange={(val) => setPopup(p => ({ ...p, promptValue: val }))}
      />

      {/* Outgoing Email Slide-out Preview Drawer Sheet */}
      {emailPreview && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          justifyContent: 'flex-end',
          zIndex: 1000,
          animation: 'fadeIn 0.25s ease-out'
        }} onClick={() => setEmailPreview(null)}>
          
          {/* Prevent click bubbling inside the drawer */}
          <div 
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: 'var(--surface)',
              borderLeft: '1px solid var(--surface-border)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.75rem',
              overflowY: 'auto',
              boxSizing: 'border-box',
              animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }} 
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mail size={20} style={{ color: 'var(--primary)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
                  Email System Preview
                </h3>
              </div>
              <button 
                onClick={() => setEmailPreview(null)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  borderRadius: '9999px',
                  padding: '0.4rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <X size={16} />
              </button>
            </div>
            
            {/* Meta Attributes Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.88rem', color: 'var(--text-main)', background: 'rgba(255,255,255,0.01)', padding: '1rem', borderRadius: '0.75rem', border: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>To:</span>
                <span style={{ fontWeight: '700' }}>{emailPreview.to}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Subject:</span>
                <span style={{ fontWeight: '700', textAlign: 'right', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emailPreview.subject}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Sent:</span>
                <span>{new Date(emailPreview.sentAt).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>Status:</span>
                <span style={{
                  color: emailPreview.status === 'sent' ? '#22c55e' : '#ef4444',
                  background: emailPreview.status === 'sent' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: '700'
                }}>
                  {emailPreview.status === 'sent' ? 'Sent Success' : 'Delivery Failed'}
                </span>
              </div>
              {emailPreview.error && (
                <div style={{ color: '#ef4444', marginTop: '0.25rem', fontSize: '0.82rem', borderTop: '1px solid rgba(239,68,68,0.15)', paddingTop: '0.5rem' }}>
                  <strong>Error:</strong> {emailPreview.error}
                </div>
              )}
            </div>
            
            {/* HTML Body Container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: 0 }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700' }}>Email Body Content</span>
              <iframe
                srcDoc={emailPreview.html}
                title="Email Preview Body"
                style={{
                  width: '100%',
                  flex: 1,
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.75rem',
                  background: '#ffffff',
                  boxShadow: 'var(--shadow-inner)'
                }}
              />
            </div>

            {/* Actions Panel */}
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button 
                onClick={() => {
                  handleResendEmail(emailPreview._id);
                  setEmailPreview(null);
                }}
                className="btn btn-primary"
                style={{ 
                  flex: 1, 
                  padding: '0.65rem', 
                  borderRadius: '0.75rem', 
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem'
                }}
              >
                <RefreshCw size={15} /> Resend Email
              </button>
              <button 
                onClick={() => setEmailPreview(null)}
                className="btn btn-secondary"
                style={{ 
                  padding: '0.65rem 1.25rem', 
                  borderRadius: '0.75rem', 
                  fontWeight: '700'
                }}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Floating Bottom Navigation Bar */}
      {isMobile && (
        <div style={{
          position: 'fixed',
          bottom: '1.25rem',
          left: '1rem',
          right: '1rem',
          zIndex: 999,
        }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                borderRadius: '0.75rem',
                background: 'var(--surface)',
                border: '1px solid var(--surface-border)',
                color: 'var(--text-main)',
                fontSize: '0.9rem',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'all 0.2s',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {(() => {
                  const activeTabObj = tabs.find(t => t.id === activeTab) || tabs[0];
                  const ActiveIcon = activeTabObj.icon;
                  return (
                    <>
                      <ActiveIcon size={18} style={{ color: 'var(--primary)' }} />
                      <span>{activeTabObj.label}</span>
                      {getBadgeCount(activeTabObj.id) > 0 && (
                        <span style={{
                          background: activeTabObj.id === 'tickets' ? '#8b5cf6' : '#ef4444',
                          color: 'white',
                          borderRadius: '9999px',
                          fontSize: '0.6rem',
                          fontWeight: '800',
                          padding: '0.1rem 0.35rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {getBadgeCount(activeTabObj.id)}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
              <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: mobileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Floating Dropdown overlay (expands UPWARD) */}
            {mobileMenuOpen && (
              <>
                <div 
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 998
                  }}
                />
                
                <div style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 0.5rem)',
                  left: 0,
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '0.75rem',
                  padding: '0.5rem',
                  boxShadow: 'var(--shadow-lg)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  zIndex: 999,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem'
                }}>
                  {tabs.map(tab => {
                    const active = activeTab === tab.id;
                    const TabIcon = tab.icon;
                    const badgeCount = getBadgeCount(tab.id);
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id);
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          padding: '0.65rem 0.85rem',
                          borderRadius: '0.5rem',
                          border: 'none',
                          background: active ? 'var(--primary-glow)' : 'transparent',
                          color: active ? 'var(--primary)' : 'var(--text-main)',
                          fontWeight: active ? '700' : '500',
                          fontSize: '0.85rem',
                          textAlign: 'left',
                          cursor: 'pointer',
                          outline: 'none',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <TabIcon size={16} style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }} />
                          <span>{tab.label}</span>
                        </div>
                        {badgeCount > 0 && (
                          <span style={{
                            background: tab.id === 'tickets' ? '#8b5cf6' : '#ef4444',
                            color: 'white',
                            borderRadius: '9999px',
                            fontSize: '0.6rem',
                            fontWeight: '800',
                            padding: '0.1rem 0.35rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {badgeCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;


