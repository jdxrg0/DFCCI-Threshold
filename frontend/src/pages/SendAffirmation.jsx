import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Sun } from 'lucide-react';
import api from '../api';
import TimerButton from '../components/TimerButton';
import useFormPersist from '../hooks/useFormPersist';
import { useLanguage } from '../context/LanguageContext';

const SendAffirmation = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm, clearSavedForm] = useFormPersist('send_affirmation_draft', {
    selectedUser: '',
    topic: '',
    appreciation: '',
    impact: '',
    encouragement: '',
    bibleVerse: '',
    agreement: false
  });
  const { selectedUser, topic, appreciation, impact, encouragement, bibleVerse, agreement } = form;
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError('');

    if (!topic.trim()) {
      setError('Please provide a short topic or title.');
      return;
    }
    if (!appreciation.trim() || !impact.trim() || !encouragement.trim() || !bibleVerse.trim()) {
      setError('Please ensure all fields are filled out.');
      return;
    }
    if (!selectedUser) {
      setError('Please select a recipient.');
      return;
    }
    if (!agreement) {
      setError('You must agree to send this sincerely.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/affirmations', {
        receiverId: selectedUser,
        topic: topic.trim(),
        content: { appreciation, impact, encouragement, bibleVerse }
      });
      clearSavedForm();
      navigate('/affirm/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send affirmation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '620px' }}>
      <button onClick={() => navigate('/affirm/dashboard')} className="back-btn" style={{ transition: 'transform 0.2s ease' }}>
        <ChevronLeft size={18} /> {t('sl_back_to_dashboard')}
      </button>

      <div className="fun-card" style={{ borderTop: '4px solid var(--primary)' }}>
        <h2 className="fun-title" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}>
          <Sun size={24} /> {t('send_shining_light')}
        </h2>

        {/* Scripture quote */}
        <div className="ff-quote" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', borderLeftColor: 'var(--primary)' }}>
          {t('sl_scripture_quote')}
          <small>{t('sl_bible_ref')}</small>
        </div>

        {error && <div className="ff-alert ff-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Topic / Title */}
          <div className="ff-field" style={{ marginBottom: '0.25rem' }}>
            <input
              id="aff-topic"
              type="text"
              className="ff-input"
              placeholder="e.g. Thank you for your hard work!"
              value={topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              maxLength={80}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            />
            <label htmlFor="aff-topic" style={{ color: 'var(--primary)' }}>{t('sl_topic_label')}</label>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'right' }}>
            {topic.length}/80
          </p>

          {/* Recipient */}
          <div className="ff-field">
            <select
              id="aff-recipient"
              className="ff-input"
              value={selectedUser}
              onChange={(e) => setForm({ ...form, selectedUser: e.target.value })}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            >
              <option value="" disabled>{t('select_member')}</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.displayName}</option>
              ))}
            </select>
            <label htmlFor="aff-recipient" style={{ color: 'var(--primary)' }}>{t('sl_recipient')}</label>
          </div>

          {/* Appreciation */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-appreciation"
              className="ff-input ff-textarea-el"
              placeholder={t('sl_appreciation_placeholder')}
              value={appreciation}
              onChange={(e) => setForm({ ...form, appreciation: e.target.value })}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            />
            <label htmlFor="aff-appreciation" style={{ color: 'var(--primary)' }}>{t('sl_appreciation_label')}</label>
          </div>

          {/* Impact */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-impact"
              className="ff-input ff-textarea-el"
              placeholder={t('sl_impact_placeholder')}
              value={impact}
              onChange={(e) => setForm({ ...form, impact: e.target.value })}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            />
            <label htmlFor="aff-impact" style={{ color: 'var(--primary)' }}>{t('sl_impact_label')}</label>
          </div>

          {/* Encouragement */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-encouragement"
              className="ff-input ff-textarea-el"
              placeholder={t('sl_encouragement_placeholder')}
              value={encouragement}
              onChange={(e) => setForm({ ...form, encouragement: e.target.value })}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            />
            <label htmlFor="aff-encouragement" style={{ color: 'var(--primary)' }}>{t('sl_encouragement_label')}</label>
          </div>

          {/* Bible verse */}
          <div className="ff-field">
            <input
              id="aff-verse"
              type="text"
              className="ff-input"
              placeholder="e.g. 1 Thessalonians 5:11"
              value={bibleVerse}
              onChange={(e) => setForm({ ...form, bibleVerse: e.target.value })}
              required
              style={{ borderColor: 'color-mix(in srgb, var(--primary) 50%, transparent)' }}
            />
            <label htmlFor="aff-verse" style={{ color: 'var(--primary)' }}>{t('sl_bible_verse_label')}</label>
          </div>

          {/* Agreement checkbox */}
          <div className="ff-checkbox-row">
            <input
              type="checkbox"
              id="aff-agreement"
              className="ff-checkbox"
              checked={agreement}
              onChange={(e) => setForm({ ...form, agreement: e.target.checked })}
              required
              style={{ accentColor: 'var(--primary)' }}
            />
            <label htmlFor="aff-agreement" className="ff-checkbox-label">
              {t('sl_agreement_label')}
            </label>
          </div>

          {/* Send button */}
          <div className="mt-4">
            <TimerButton
              type="submit"
              onConfirm={handleSubmit}
              module="affirmation"
              label={t('sl_send_btn')}
              loading={loading}
              duration={30}
              disabled={!topic.trim() || !selectedUser || !appreciation.trim() || !impact.trim() || !encouragement.trim() || !bibleVerse.trim() || !agreement}
              className="btn btn-primary"
            />
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t('sl_reflect_note')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendAffirmation;
