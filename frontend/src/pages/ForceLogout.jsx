import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * ForceLogout — Clears all auth data from localStorage and redirects to /login.
 * Useful when a device shows a blank screen due to a deleted/invalid account.
 * Access via: /force-logout
 */
const ForceLogout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Wipe all auth-related keys
    localStorage.removeItem('dfcci_token');
    localStorage.removeItem('dfcci_user_cache');
    localStorage.removeItem('dfcci_signup_step');
    localStorage.removeItem('dfcci_signup_pending_email');
    localStorage.removeItem('dfcci_signup_expiry');
    localStorage.removeItem('dfcci_fp_step');
    localStorage.removeItem('dfcci_fp_email');
    localStorage.removeItem('dfcci_fp_expiry');

    // Also clear the httpOnly cookie via the backend logout endpoint
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
      .catch(() => {}) // Ignore errors — we're wiping locally regardless
      .finally(() => {
        navigate('/login', { replace: true });
      });
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      flexDirection: 'column',
      gap: '12px',
      color: 'var(--text-secondary, #aaa)',
      fontSize: '14px'
    }}>
      <div style={{ fontSize: '24px' }}>🔄</div>
      <p>Clearing session…</p>
    </div>
  );
};

export default ForceLogout;
