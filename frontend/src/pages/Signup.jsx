import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, CheckCircle, RefreshCw } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import * as auth from '../services/auth';
import useFormPersist from '../hooks/useFormPersist';
import logo from '../assets/logo.svg';

const SIGNUP_STEP_KEY = 'dfcci_signup_step';
const SIGNUP_EMAIL_KEY = 'dfcci_signup_pending_email';
const SIGNUP_EXPIRY_KEY = 'dfcci_signup_expiry';
const SIGNUP_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Returns true if the saved pending-signup state is still within the TTL */
const isPendingSignupValid = () => {
  const expiry = localStorage.getItem(SIGNUP_EXPIRY_KEY);
  return expiry && Date.now() < parseInt(expiry, 10);
};

const clearPendingSignup = () => {
  localStorage.removeItem(SIGNUP_STEP_KEY);
  localStorage.removeItem(SIGNUP_EMAIL_KEY);
  localStorage.removeItem(SIGNUP_EXPIRY_KEY);
};

const Signup = () => {
  // Restore step from localStorage (survives mobile tab kills, expires after 30 min)
  const [step, setStep] = useState(() => {
    if (isPendingSignupValid()) {
      const savedStep = localStorage.getItem(SIGNUP_STEP_KEY);
      return savedStep ? parseInt(savedStep, 10) : 1;
    }
    return 1;
  });
  const [formData, setFormData, clearSavedForm] = useFormPersist('signup_draft', { displayName: '', email: '', password: '' }, ['password']);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [confirmedName, setConfirmedName] = useState('');
  const [showEmailSignup, setShowEmailSignup] = useState(false);
  const { signup, verifyOtp, googleAuth } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // If returning to step 2 (refresh or Login redirect), restore the pending email
  useEffect(() => {
    if (step === 2 && isPendingSignupValid()) {
      const pendingEmail = localStorage.getItem(SIGNUP_EMAIL_KEY);
      if (pendingEmail) {
        setFormData(prev => ({ ...prev, email: pendingEmail }));
      }
    }
  }, [step, setFormData]);

  // Keep localStorage in sync with current step and refresh the expiry
  useEffect(() => {
    if (step === 2) {
      localStorage.setItem(SIGNUP_STEP_KEY, String(step));
      localStorage.setItem(SIGNUP_EXPIRY_KEY, String(Date.now() + SIGNUP_TTL_MS));
    }
  }, [step]);

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = await signup(formData);
      setMsg(res.data.message);
      // Persist to localStorage so the state survives mobile tab kills
      localStorage.setItem(SIGNUP_STEP_KEY, '2');
      localStorage.setItem(SIGNUP_EMAIL_KEY, formData.email);
      localStorage.setItem(SIGNUP_EXPIRY_KEY, String(Date.now() + SIGNUP_TTL_MS));
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = await googleAuth(credentialResponse.credential);
      if (res.requireNameConfirmation) {
        setGoogleCredential(res.credential);
        setConfirmedName(res.googleName);
        setStep(3);
      } else {
        clearSavedForm();
        clearPendingSignup();
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConfirmSubmit = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      await googleAuth(googleCredential, confirmedName);
      clearSavedForm();
      clearPendingSignup();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Google signup failed');
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
      clearPendingSignup();
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
      const data = await auth.resendOtp(formData.email);
      setMsg(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
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
            {step === 1 && t('join_community')}
            {step === 2 && t('check_email')}
            {step === 3 && t('google_name_confirm_title')}
          </h2>

          {error && <div className="ff-alert ff-alert-error">{error}</div>}
          {msg   && <div className="ff-alert ff-alert-success">{msg}</div>}

          {step === 1 ? (
            <div>
              <div className="auth-google-wrapper">
                <GoogleLogin
                  text="signup_with"
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google signup failed')}
                  locale="en_US"
                />
              </div>

              {!showEmailSignup ? (
                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEmailSignup(true)}
                    className="auth-email-toggle"
                  >
                    {t('continue_with_email')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="ff-divider" style={{ marginBottom: '1.5rem' }}>or</div>

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
                  </form>
                </>
              )}

              <div className="auth-footer-row">
                {t('already_member')}{' '}
                <Link to="/login">{t('login_here')}</Link>
              </div>
            </div>
          ) : step === 2 ? (
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
          ) : step === 3 ? (
            <form onSubmit={handleGoogleConfirmSubmit}>
              <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                {t('google_name_confirm_desc')}
              </p>

              <div className="ff-field">
                <input
                  id="confirm-name"
                  type="text"
                  className="ff-input"
                  placeholder={t('display_name')}
                  value={confirmedName}
                  onChange={(e) => setConfirmedName(e.target.value)}
                  required
                  autoComplete="name"
                />
                <label htmlFor="confirm-name">{t('display_name')}</label>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                disabled={loading}
                id="confirm-name-submit"
              >
                {loading ? (
                  <><span className="ff-btn-spinner" /> {t('creating_account')}</>
                ) : (
                  <><UserPlus size={18} /> {t('confirm_name_btn')}</>
                )}
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Signup;
