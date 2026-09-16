import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { Shield, Users, LogOut, LogIn, UserPlus, Menu, X, ScanLine, Sun, Wallet, BookHeart, ChevronRight, Settings } from 'lucide-react';
import ThemePanel, { ThemePanelContent } from './ThemePanel';
import logo from '../assets/logo.webp';
import { renderAvatarHelper } from '../utils/avatarHelper';

// â”€â”€ Module map: route prefix â†’ { icon, dashboardPath, label } â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Add a new entry here whenever a new module is introduced to the platform.
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

// â”€â”€ Mobile hamburger theme section (expandable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const MobileThemeSection = ({ onClose }) => {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ width: '100%', paddingTop: '0.25rem' }}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="btn btn-secondary"
        style={{ width: '100%', justifyContent: 'space-between', padding: '0.6rem 1rem', borderRadius: '0.75rem' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600' }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
          {t('theme_colors')}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      {expanded && (
        <div className="theme-panel-inline" style={{ marginTop: '0.5rem' }}>
          <ThemePanelContent onThemeChange={onClose} />
        </div>
      )}
    </div>
  );
};

const renderAvatar = (user, size = 32) => renderAvatarHelper(user, size);

const Navbar = () => {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Detect which module (if any) the user is currently inside
  const activeModule = MODULE_MAP.find(m => location.pathname.startsWith(m.prefix)) || null;

  // Persist the last known module through neutral routes (e.g. /notifications)
  const lastModuleRef = useRef(null);
  useEffect(() => {
    if (activeModule) lastModuleRef.current = activeModule;
  }, [activeModule]);

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Link 
                to={user ? '/dashboard' : '/login'} 
                className="navbar-title"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                DFCCI Threshold
              </Link>
              <span className="badge" style={{ fontSize: '0.62rem', padding: '0.12rem 0.35rem', borderRadius: '9999px', backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', fontWeight: '800', lineHeight: '1', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.02em', display: 'inline-flex', alignItems: 'center' }}>
                v3
              </span>
            </div>
            <span className="navbar-tagline">
              Truth, held gently.
            </span>
          </div>
        </div>

        {/* â”€â”€ Desktop navigation â”€â”€ */}
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

          {/* Theme panel (palette icon â€” floating) */}
          <ThemePanel />
        </div>

        {/* â”€â”€ Mobile header row (icons + hamburger) â”€â”€ */}
        <div className="mobile-header-row">


          {/* Hamburger */}
          <button
            className="mobile-menu-btn"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* â”€â”€ Mobile slide-out menu â”€â”€ */}
        {isMobileMenuOpen && createPortal(
          <div className="mobile-nav-menu">
            {user ? (
              <>
                {/* Profile Glass Card */}
                <Link 
                  to="/settings" 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mobile-menu-profile-card"
                >
                  <div className="mobile-menu-avatar-glow">
                    {renderAvatar(user, 48)}
                  </div>
                  <div className="mobile-menu-profile-info">
                    <span className="mobile-menu-profile-greeting">{t('hello')}</span>
                    <span className="mobile-menu-profile-name">{user.displayName || user.email}</span>
                  </div>
                  <div className="mobile-menu-profile-settings-btn">
                    <Settings size={18} />
                  </div>
                </Link>

                {/* Refined Navigation list */}
                <div className="mobile-menu-list">
                  {user.role === 'ADMIN' && (
                    <Link to="/admin" onClick={() => setIsMobileMenuOpen(false)} className="mobile-menu-item">
                      <Shield size={18} />
                      <span>{t('admin')}</span>
                      <ChevronRight size={16} className="mobile-menu-chevron" />
                    </Link>
                  )}
                  {['ADMIN', 'COUNSELOR'].includes(user.role) && (
                    <Link to="/counselor" onClick={() => setIsMobileMenuOpen(false)} className="mobile-menu-item">
                      <Users size={18} />
                      <span>{t('counselor')}</span>
                      <ChevronRight size={16} className="mobile-menu-chevron" />
                    </Link>
                  )}

                  <button 
                    onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} 
                    className="mobile-menu-item" 
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <LogOut size={18} />
                    <span>{t('logout')}</span>
                    <ChevronRight size={16} className="mobile-menu-chevron" />
                  </button>
                </div>
              </>
            ) : (
              <div className="mobile-menu-list">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="mobile-menu-item">
                  <LogIn size={18} />
                  <span>{t('login')}</span>
                  <ChevronRight size={16} className="mobile-menu-chevron" />
                </Link>
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="mobile-menu-item">
                  <UserPlus size={18} style={{ color: 'var(--primary)' }} />
                  <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{t('sign_up')}</span>
                  <ChevronRight size={16} className="mobile-menu-chevron" style={{ color: 'var(--primary)', opacity: 0.8 }} />
                </Link>
              </div>
            )}

            {/* Settings Card Footer */}
            <div className="mobile-menu-settings-card">
              <div>
                <span className="mobile-menu-section-title">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="0.5"/><circle cx="17.5" cy="10.5" r="0.5"/><circle cx="8.5" cy="7.5" r="0.5"/><circle cx="6.5" cy="12.5" r="0.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
                  {t('theme_colors')}
                </span>
                <MobileThemeSection onClose={() => setIsMobileMenuOpen(false)} />
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>
    </header>
  );
};

export default Navbar;
