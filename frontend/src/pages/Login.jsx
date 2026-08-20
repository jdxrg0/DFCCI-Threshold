import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import useFormPersist from '../hooks/useFormPersist';
import api from '../api';
import logo from '../assets/logo.svg';

const Login = () => {
  const [form, setForm, clearSavedForm] = useFormPersist('login_draft', { email: '', password: '' }, ['password']);
  const { email, password } = form;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requireNameConfirmation, setRequireNameConfirmation] = useState(false);
  const [googleCredential, setGoogleCredential] = useState('');
  const [confirmedName, setConfirmedName] = useState('');
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const { login, googleAuth } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      clearSavedForm();
      navigate('/dashboard');
    } catch (err) {
      // If the account exists but email is unverified, redirect to the OTP step
      if (err.response?.status === 403) {
        const expiry = String(Date.now() + 30 * 60 * 1000); // 30 min TTL
        localStorage.setItem('dfcci_signup_step', '2');
        localStorage.setItem('dfcci_signup_pending_email', email);
        localStorage.setItem('dfcci_signup_expiry', expiry);
        // Silently request a fresh OTP so the code in their inbox is valid
        try { await api.post('/auth/resend-otp', { email }); } catch (_) {}
        navigate('/signup');
        return;
      }
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    setLoading(true);
    try {
      const res = await googleAuth(credentialResponse.credential);
      if (res.requireNameConfirmation) {
        setGoogleCredential(res.credential);
        setConfirmedName(res.googleName);
        setRequireNameConfirmation(true);
      } else {
        clearSavedForm();
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Google login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleConfirmSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await googleAuth(googleCredential, confirmedName);
      clearSavedForm();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Google signup failed');
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
          <h2 className="fun-title">
            {requireNameConfirmation ? t('google_name_confirm_title') : t('welcome_back')}
          </h2>

          {error && <div className="ff-alert ff-alert-error">{error}</div>}

          {requireNameConfirmation ? (
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
                  <><LogIn size={18} /> {t('confirm_name_btn')}</>
                )}
              </button>
            </form>
          ) : (
            <>
              <div className="auth-google-wrapper">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError('Google login failed')}
                  locale="en_US"
                />
              </div>

              {!showEmailLogin ? (
                <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowEmailLogin(true)}
                    className="auth-email-toggle"
                  >
                    {t('continue_with_email')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="ff-divider" style={{ marginBottom: '1.5rem' }}>or</div>

                  <form onSubmit={handleSubmit}>
                    <div className="ff-field">
                      <input
                        id="login-email"
                        type="email"
                        className="ff-input"
                        placeholder={t('email')}
                        value={email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        required
                        autoComplete="email"
                      />
                      <label htmlFor="login-email">{t('email')}</label>
                    </div>

                    <div className="ff-field">
                      <input
                        id="login-password"
                        type="password"
                        className="ff-input"
                        placeholder={t('password')}
                        value={password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        required
                        autoComplete="current-password"
                      />
                      <label htmlFor="login-password">{t('password')}</label>
                    </div>

                    <button
                      type="submit"
                      className="ff-btn ff-btn-primary"
                      disabled={loading}
                      id="login-submit"
                    >
                      {loading ? (
                        <><span className="ff-btn-spinner" /> {t('logging_in')}</>
                      ) : (
                        <><LogIn size={18} /> {t('login_btn')}</>
                      )}
                    </button>
                  </form>

                  <p className="text-center" style={{ fontSize: '0.85rem', marginTop: '0.75rem' }}>
                    <Link to="/forgot-password">{t('forgot_password')}</Link>
                  </p>
                </>
              )}

              <div className="auth-footer-row">
                {t('no_account')}{' '}
                <Link to="/signup">{t('sign_up')}</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
