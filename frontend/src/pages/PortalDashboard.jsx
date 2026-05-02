import React from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Compass, BookOpen, Wrench, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const PortalDashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="container" style={{ maxWidth: '1000px', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: 'bold' }}>
          {t('welcome_back_name')} <span style={{ color: 'var(--primary)' }}>{user?.displayName || user?.email || 'User'}</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>
          {t('select_module')}
        </p>
      </div>

      <div className="dashboard-modules-grid">
        
        {/* Gentle Mirror Module */}
        <div style={{ textDecoration: 'none' }}>
          <div className="card module-card">
            <div className="module-card-header">
              <div className="module-card-icon" style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)' }}>
                <MessageCircle className="module-card-icon-svg" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="module-card-title">Gentle Mirror</h2>
            </div>
              <p className="module-card-desc" style={{ marginBottom: '1rem' }}>
                {t('gentle_mirror_desc')}
              </p>
            <div className="module-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <Link to="/docs/gentle-mirror" className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <BookOpen size={16} /> <span className="hide-text-mobile">{t('read_docs')}</span>
                </Link>
                <Link to="/mirror/dashboard" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Compass size={16} /> <span className="hide-text-mobile">{t('open_module')}</span>
                </Link>
            </div>
          </div>
        </div>

        {/* Shining Light Module */}
        <div style={{ textDecoration: 'none' }}>
          <div className="card module-card">
            <div className="module-card-header">
              <div className="module-card-icon" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
                <Sun className="module-card-icon-svg" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="module-card-title">{t('shining_light')}</h2>
            </div>
              <p className="module-card-desc" style={{ marginBottom: '1rem' }}>
                {t('shining_light_desc')}
              </p>
            <div className="module-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <Link to="/docs/shining-light" className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <BookOpen size={16} /> <span className="hide-text-mobile">{t('sl_read_docs')}</span>
                </Link>
                <Link to="/affirm/dashboard" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Sun size={16} /> <span className="hide-text-mobile">{t('sl_open_module')}</span>
                </Link>
            </div>
          </div>
        </div>

        {/* System Requests Module */}
        <div style={{ textDecoration: 'none' }}>
          <div className="card module-card">
            <div className="module-card-header">
              <div className="module-card-icon" style={{ backgroundColor: 'rgba(var(--primary-rgb, 2, 132, 199), 0.15)' }}>
                <Wrench className="module-card-icon-svg" style={{ color: 'var(--primary)' }} />
              </div>
              <h2 className="module-card-title">{t('system_requests')}</h2>
            </div>
              <p className="module-card-desc" style={{ marginBottom: '1rem' }}>
                {t('system_requests_desc')}
              </p>
            <div className="module-card-actions" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <Link to="/docs/system-requests" className="btn btn-secondary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <BookOpen size={16} /> <span className="hide-text-mobile">{t('read_docs')}</span>
                </Link>
                <Link to="/tickets/dashboard" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.9rem', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Wrench size={16} /> <span className="hide-text-mobile">{t('open_module')}</span>
                </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default PortalDashboard;
