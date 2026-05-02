import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, KeyRound, Lock, CheckCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';
import logo from '../assets/logo.svg';

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1: enter email, 2: enter code + new password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError(''); setMsg(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setMsg(res.data.message);
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
      const res = await api.post('/auth/forgot-password', { email });
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
      const res = await api.post('/auth/reset-password', { email, otp, newPassword });
      setMsg(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
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

            <div className="ff-divider" style={{ marginTop: '1.25rem' }}>{t('remembered_it')}</div>
            <p className="text-center" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
              <Link to="/login" style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                <ArrowLeft size={14} /> {t('back_to_login')}
              </Link>
            </p>
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
  );
};

export default ForgotPassword;
