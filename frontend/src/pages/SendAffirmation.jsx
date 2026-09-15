import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sun } from 'lucide-react';
import * as usersApi from '../services/users';
import * as affirmations from '../services/affirmations';
import TimerButton from '../components/TimerButton';
import useFormPersist from '../hooks/useFormPersist';
import { useLanguage } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

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
        const data = await usersApi.getVerifiedMembers();
        setUsers(data);
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
      await affirmations.sendAffirmation({
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
      <div style={{ padding: 0 }}>
        <PageHeader
          icon={Sun}
          title={t('send_shining_light')}
        />

        {/* Scripture quote */}
        <div className="ff-quote-glass" style={{ borderLeft: '4px solid var(--primary)', marginBottom: '2rem' }}>
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
              className="affirmation-input-glass"
              placeholder="e.g. Thank you for your hard work!"
              value={topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              maxLength={80}
              required
            />
            <label htmlFor="aff-topic" className="affirmation-field-label">{t('sl_topic_label')}</label>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'right' }}>
            {topic.length}/80
          </p>

          {/* Recipient */}
          <div className="ff-field">
            <select
              id="aff-recipient"
              className={`affirmation-input-glass ${selectedUser ? 'has-value' : ''}`}
              value={selectedUser}
              onChange={(e) => setForm({ ...form, selectedUser: e.target.value })}
              required
            >
              <option value="" disabled>{t('select_member')}</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.displayName}</option>
              ))}
            </select>
            <label htmlFor="aff-recipient" className="affirmation-field-label">{t('sl_recipient')}</label>
          </div>

          {/* Appreciation */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-appreciation"
              className="affirmation-input-glass ff-textarea-el"
              placeholder={t('sl_appreciation_placeholder')}
              value={appreciation}
              onChange={(e) => setForm({ ...form, appreciation: e.target.value })}
              required
            />
            <label htmlFor="aff-appreciation" className="affirmation-field-label">{t('sl_appreciation_label')}</label>
          </div>

          {/* Impact */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-impact"
              className="affirmation-input-glass ff-textarea-el"
              placeholder={t('sl_impact_placeholder')}
              value={impact}
              onChange={(e) => setForm({ ...form, impact: e.target.value })}
              required
            />
            <label htmlFor="aff-impact" className="affirmation-field-label">{t('sl_impact_label')}</label>
          </div>

          {/* Encouragement */}
          <div className="ff-field ff-textarea">
            <textarea
              id="aff-encouragement"
              className="affirmation-input-glass ff-textarea-el"
              placeholder={t('sl_encouragement_placeholder')}
              value={encouragement}
              onChange={(e) => setForm({ ...form, encouragement: e.target.value })}
              required
            />
            <label htmlFor="aff-encouragement" className="affirmation-field-label">{t('sl_encouragement_label')}</label>
          </div>

          {/* Bible verse */}
          <div className="ff-field">
            <input
              id="aff-verse"
              type="text"
              className="affirmation-input-glass"
              placeholder="e.g. 1 Thessalonians 5:11"
              value={bibleVerse}
              onChange={(e) => setForm({ ...form, bibleVerse: e.target.value })}
              required
            />
            <label htmlFor="aff-verse" className="affirmation-field-label">{t('sl_bible_verse_label')}</label>
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
              customStyle={{ borderRadius: '9999px', padding: '0.85rem', fontWeight: '700' }}
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
