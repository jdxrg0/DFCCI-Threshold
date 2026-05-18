import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Bell, LayoutDashboard, Shield, Users, LogOut, LogIn, UserPlus, Menu, X, ScanLine, BookOpen, Sun, Wallet, BookHeart } from 'lucide-react';
import ThemePanel, { ThemePanelContent } from './ThemePanel';
import LanguageSwitcher from './LanguageSwitcher';
import api from '../api';
import logo from '../assets/logo.svg';
import { renderAvatarHelper } from '../utils/avatarHelper';

// ── Module map: route prefix → { icon, dashboardPath, label } ──────────────
// Add a new entry here whenever a new module is introduced to the platform.
// Routes that should NOT clear the active module context (utility/overlay pages)
const NEUTRAL_ROUTES = ['/notifications'];

const MODULE_MAP = [
  {
    prefix: '/mirror',
    dashboardPath: '/mirror/dashboard',
    docsPath: '/docs/gentle-mirror',
    label: 'Gentle Mirror',
    Icon: ScanLine,
  },
  {
    prefix: '/affirm',
    dashboardPath: '/affirm/dashboard',
    docsPath: '/docs/shining-light',
    label: 'Shining Light',
    Icon: Sun,
  },
  {
    prefix: '/funds',
    dashboardPath: '/funds',
    docsPath: '/docs/fund-tracker',
    label: 'Fund Tracker',
    Icon: Wallet,
  },
  {
    prefix: '/devotionals',
    dashboardPath: '/devotionals',
    docsPath: '/docs/devotional-tracker',
    label: 'Devotional Tracker',
    Icon: BookHeart,
  },
];

// ── Mobile language section ────────────────────────────────────────────────
const MobileLanguageSection = () => {
  const { t } = useLanguage();
  return (
    <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
      <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>{t('language')}</p>
      <LanguageSwitcher />
    </div>
  );
};

// ── Mobile hamburger theme section (expandable) ───────────────────────────
const MobileThemeSection = ({ onClose }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: 'auto' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          {t('theme_colors')}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expanded && (
        <div className="theme-panel-inline">
          <ThemePanelContent onThemeChange={onClose} />
        </div>
      )}
    </div>
  );
};

const renderAvatar = (user, size = 32) => renderAvatarHelper(user, size);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Detect which module (if any) the user is currently inside
  const activeModule = MODULE_MAP.find(m => location.pathname.startsWith(m.prefix)) || null;

  // Persist the last known module through neutral routes (e.g. /notifications)
  const lastModuleRef = useRef(null);
  if (activeModule) lastModuleRef.current = activeModule;
  const displayedModule = activeModule || (NEUTRAL_ROUTES.includes(location.pathname) ? lastModuleRef.current : null);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const intervalId = setInterval(fetchNotifications, 15000);
      return () => clearInterval(intervalId);
    }
  }, [user, location.pathname]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data);
    } catch (err) {
      console.error('Failed to fetch notifications');
    }
  };

  const handleNotificationToggle = (e) => {
    e.preventDefault();
    // If the hamburger is open, just close it — the user likely wants to
    // see the notifications page that's already behind the menu overlay.
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
      // If not already on notifications, navigate there too
      if (location.pathname !== '/notifications') {
        navigate('/notifications');
      }
      return;
    }
    // Normal toggle: go to notifications, or go back if already there
    if (location.pathname === '/notifications') {
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate('/dashboard');
      }
    } else {
      navigate('/notifications');
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };



  return (
    <header className="glass-nav navbar-header">
      <div className="container flex justify-between items-center">

        {/* Brand */}
        <div className="navbar-brand">
          <Link to={user ? '/dashboard' : '/login'} onClick={() => setIsMobileMenuOpen(false)} style={{ display: 'flex', alignItems: 'center' }}>
            <img src={logo} alt="DFCCI Logo" className="navbar-logo" />
          </Link>
          <div className="navbar-title-container">
            <Link 
              to={user ? '/dashboard' : '/login'} 
              className="navbar-title"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              DFCCI Threshold
            </Link>
            <span className="navbar-tagline">
              Truth, held gently.
            </span>
          </div>
        </div>

        {/* ── Desktop navigation ── */}
        <div className="desktop-nav">
          {user ? (
            <>
              <Link 
                to="/settings" 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem', 
                  textDecoration: 'none',
                  marginRight: '0.75rem',
                  padding: '0.25rem',
                  borderRadius: 'var(--radius)',
                  transition: 'background-color 0.2s'
                }}
                className="nav-profile-link"
                title={t('profile_settings')}
              >
                {renderAvatar(user, 36)}
                <span style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                  {t('hello')}, <span style={{ color: 'var(--primary)' }} className="nav-profile-name">{user.displayName || user.email}</span>
                </span>
              </Link>

              {user.role === 'ADMIN' && (
                <Link to="/admin" className="btn btn-secondary" style={{ padding: '0.5rem', position: 'relative' }} title={t('admin')}>
                  <Shield size={20} color={location.pathname === '/admin' ? 'var(--primary)' : 'var(--text-main)'} style={{ transition: 'color 0.2s' }} />
                  {location.pathname === '/admin' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '3px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }} />
                  )}
                </Link>
              )}
              {['ADMIN', 'COUNSELOR'].includes(user.role) && (
                <Link to="/counselor" className="btn btn-secondary" style={{ padding: '0.5rem', position: 'relative' }} title={t('counselor')}>
                  <Users size={20} color={location.pathname === '/counselor' ? 'var(--primary)' : 'var(--text-main)'} style={{ transition: 'color 0.2s' }} />
                  {location.pathname === '/counselor' && (
                    <span style={{
                      position: 'absolute',
                      bottom: '3px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '4px',
                      height: '4px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary)',
                    }} />
                  )}
                </Link>
              )}
              <Link to="/funds" className="btn btn-secondary" style={{ padding: '0.5rem', position: 'relative' }} title={t('fund_tracker')}>
                <Wallet size={20} color={location.pathname === '/funds' ? 'var(--primary)' : 'var(--text-main)'} style={{ transition: 'color 0.2s' }} />
                {location.pathname === '/funds' && (
                  <span style={{
                    position: 'absolute',
                    bottom: '3px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                  }} />
                )}
              </Link>

              {/* Notification bell */}
              <button
                onClick={handleNotificationToggle}
                className="btn btn-secondary"
                style={{ padding: '0.5rem', position: 'relative' }}
                title="Notifications"
              >
                <Bell size={20} color={location.pathname === '/notifications' ? 'var(--primary)' : 'var(--text-main)'} style={{ transition: 'color 0.2s' }} />
                {location.pathname === '/notifications' && (
                  <span style={{
                    position: 'absolute',
                    bottom: '3px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                  }} />
                )}
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '-5px', right: '-5px', backgroundColor: '#EF4444', color: 'white', fontSize: '0.65rem', padding: '2px 6px', borderRadius: 'var(--radius)' }}>
                    {unreadCount}
                  </span>
                )}
              </button>

              <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '0.5rem' }} title={t('logout')}>
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '0.5rem' }} title={t('login')}>
                <LogIn size={20} />
              </Link>
              <Link to="/signup" className="btn btn-primary" style={{ padding: '0.5rem' }} title={t('sign_up')}>
                <UserPlus size={20} />
              </Link>
            </>
          )}

          {/* Language switcher — desktop */}
          <LanguageSwitcher compact />

          {/* Theme panel (palette icon — floating) */}
          <ThemePanel />
        </div>

        {/* ── Mobile header row (icons + hamburger) ── */}
        <div className="mobile-header-row">
          {user && (
            <>
              {/* Notification bell */}
              <button
                onClick={handleNotificationToggle}
                className="mobile-only-notification-btn btn btn-secondary"
                aria-label="Notifications"
                style={{ position: 'relative', padding: '0.5rem', background: 'transparent', border: 'none', boxShadow: 'none' }}
              >
                <Bell size={24} color={(location.pathname === '/notifications' && !isMobileMenuOpen) ? 'var(--primary)' : 'var(--text-main)'} style={{ transition: 'color 0.2s' }} />
                {(location.pathname === '/notifications' && !isMobileMenuOpen) && (
                  <span style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--primary)',
                  }} />
                )}
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: '#EF4444', color: 'white', fontSize: '0.65rem', padding: '2px 5px', borderRadius: '50%' }}>
                    {unreadCount}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* ── Mobile slide-out menu ── */}
        {isMobileMenuOpen && createPortal(
          <div className="mobile-nav-menu">
            {user ? (
              <>
                <Link 
                  to="/settings" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    gap: '0.5rem', 
                    textDecoration: 'none',
                    padding: '1rem',
                    borderBottom: '1px solid var(--border-color)',
                    width: '100%',
                    marginBottom: '0.5rem'
                  }}
                >
                  {renderAvatar(user, 64)}
                  <span style={{ fontWeight: '500', color: 'var(--text-main)', fontSize: '1.05rem', marginTop: '0.25rem' }}>
                    {t('hello')}, <span style={{ color: 'var(--primary)' }}>{user.displayName || user.email}</span>
                  </span>
                </Link>

                {location.pathname !== '/dashboard' && (
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-secondary">
                    <LayoutDashboard size={20} /> {t('main_dashboard')}
                  </Link>
                )}
  
                {displayedModule?.docsPath && (
                  <Link 
                    to={`${displayedModule.docsPath}${location.pathname === '/mirror/send' ? '#templates' : ''}`}
                    onClick={() => setIsMobileMenuOpen(false)} 
                    className="btn btn-primary"
                  >
                    <BookOpen size={20} /> Documentation
                  </Link>
                )}
                {user.role === 'ADMIN' && (
                  <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-secondary">
                    <Shield size={20} /> {t('admin')}
                  </Link>
                )}
                {['ADMIN', 'COUNSELOR'].includes(user.role) && (
                  <Link to="/counselor" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-secondary">
                    <Users size={20} /> {t('counselor')}
                  </Link>
                )}
                <Link to="/funds" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-secondary">
                  <Wallet size={20} /> {t('fund_tracker')}
                </Link>

                <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="btn btn-secondary">
                  <LogOut size={20} /> {t('logout')}
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-secondary">
                  <LogIn size={20} /> {t('login')}
                </Link>
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="btn btn-primary">
                  <UserPlus size={20} /> {t('sign_up')}
                </Link>
              </>
            )}

            {/* Language switcher — inside hamburger */}
            <MobileLanguageSection />

            {/* Theme panel — inline inside hamburger */}
            <MobileThemeSection onClose={() => setIsMobileMenuOpen(false)} />
          </div>,
          document.body
        )}
      </div>
    </header>
  );
};

export default Navbar;
