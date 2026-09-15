import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, RefreshCw, ArrowLeft } from 'lucide-react';
import * as auth from '../services/auth';
import { useLanguage } from '../context/LanguageContext';
import logo from '../assets/logo.svg';

const FP_STEP_KEY = 'dfcci_fp_step';
const FP_EMAIL_KEY = 'dfcci_fp_pending_email';
const FP_EXPIRY_KEY = 'dfcci_fp_expiry';
const FP_TTL_MS = 30 * 60 * 1000; // 30 minutes

const isFPValid = () => {
  const expiry = localStorage.getItem(FP_EXPIRY_KEY);
  return expiry && Date.now() < parseInt(expiry, 10);
};

const clearPendingFP = () => {
  localStorage.removeItem(FP_STEP_KEY);
  localStorage.removeItem(FP_EMAIL_KEY);
  localStorage.removeItem(FP_EXPIRY_KEY);
};

const ForgotPassword = () => {
  // Restore step from localStorage (survives mobile tab kills, expires after 30 min)
  const [step, setStep] = useState(() => {
    if (isFPValid()) {
      const savedStep = localStorage.getItem(FP_STEP_KEY);
      return savedStep ? parseInt(savedStep, 10) : 1;
    }
    return 1;
  });
  // Restore email from localStorage
  const [email, setEmail] = useState(() => (isFPValid() ? localStorage.getItem(FP_EMAIL_KEY) || '' : ''));
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Keep localStorage in sync with current step and email, refreshing the expiry
  useEffect(() => {
    if (step === 2) {
      localStorage.setItem(FP_STEP_KEY, String(step));
      localStorage.setItem(FP_EXPIRY_KEY, String(Date.now() + FP_TTL_MS));
    }
  }, [step]);

  useEffect(() => {
    if (email && step === 2) {
      localStorage.setItem(FP_EMAIL_KEY, email);
      localStorage.setItem(FP_EXPIRY_KEY, String(Date.now() + FP_TTL_MS));
    }
  }, [email, step]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const data = await auth.forgotPassword(email);
      setMsg(data.message);
      // Persist to localStorage so the state survives mobile tab kills
      localStorage.setItem(FP_STEP_KEY, '2');
      localStorage.setItem(FP_EMAIL_KEY, email);
      localStorage.setItem(FP_EXPIRY_KEY, String(Date.now() + FP_TTL_MS));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(''); setMsg(''); setLoading(true);
    try {
      await auth.forgotPassword(email);
      setMsg('A new reset code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      const data = await auth.resetPassword(email, otp, newPassword);
      setMsg(data.message);
      // Clear all persisted reset state after successful password change
      clearPendingFP();
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand */}
        <div className="auth-logo-section">
          <div className="auth-logo-ring">
            <img src={logo} alt="DFCCI Logo" />
          </div>
          <div className="auth-brand-stack">
            <span className="auth-brand-label">DFCCI</span>
            <h1 className="auth-brand-hero">Threshold</h1>
          </div>
          <div className="auth-brand-divider" />
          <p className="auth-tagline">Truth, held gently.</p>
        </div>

        {/* Glass Card */}
        <div className="auth-glass-card">
          {/* Step dots */}
          <div className="ff-steps">
            <div className={`ff-step-dot ${step === 1 ? 'active' : ''}`} />
            <div className={`ff-step-dot ${step === 2 ? 'active' : ''}`} />
          </div>

          <h2 className="fun-title">
            {step === 1 ? t('forgot_password_title') : t('reset_password_title')}
          </h2>

          {error && <div className="ff-alert ff-alert-error">{error}</div>}
          {msg && <div className="ff-alert ff-alert-success">{msg}</div>}

          {step === 1 ? (
            <form onSubmit={handleRequestReset}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                {t('forgot_desc')}
              </p>
              <div className="ff-field">
                <input
                  id="forgot-email"
                  type="email"
                  className="ff-input"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label htmlFor="forgot-email">{t('email')}</label>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                disabled={loading}
                id="forgot-submit"
              >
                {loading ? (
                  <><span className="ff-btn-spinner" /> {t('sending')}</>
                ) : (
                  <><Mail size={18} /> {t('send_reset_code')}</>
                )}
              </button>

              <div className="auth-footer-row">
                <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                  <ArrowLeft size={14} /> {t('back_to_login')}
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center' }}>
                {t('reset_code_sent')} <strong>{email}</strong> {t('reset_code_sent2')}
              </p>

              <div className="ff-field">
                <input
                  id="reset-otp"
                  type="text"
                  className="ff-input ff-otp"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <label htmlFor="reset-otp">{t('reset_code')}</label>
              </div>

              <div className="ff-field">
                <input
                  id="reset-password"
                  type="password"
                  className="ff-input"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <label htmlFor="reset-password">{t('new_password')}</label>
              </div>

              <div className="ff-field">
                <input
                  id="reset-confirm-password"
                  type="password"
                  className="ff-input"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <label htmlFor="reset-confirm-password">{t('confirm_password')}</label>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                disabled={loading}
                id="reset-submit"
                style={{ marginBottom: '0.75rem' }}
              >
                {loading ? (
                  <><span className="ff-btn-spinner" /> {t('resetting')}</>
                ) : (
                  <><KeyRound size={18} /> {t('reset_password_btn')}</>
                )}
              </button>

              <button
                type="button"
                onClick={handleResend}
                className="ff-btn ff-btn-secondary"
                id="reset-resend"
                disabled={loading}
              >
                <RefreshCw size={16} /> {t('resend_code')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
