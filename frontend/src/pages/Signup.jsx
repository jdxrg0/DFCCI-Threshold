import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, CheckCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import api from '../api';
import useFormPersist from '../hooks/useFormPersist';
import logo from '../assets/logo.svg';

const SIGNUP_STEP_KEY = 'dfcci_signup_step';
const SIGNUP_EMAIL_KEY = 'dfcci_signup_pending_email';

const Signup = () => {
  // Restore step from sessionStorage so a mobile refresh doesn't lose progress
  const [step, setStep] = useState(() => {
    const savedStep = sessionStorage.getItem(SIGNUP_STEP_KEY);
    return savedStep ? parseInt(savedStep, 10) : 1;
  });
  const [formData, setFormData, clearSavedForm] = useFormPersist('signup_draft', { displayName: '', email: '', password: '' }, ['password']);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, verifyOtp } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // If returning to step 2 from a refresh, restore the pending email into formData
  useEffect(() => {
    if (step === 2) {
      const pendingEmail = sessionStorage.getItem(SIGNUP_EMAIL_KEY);
      if (pendingEmail && !formData.email) {
        setFormData(prev => ({ ...prev, email: pendingEmail }));
      }
    }
  }, []);

  // Keep sessionStorage in sync with current step
  useEffect(() => {
    sessionStorage.setItem(SIGNUP_STEP_KEY, String(step));
  }, [step]);

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = await signup(formData);
      setMsg(res.data.message);
      // Persist the pending email so we can restore it after a mobile refresh
      sessionStorage.setItem(SIGNUP_EMAIL_KEY, formData.email);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = await verifyOtp(formData.email, otp);
      setMsg(res.data.message);
      // Clear all persisted signup state after successful verification
      clearSavedForm();
      sessionStorage.removeItem(SIGNUP_STEP_KEY);
      sessionStorage.removeItem(SIGNUP_EMAIL_KEY);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError(''); setMsg('');
    try {
      const res = await api.post('/auth/resend-otp', { email: formData.email });
      setMsg(res.data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div className="container" style={{ maxWidth: '420px', marginTop: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src={logo} alt="DFCCI Logo" style={{ height: '60px', marginBottom: '0.5rem' }} />
        <h1 className="text-gradient text-hero" style={{ fontSize: '2.5rem', margin: 0 }}>
          DFCCI Threshold
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
          Truth, held gently.
        </p>
      </div>
      <div className="fun-card">
        {/* Step dots */}
        <div className="ff-steps">
          <div className={`ff-step-dot ${step === 1 ? 'active' : ''}`} />
          <div className={`ff-step-dot ${step === 2 ? 'active' : ''}`} />
        </div>

        <h2 className="fun-title">
          {step === 1 ? t('join_community') : t('check_email')}
        </h2>

        {error && <div className="ff-alert ff-alert-error">{error}</div>}
        {msg   && <div className="ff-alert ff-alert-success">{msg}</div>}

        {step === 1 ? (
          <form onSubmit={handleSignupSubmit}>
            <div className="ff-field">
              <input
                id="signup-name"
                type="text"
                className="ff-input"
                placeholder={t('display_name')}
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                required
                autoComplete="name"
              />
              <label htmlFor="signup-name">{t('display_name')}</label>
            </div>

            <div className="ff-field">
              <input
                id="signup-email"
                type="email"
                className="ff-input"
                placeholder={t('email')}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                autoComplete="email"
              />
              <label htmlFor="signup-email">{t('email')}</label>
            </div>

            <div className="ff-field">
              <input
                id="signup-password"
                type="password"
                className="ff-input"
                placeholder={t('password')}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                autoComplete="new-password"
              />
              <label htmlFor="signup-password">{t('password')}</label>
            </div>

            <button
              type="submit"
              className="ff-btn ff-btn-primary"
              disabled={loading}
              id="signup-submit"
            >
              {loading ? (
                <><span className="ff-btn-spinner" /> {t('creating_account')}</>
              ) : (
                <><UserPlus size={18} /> {t('create_account')}</>
              )}
            </button>

            <div className="ff-divider" style={{ marginTop: '1.25rem' }}>{t('already_member')}</div>
            <p className="text-center" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
              <Link to="/login" style={{ fontWeight: 600 }}>{t('login_here')}</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              {t('otp_sent')} <strong>{formData.email}</strong>
            </p>

            <div className="ff-field">
              <input
                id="signup-otp"
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
              <label htmlFor="signup-otp">{t('verification_code')}</label>
            </div>

            <button
              type="submit"
              className="ff-btn ff-btn-primary"
              disabled={loading}
              id="otp-submit"
              style={{ marginBottom: '0.75rem' }}
            >
              {loading ? (
                <><span className="ff-btn-spinner" /> {t('verifying')}</>
              ) : (
                <><CheckCircle size={18} /> {t('verify_email')}</>
              )}
            </button>

            <button
              type="button"
              onClick={handleResendOtp}
              className="ff-btn ff-btn-secondary"
              id="otp-resend"
            >
              <RefreshCw size={16} /> {t('resend_code')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default Signup;
