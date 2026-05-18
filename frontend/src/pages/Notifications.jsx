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
    <div className="container" style={{ maxWidth: '600px' }}>
      <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/dashboard')} className="back-btn">
        <ChevronLeft size={18} /> {t('back')}
      </button>

      <div className="fun-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="fun-title" style={{ marginBottom: 0, textAlign: 'left' }}>{t('notifications_title')}</h2>
          {notifications.some(n => !n.read) && (
            <button onClick={handleMarkAllRead} className="btn btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
              {t('mark_all_read')}
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-center" style={{ color: 'var(--text-muted)' }}>{t('loading')}</p>
        ) : notifications.length === 0 ? (
          <div className="text-center" style={{ padding: '1.5rem 0', color: 'var(--text-muted)' }}>
            <Bell size={48} style={{ opacity: 0.2, marginBottom: '1rem', display: 'block', margin: '0 auto 1rem auto' }} />
            <p>{t('no_notifications')}</p>
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
                    {n.read ? <CheckCircle size={20} /> : <Bell size={20} />}
                  </div>
                  <div className="notification-content">
                    <p className="notification-message">
                      {n.message}
                    </p>
                    {n.createdAt && (
                      <small className="notification-time">
                        {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </small>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
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
