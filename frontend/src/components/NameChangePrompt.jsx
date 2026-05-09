import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { UserCog } from 'lucide-react';

const NameChangePrompt = () => {
  const { user, updateDisplayName } = useAuth();
  const { t } = useLanguage();
  const [newName, setNewName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const shouldShow = user && user.nameChangeRequested;

  useEffect(() => {
    if (shouldShow && user?.displayName) {
      setNewName(user.displayName);
    }
  }, [shouldShow, user?.displayName]);

  useEffect(() => {
    if (shouldShow) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [shouldShow]);

  if (!shouldShow) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedName = newName.trim();
    if (!trimmedName) {
      setError('Name cannot be empty.');
      return;
    }

    if (trimmedName.split(/\s+/).length < 2) {
      setError('Please enter your full name (first and last name).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await updateDisplayName(newName);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999, // Ensure it covers everything including the navbar
      padding: '1rem'
    }}>
      <div className="fun-card" style={{ maxWidth: '420px', width: '100%', margin: 0, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ 
            width: '64px', height: '64px', 
            borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: '#f59e0b',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' 
          }}>
            <UserCog size={32} />
          </div>
          <h2 className="fun-title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Update Required</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
            An administrator has requested that you update your display name. Please provide your real name to continue using the application.
          </p>
        </div>

        {error && <div className="ff-alert ff-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="ff-field">
            <input
              id="update-name-input"
              type="text"
              className="ff-input"
              placeholder="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoComplete="name"
            />
            <label htmlFor="update-name-input">Full Name</label>
          </div>

          <button
            type="submit"
            className="ff-btn ff-btn-primary"
            disabled={loading || !newName.trim()}
            style={{ marginTop: '1rem' }}
          >
            {loading ? (
              <><span className="ff-btn-spinner" /> Updating...</>
            ) : (
              'Update Name'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default NameChangePrompt;
