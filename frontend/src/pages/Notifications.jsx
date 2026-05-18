import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, ChevronLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import api from '../api';

const Notifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const notificationsPerPage = 5;
  const indexOfLastNotif = currentPage * notificationsPerPage;
  const indexOfFirstNotif = indexOfLastNotif - notificationsPerPage;
  const currentNotifications = notifications.slice(indexOfFirstNotif, indexOfLastNotif);
  const totalPages = Math.ceil(notifications.length / notificationsPerPage) || 1;

  useEffect(() => {
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 15000);
    return () => clearInterval(intervalId);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      fetchNotifications();
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await api.put(`/notifications/${notif._id}/read`);
    }
    if (notif.thread) {
      if (notif.type && notif.type.includes('Affirmation')) {
        navigate(`/affirm/${notif.thread._id || notif.thread}`);
      } else {
        navigate(`/mirror/thread/${notif.thread._id || notif.thread}`);
      }
    } else if (notif.type === 'DevotionalStreakReminder') {
      navigate('/devotionals/submit');
    } else {
      fetchNotifications();
    }
  };

  return (
    <div className="container" style={{ maxWidth: '650px', padding: '1rem' }}>
      <div className="btn-back-wrapper">
        <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/dashboard')} className="btn-back-pill">
          <ChevronLeft size={16} /> {t('back')}
        </button>
      </div>

      <div className="notification-container-glass">
        <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{t('notifications_title')}</h2>
          {notifications.some(n => !n.read) && (
            <button onClick={handleMarkAllRead} className="btn btn-secondary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderRadius: '9999px' }}>
              {t('mark_all_read')}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center" style={{ color: 'var(--text-muted)', padding: '2rem 0' }}>{t('loading')}</p>
        ) : notifications.length === 0 ? (
          <div className="text-center" style={{ padding: '3rem 0', color: 'var(--text-muted)' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Bell size={40} style={{ color: 'var(--primary)', opacity: 0.8 }} />
            </div>
            <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>{t('no_notifications')}</p>
            <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '0.5rem' }}>You're all caught up!</p>
          </div>
        ) : (
          <>
            <div className="notification-list">
              {currentNotifications.map(n => (
                <div 
                  key={n._id}
                  className={`notification-item ${n.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notification-icon">
                    {n.read ? <CheckCircle size={22} /> : <Bell size={22} />}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">
                      {n.message}
                    </p>
                    {n.createdAt && (
                      <small className="notification-time">
                        {new Date(n.createdAt).toLocaleDateString()} at {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center" style={{ marginTop: '2rem' }}>
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', borderRadius: '9999px' }}
                >
                  Previous
                </button>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {t('page_of')(currentPage, totalPages)}
                </span>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', borderRadius: '9999px' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Notifications;
