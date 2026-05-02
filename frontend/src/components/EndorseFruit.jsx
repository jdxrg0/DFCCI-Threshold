import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';
import { Send } from 'lucide-react';

const fruitsList = [
  { key: 'Love', i18n: 'fruit_love', color: '#EF4444' },
  { key: 'Joy', i18n: 'fruit_joy', color: '#F59E0B' },
  { key: 'Peace', i18n: 'fruit_peace', color: '#3B82F6' },
  { key: 'Patience', i18n: 'fruit_patience', color: '#10B981' },
  { key: 'Kindness', i18n: 'fruit_kindness', color: '#8B5CF6' },
  { key: 'Goodness', i18n: 'fruit_goodness', color: '#EC4899' },
  { key: 'Faithfulness', i18n: 'fruit_faithfulness', color: '#06B6D4' },
  { key: 'Gentleness', i18n: 'fruit_gentleness', color: '#14B8A6' },
  { key: 'Self-control', i18n: 'fruit_self_control', color: '#6366F1' },
];

const EndorseFruit = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedFruits, setSelectedFruits] = useState([]);
  const [initialFruits, setInitialFruits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState('');
  const { t } = useLanguage();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await api.get('/users/members');
        setUsers(res.data);
      } catch (err) {
        console.error('Error fetching members', err);
      }
    };
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) {
      setSelectedFruits([]);
      setInitialFruits([]);
      setError('');
      return;
    }

    const fetchGivenEndorsement = async () => {
      setSelectedFruits([]);
      setInitialFruits([]);
      setFetching(true);
      setError('');
      try {
        const res = await api.get(`/fruits/given/${selectedUser}?t=${Date.now()}`);
        const data = res.data || [];
        setSelectedFruits(data);
        setInitialFruits(data);
      } catch (err) {
        console.error('Error fetching given endorsement', err);
      } finally {
        setFetching(false);
      }
    };
    fetchGivenEndorsement();
  }, [selectedUser]);

  const toggleFruit = (fruitKey) => {
    setSelectedFruits(prev => 
      prev.includes(fruitKey) 
        ? prev.filter(f => f !== fruitKey)
        : [...prev, fruitKey]
    );
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedUser) {
      setError('Please select a member first.');
      return;
    }
    
    setLoading(true);
    setError('');

    try {
      await api.post('/fruits/endorse', {
        endorseeId: selectedUser,
        fruits: selectedFruits
      });
      setShowSuccessModal(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save endorsement');
    } finally {
      setLoading(false);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
    setSelectedUser('');
    setSelectedFruits([]);
    setInitialFruits([]);
  };

  const hasChanges = selectedFruits.length !== initialFruits.length || 
    !selectedFruits.every(f => initialFruits.includes(f));

  return (
    <div className="fun-card" style={{ borderTop: '4px solid var(--primary)', padding: '1.5rem' }}>
      <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        {t('endorse_desc')}
      </p>

      {error && <div className="ff-alert ff-alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="ff-field" style={{ marginBottom: '2rem' }}>
        <select
          id="endorse-recipient"
          className="ff-input"
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          required
          style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
        >
          <option value="" disabled>{t('endorse_select_member')}</option>
          {users.map(u => (
            <option key={u._id} value={u._id}>{u.displayName}</option>
          ))}
        </select>
        <label htmlFor="endorse-recipient" style={{ color: 'var(--primary)' }}>{t('sl_recipient')}</label>
      </div>

      {fetching ? (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>{t('loading')}</div>
      ) : selectedUser ? (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {fruitsList.map(({ key, i18n, color }) => {
              const isSelected = selectedFruits.includes(key);
              return (
                <div 
                  key={key} 
                  onClick={() => toggleFruit(key)}
                  style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    padding: '1rem', 
                    backgroundColor: isSelected ? `color-mix(in srgb, ${color} 15%, transparent)` : 'var(--bg-card)',
                    borderRadius: '8px',
                    border: `2px solid ${isSelected ? color : 'var(--border-color)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ 
                    width: '20px', 
                    height: '20px', 
                    borderRadius: '50%', 
                    border: `2px solid ${color}`,
                    backgroundColor: isSelected ? color : 'transparent',
                    marginBottom: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: isSelected ? '700' : '500', color: isSelected ? 'var(--text-main)' : 'var(--text-muted)', textAlign: 'center' }}>
                    {t(i18n)}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
             <button
                type="submit"
                disabled={!selectedUser || !hasChanges || loading}
                className="btn btn-primary"
                style={{ padding: '0.75rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Send size={20} />
                <span style={{ marginLeft: '0.5rem' }}>{loading ? '...' : t('endorse_btn')}</span>
              </button>
          </div>
        </form>
      ) : null}

      {/* Full Screen Success Modal */}
      {showSuccessModal && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          padding: '2rem',
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-out',
          overflowY: 'auto'
        }}>
          <div style={{
            width: '100px', height: '100px', borderRadius: '50%',
            backgroundColor: 'var(--primary)',
            color: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '50px', marginBottom: '2rem',
            boxShadow: '0 4px 20px color-mix(in srgb, var(--primary) 40%, transparent)'
          }}>
            ✓
          </div>
          
          <h2 style={{
            fontSize: 'clamp(1.4rem, 5vw, 2.2rem)',
            marginBottom: '1rem',
            color: 'var(--primary)',
            fontWeight: '800',
            letterSpacing: '-0.5px'
          }}>
            {t('endorsement_saved')}
          </h2>
          
          <p style={{
            fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
            marginBottom: '3rem',
            maxWidth: '540px',
            color: 'var(--text-main)',
            opacity: 0.85,
            lineHeight: 1.7
          }}>
            Thank you for recognizing the good in others.
          </p>

          <button 
            onClick={closeSuccessModal}
            className="btn btn-secondary"
            style={{
              padding: '0.85rem 3rem',
              fontSize: '1rem',
              borderRadius: '9999px',
              fontWeight: '600',
            }}
          >
            Continue
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default EndorseFruit;
