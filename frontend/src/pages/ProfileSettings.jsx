import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Camera, 
  User, 
  Mail, 
  ArrowLeft, 
  Trash2, 
  Check, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Settings,
  LockKeyhole
} from 'lucide-react';
import { PRESETS, renderPresetSvg, renderAvatarHelper } from '../utils/avatarHelper';

const ProfileSettings = () => {
  const { user, updateProfile, updateEmail, verifyEmailOtp, resendEmailOtp, cancelEmailUpdate, updatePassword, removeProfilePicture } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // ── States ──
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  
  // Verification states
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  
  // Password States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Status/Feedback States
  const [profileLoading, setProfileLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Drag and Drop State
  const [dragActive, setDragActive] = useState(false);

  // Synchronize pending verification state on load/update
  useEffect(() => {
    if (user?.pendingEmail) {
      setPendingEmail(user.pendingEmail);
      setShowEmailVerifyModal(true);
    }
  }, [user]);

  // Refs
  const fileInputRef = useRef(null);



  // ── Helper: Password Strength Calculation ──
  const calculatePasswordStrength = (password) => {
    if (!password) return { text: '', score: 0, color: 'transparent' };
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { text: t('strength_weak'), score, color: '#EF4444' }; // Red
    if (score <= 4) return { text: t('strength_medium'), score, color: '#F59E0B' }; // Orange
    return { text: t('strength_strong'), score, color: '#10B981' }; // Green
  };

  const strength = calculatePasswordStrength(newPassword);

  // ── Handlers: Profile & Avatar ──
  const triggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleAvatarFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      return setErrorMsg('File size must be under 5MB.');
    }

    const formData = new FormData();
    formData.append('profilePicture', file);

    setProfileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateProfile(formData);
      setSuccessMsg('Profile picture uploaded successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to upload profile picture.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.size > 5 * 1024 * 1024) {
        return setErrorMsg('File size must be under 5MB.');
      }

      const formData = new FormData();
      formData.append('profilePicture', file);

      setProfileLoading(true);
      setErrorMsg('');
      setSuccessMsg('');

      try {
        await updateProfile(formData);
        setSuccessMsg('Profile picture uploaded successfully!');
      } catch (err) {
        setErrorMsg(err.response?.data?.message || 'Failed to upload profile picture.');
      } finally {
        setProfileLoading(false);
      }
    }
  };

  const handlePresetSelect = async (presetId) => {
    const formData = new FormData();
    formData.append('presetAvatar', presetId);

    setProfileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await updateProfile(formData);
      setSuccessMsg('Default avatar applied successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update avatar.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;

    setProfileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await removeProfilePicture();
      setSuccessMsg('Profile picture removed successfully.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to remove profile picture.');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    if (!displayName || displayName.trim() === '') {
      return setErrorMsg('Display name is required.');
    }

    setProfileLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('displayName', displayName);
      await updateProfile(formData);
      setSuccessMsg('Profile info updated successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update profile info.');
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Handlers: Email ──
  const handleUpdateEmail = async (e) => {
    e.preventDefault();
    if (!email || email.trim() === '') {
      return setErrorMsg('Email is required.');
    }

    setEmailLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const data = await updateEmail(email);
      if (data?.requiresVerification) {
        setPendingEmail(data.pendingEmail);
        setShowEmailVerifyModal(true);
        setEmailOtp('');
        setSuccessMsg(data.message || 'A verification code has been sent to your new email.');
      } else {
        setSuccessMsg('Email updated successfully!');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update email.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailOtp || emailOtp.trim() === '') {
      return setErrorMsg('Verification code is required.');
    }

    setVerifyLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await verifyEmailOtp(emailOtp.trim());
      setShowEmailVerifyModal(false);
      setEmail(pendingEmail);
      setPendingEmail('');
      setEmailOtp('');
      setSuccessMsg('Email verified and updated successfully!');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Invalid or expired verification code.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setResendLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const data = await resendEmailOtp();
      setSuccessMsg(data.message || 'A new verification code has been sent.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to resend verification code.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleCancelEmailUpdate = async () => {
    if (!window.confirm('Are you sure you want to cancel your pending email update?')) return;

    setCancelLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await cancelEmailUpdate();
      setShowEmailVerifyModal(false);
      setPendingEmail('');
      setEmailOtp('');
      setEmail(user?.email || '');
      setSuccessMsg('Email update request cancelled successfully.');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to cancel email update.');
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Handlers: Password ──
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (user?.hasPassword && !currentPassword) {
      return setErrorMsg('Current password is required to change password.');
    }
    if (!newPassword) {
      return setErrorMsg('New password is required.');
    }
    if (newPassword.length < 6) {
      return setErrorMsg('New password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return setErrorMsg('Passwords do not match.');
    }

    setPasswordLoading(true);

    try {
      await updatePassword(currentPassword, newPassword);
      setSuccessMsg('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPasswordLoading(false);
    }
  };

  // Render current picture fallback to initials bubble
  const renderCurrentPhoto = (size = 120) => {
    return renderAvatarHelper(user, size);
  };

  return (
    <div className="container" style={{ maxWidth: '850px', marginTop: '2rem', marginBottom: '4rem' }}>
      
      {/* ── Header Row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link to="/dashboard" className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <ArrowLeft size={16} /> {t('back')}
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Settings size={26} color="var(--primary)" />
            <h1 className="text-gradient text-hero" style={{ fontSize: '2.2rem', margin: 0, lineHeight: 1.1 }}>
              {t('profile_settings')}
            </h1>
          </div>
        </div>
      </div>

      {/* ── Premium Centered Modal Dialog Popup ── */}
      {(successMsg || errorMsg) && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11000,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes scaleUp {
              from {
                transform: scale(0.92);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}</style>
          <div 
            style={{
              backgroundColor: 'var(--card-bg, #1a1a24)',
              border: successMsg ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              width: '100%',
              maxWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              margin: '1.5rem',
            }}
          >
            {/* Action Status Icon */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: successMsg ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                color: successMsg ? '#10B981' : '#EF4444',
                margin: '0 auto 1.25rem auto',
                boxShadow: successMsg ? '0 0 20px rgba(16, 185, 129, 0.2)' : '0 0 20px rgba(239, 68, 68, 0.2)',
              }}
            >
              {successMsg ? <Check size={30} strokeWidth={2.5} /> : <ShieldAlert size={30} strokeWidth={2.5} />}
            </div>

            {/* Modal Title */}
            <h3 
              className="text-gradient"
              style={{
                fontSize: '1.45rem',
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                marginTop: 0,
              }}
            >
              {successMsg ? 'Success!' : 'Error'}
            </h3>

            {/* Message Body Text */}
            <p 
              style={{
                fontSize: '0.92rem',
                color: 'var(--text-main)',
                opacity: 0.9,
                lineHeight: '1.5',
                marginBottom: '1.85rem',
                marginTop: 0,
              }}
            >
              {successMsg || errorMsg}
            </p>

            {/* Confirm "OK" Button */}
            <button
              onClick={() => { setSuccessMsg(''); setErrorMsg(''); }}
              className="ff-btn ff-btn-primary"
              style={{
                width: '100%',
                padding: '0.75rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 'bold',
                borderRadius: '10px',
                boxShadow: successMsg ? '0 4px 15px rgba(16, 185, 129, 0.25)' : '0 4px 15px rgba(239, 68, 68, 0.25)',
              }}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* ── Secure Email OTP Verification Modal ── */}
      {showEmailVerifyModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 11000,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div 
            style={{
              backgroundColor: 'var(--card-bg, #1a1a24)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              borderRadius: '16px',
              padding: '2.5rem 2rem',
              width: '100%',
              maxWidth: '400px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
              animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              margin: '1.5rem',
            }}
          >
            {/* Shield / Mail Verification Icon */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#3B82F6',
                margin: '0 auto 1.25rem auto',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.2)',
              }}
            >
              <Mail size={30} strokeWidth={2.5} />
            </div>

            {/* Modal Title */}
            <h3 
              className="text-gradient"
              style={{
                fontSize: '1.45rem',
                fontWeight: 'bold',
                marginBottom: '0.75rem',
                marginTop: 0,
              }}
            >
              Verify Your New Email
            </h3>

            {/* Description text */}
            <p 
              style={{
                fontSize: '0.9rem',
                color: 'var(--text-main)',
                opacity: 0.9,
                lineHeight: '1.5',
                marginBottom: '1.85rem',
                marginTop: 0,
              }}
            >
              Enter the 6-digit verification code sent to your new email address: <br />
              <strong style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{pendingEmail}</strong>
            </p>

            {/* Form */}
            <form onSubmit={handleVerifyEmailOtp}>
              <div style={{ marginBottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05rem', marginBottom: '0.65rem' }}>
                  Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={emailOtp}
                  onChange={(e) => setEmailOtp(e.target.value.replace(/\D/g, ''))} // Numeric only
                  required
                  placeholder="000000"
                  style={{
                    width: '100%',
                    maxWidth: '240px',
                    height: '52px',
                    borderRadius: '12px',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    color: '#ffffff',
                    caretColor: 'var(--primary)',
                    fontSize: '1.6rem',
                    fontWeight: 'bold',
                    textAlign: 'center',
                    letterSpacing: '0.45rem',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                    paddingLeft: '0.45rem' // offsets letter-spacing of the last character
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.25)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => { setShowEmailVerifyModal(false); setPendingEmail(''); setErrorMsg(''); }}
                  className="ff-btn ff-btn-secondary"
                  style={{ flex: 1, padding: '0.75rem 1.5rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 'bold' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="ff-btn ff-btn-primary"
                  style={{ flex: 1, padding: '0.75rem 1.5rem', borderRadius: '10px', fontSize: '0.95rem', fontWeight: 'bold' }}
                  disabled={verifyLoading}
                >
                  {verifyLoading ? 'Verifying...' : 'Verify'}
                </button>
              </div>
            </form>

            {/* Resend Code Option */}
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <button
                type="button"
                onClick={handleResendEmailOtp}
                disabled={resendLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  opacity: resendLoading ? 0.6 : 1,
                }}
              >
                {resendLoading ? 'Resending Code...' : 'Resend Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Primary Settings Panels Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* PANEL 1: Profile & Avatar */}
        <div className="fun-card" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            <User size={20} color="var(--primary)" /> Profile Info & Picture
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center', width: '100%' }}>
            
            {/* Drag & Drop Avatar Uploader Container */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                position: 'relative',
                width: '100%',
                maxWidth: '300px',
                padding: '1.5rem',
                borderRadius: 'var(--radius)',
                border: dragActive ? '2px dashed var(--primary)' : '2px dashed var(--border-color)',
                backgroundColor: dragActive ? 'rgba(var(--primary-rgb), 0.05)' : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ position: 'relative', cursor: 'pointer' }} onClick={triggerFileSelect}>
                {renderCurrentPhoto(120)}
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '5px',
                    right: '5px',
                    backgroundColor: 'var(--primary)',
                    borderRadius: '50%',
                    padding: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'transform 0.2s',
                  }}
                  className="avatar-cam-badge"
                >
                  <Camera size={16} />
                </div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '600' }}>
                  Drag & drop image here or click to browse
                </p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  PNG, JPG, or WEBP up to 5MB
                </p>
              </div>

              <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*"
                onChange={handleAvatarFileChange}
              />

              {user?.profilePicture && !PRESETS.includes(user.profilePicture) && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="btn btn-secondary"
                  style={{ 
                    padding: '0.35rem 0.75rem', 
                    fontSize: '0.78rem', 
                    color: '#EF4444', 
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    background: 'transparent'
                  }}
                  disabled={profileLoading}
                >
                  <Trash2 size={13} /> {t('remove_picture')}
                </button>
              )}
            </div>

            {/* Grid of Preset SVG Avatars */}
            <div style={{ width: '100%' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textAlign: 'center' }}>
                {t('preset_avatars')}
              </p>
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(55px, 1fr))',
                  gap: '0.75rem',
                  maxWidth: '520px',
                  margin: '0 auto',
                  padding: '0.5rem',
                }}
              >
                {PRESETS.map((presetId, idx) => {
                  const isActive = user?.profilePicture === presetId;
                  return (
                    <button
                      key={presetId}
                      onClick={() => handlePresetSelect(presetId)}
                      style={{
                        padding: 0,
                        border: isActive ? '3px solid var(--primary)' : '2px solid transparent',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        width: '55px',
                        height: '55px',
                        background: 'transparent',
                        boxShadow: isActive ? '0 0 12px rgba(var(--primary-rgb), 0.5)' : 'none',
                        transition: 'transform 0.2s, border-color 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      className="preset-avatar-btn"
                      disabled={profileLoading}
                      title={`Preset Avatar ${idx + 1}`}
                    >
                      {renderPresetSvg(presetId, 55, { boxShadow: 'none' })}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Display Name Update Field Form */}
            <form onSubmit={handleSaveInfo} style={{ width: '100%', maxWidth: '520px', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
              <div className="ff-field" style={{ marginBottom: '1.25rem' }}>
                <input
                  id="settings-name"
                  type="text"
                  className="ff-input"
                  placeholder={t('display_name')}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={30}
                />
                <label htmlFor="settings-name">{t('display_name')}</label>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                style={{ width: '100%' }}
                disabled={profileLoading}
              >
                {profileLoading ? (
                  <><span className="ff-btn-spinner" /> Updating...</>
                ) : (
                  <>{t('update_profile_btn')}</>
                )}
              </button>
            </form>

          </div>
        </div>

        {/* PANEL 2: Email & Security */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          {/* Card: Email Management */}
          <div className="fun-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <Mail size={18} color="var(--primary)" /> {t('update_email_btn')}
            </h2>

            {user?.pendingEmail && (
              <div 
                style={{
                  backgroundColor: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginBottom: '1.5rem',
                  color: 'var(--text-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                  <ShieldAlert size={18} color="#3B82F6" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ fontSize: '0.88rem', lineHeight: '1.45' }}>
                    You have a pending request to update your email to:<br />
                    <strong style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>{user.pendingEmail}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setPendingEmail(user.pendingEmail);
                      setShowEmailVerifyModal(true);
                      setEmailOtp('');
                    }}
                    className="ff-btn ff-btn-primary"
                    style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.82rem', borderRadius: '8px', minHeight: 'auto' }}
                  >
                    Verify Now
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEmailUpdate}
                    disabled={cancelLoading}
                    className="ff-btn ff-btn-secondary"
                    style={{ flex: 1, padding: '0.5rem 1rem', fontSize: '0.82rem', borderRadius: '8px', minHeight: 'auto' }}
                  >
                    {cancelLoading ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleUpdateEmail}>
              {user?.googleId && (
                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  <ShieldAlert size={16} color="#3B82F6" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Signed in with Google:</strong> Updating your system communication email will not modify your primary Google OAuth account.
                  </div>
                </div>
              )}

              <div className="ff-field" style={{ marginBottom: '1.25rem' }}>
                <input
                  id="settings-email"
                  type="email"
                  className="ff-input"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
                <label htmlFor="settings-email">{t('email')}</label>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                style={{ width: '100%' }}
                disabled={emailLoading}
              >
                {emailLoading ? (
                  <><span className="ff-btn-spinner" /> Updating...</>
                ) : (
                  <>{t('update_email_btn')}</>
                )}
              </button>
            </form>
          </div>

          {/* Card: Password Change / Settings */}
          <div className="fun-card" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              <LockKeyhole size={18} color="var(--primary)" /> {t('update_password_btn')}
            </h2>

            <form onSubmit={handleUpdatePassword}>
              
              {/* If Google-only account, give clear instruction they can create password */}
              {!user?.hasPassword ? (
                <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '0.75rem', borderRadius: 'var(--radius)', marginBottom: '1.25rem', fontSize: '0.8rem', color: 'var(--text-main)' }}>
                  <ShieldAlert size={16} color="#10B981" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong>Create Account Password:</strong> Since you signed up via Google, you do not have a password set. You can set one here to enable direct email/password login!
                  </div>
                </div>
              ) : (
                // Only show current password field if they already have a password set!
                <div className="ff-field" style={{ marginBottom: '1.25rem' }}>
                  <input
                    id="settings-current-pass"
                    type={showCurrentPass ? "text" : "password"}
                    className="ff-input"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required={user?.hasPassword}
                    autoComplete="current-password"
                  />
                  <label htmlFor="settings-current-pass">{t('current_password_lbl')}</label>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    style={{ position: 'absolute', right: '12px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                  >
                    {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              )}

              <div className="ff-field" style={{ marginBottom: '1.25rem' }}>
                <input
                  id="settings-new-pass"
                  type={showNewPass ? "text" : "password"}
                  className="ff-input"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <label htmlFor="settings-new-pass">{t('new_password_lbl')}</label>
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  style={{ position: 'absolute', right: '12px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Real-time Password Strength Indicator bar & label */}
              {newPassword && (
                <div style={{ marginBottom: '1rem', animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('password_hint')}</span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 'bold', color: strength.color }}>{strength.text}</span>
                  </div>
                  <div style={{ height: '5px', width: '100%', backgroundColor: 'var(--border-color)', borderRadius: '2.5px', overflow: 'hidden' }}>
                    <div 
                      style={{ 
                        height: '100%', 
                        width: `${Math.min(100, (strength.score / 5) * 100)}%`, 
                        backgroundColor: strength.color,
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
                      }} 
                    />
                  </div>
                </div>
              )}

              <div className="ff-field" style={{ marginBottom: '1.5rem' }}>
                <input
                  id="settings-confirm-pass"
                  type={showConfirmPass ? "text" : "password"}
                  className="ff-input"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <label htmlFor="settings-confirm-pass">{t('confirm_password_lbl')}</label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  style={{ position: 'absolute', right: '12px', top: '15px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                  {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button
                type="submit"
                className="ff-btn ff-btn-primary"
                style={{ width: '100%' }}
                disabled={passwordLoading}
              >
                {passwordLoading ? (
                  <><span className="ff-btn-spinner" /> Updating...</>
                ) : (
                  <>{t('update_password_btn')}</>
                )}
              </button>
            </form>
          </div>

        </div>

      </div>

    </div>
  );
};

export default ProfileSettings;
