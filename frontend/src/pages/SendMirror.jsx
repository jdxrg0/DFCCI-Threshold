import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import TimerButton from '../components/TimerButton';
import useFormPersist from '../hooks/useFormPersist';
import { useLanguage } from '../context/LanguageContext';
import { ChevronLeft } from 'lucide-react';

const SendMirror = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm, clearSavedForm] = useFormPersist('send_mirror_draft', {
    selectedUser: '',
    topic: '',
    concern: '',
    impact: '',
    desiredChange: '',
    bibleVerse: '',
    agreement: false
  });
  const { selectedUser, topic, concern, impact, desiredChange, bibleVerse, agreement } = form;
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
      setError('Please provide a short topic for this mirror.');
      return;
    }
    if (!concern.trim() || !impact.trim() || !desiredChange.trim() || !bibleVerse.trim()) {
      setError('Please ensure all fields are filled out.');
      return;
    }
    if (!selectedUser) {
      setError('Please select a recipient.');
      return;
    }
    if (!agreement) {
      setError('You must agree to send this with care and respect.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/threads', {
        receiverId: selectedUser,
        topic: topic.trim(),
        content: { concern, impact, desiredChange, bibleVerse }
      });
      clearSavedForm();
      navigate('/mirror/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send mirror');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: '620px' }}>
      <button onClick={() => navigate('/mirror/dashboard')} className="back-btn">
        <ChevronLeft size={18} /> {t('back_to_dashboard')}
      </button>

      <div className="fun-card">
        <h2 className="fun-title">{t('send_gentle_mirror')}</h2>

        {/* Scripture quote */}
        <div className="ff-quote">
          "Ang sugat na likha ng tapat na kaibigan, ay mabuti kaysa halik ng kaaway na mapagkunwari."
          <small>Kawikaan 27:6</small>
        </div>

        {error && <div className="ff-alert ff-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Topic / Title */}
          <div className="ff-field" style={{ marginBottom: '0.25rem' }}>
            <input
              id="mirror-topic"
              type="text"
              className="ff-input"
              placeholder="e.g. Tungkol sa aming pag-uusap noong Linggo…"
              value={topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              maxLength={80}
              required
            />
            <label htmlFor="mirror-topic">{t('topic_label')}</label>
          </div>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'right' }}>
            {topic.length}/80
          </p>

          {/* Recipient */}
          <div className="ff-field">
            <select
              id="mirror-recipient"
              className="ff-input"
              value={selectedUser}
              onChange={(e) => setForm({ ...form, selectedUser: e.target.value })}
              required
            >
              <option value="" disabled>{t('select_member')}</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>{u.displayName}</option>
              ))}
            </select>
            <label htmlFor="mirror-recipient">{t('recipient')}</label>
          </div>

          {/* Concern */}
          <div className="ff-field ff-textarea">
            <textarea
              id="mirror-concern"
              className="ff-input ff-textarea-el"
              placeholder={t('concern_placeholder')}
              value={concern}
              onChange={(e) => setForm({ ...form, concern: e.target.value })}
              required
            />
            <label htmlFor="mirror-concern">{t('concern_label')}</label>
          </div>

          {/* Impact */}
          <div className="ff-field ff-textarea">
            <textarea
              id="mirror-impact"
              className="ff-input ff-textarea-el"
              placeholder={t('impact_placeholder')}
              value={impact}
              onChange={(e) => setForm({ ...form, impact: e.target.value })}
              required
            />
            <label htmlFor="mirror-impact">{t('impact_label')}</label>
          </div>

          {/* Desired change */}
          <div className="ff-field ff-textarea">
            <textarea
              id="mirror-change"
              className="ff-input ff-textarea-el"
              placeholder={t('change_placeholder')}
              value={desiredChange}
              onChange={(e) => setForm({ ...form, desiredChange: e.target.value })}
              required
            />
            <label htmlFor="mirror-change">{t('change_label')}</label>
          </div>

          {/* Bible verse */}
          <div className="ff-field">
            <input
              id="mirror-verse"
              type="text"
              className="ff-input"
              placeholder="e.g. Kawikaan 27:6"
              value={bibleVerse}
              onChange={(e) => setForm({ ...form, bibleVerse: e.target.value })}
              required
            />
            <label htmlFor="mirror-verse">{t('bible_verse_label')}</label>
          </div>

          {/* Agreement checkbox */}
          <div className="ff-checkbox-row">
            <input
              type="checkbox"
              id="mirror-agreement"
              className="ff-checkbox"
              checked={agreement}
              onChange={(e) => setForm({ ...form, agreement: e.target.checked })}
              required
            />
            <label htmlFor="mirror-agreement" className="ff-checkbox-label">
              {t('agreement_label')}
            </label>
          </div>

          {/* Send button */}
          <div className="mt-4">
            <TimerButton
              type="submit"
              onConfirm={handleSubmit}

              label={t('send_btn')}
              loading={loading}
              disabled={!topic.trim() || !selectedUser || !concern.trim() || !impact.trim() || !desiredChange.trim() || !bibleVerse.trim() || !agreement}
            />
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t('reflect_before_send')}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendMirror;
