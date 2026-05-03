import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
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
  const { login } = useAuth();
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
        // Seed the signup sessionStorage so /signup restores to step 2
        sessionStorage.setItem('dfcci_signup_step', '2');
        sessionStorage.setItem('dfcci_signup_pending_email', email);
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
        <h2 className="fun-title">{t('welcome_back')}</h2>

        {error && <div className="ff-alert ff-alert-error">{error}</div>}

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

        <p className="text-center" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
          <Link to="/forgot-password" style={{ color: 'var(--text-muted)' }}>{t('forgot_password')}</Link>
        </p>

        <div className="ff-divider" style={{ marginTop: '1rem' }}>or</div>

        <p className="text-center" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
          {t('no_account')}{' '}
          <Link to="/signup" style={{ fontWeight: 600 }}>{t('sign_up')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
