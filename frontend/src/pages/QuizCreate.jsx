import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, Eye, EyeOff, GripVertical, Gamepad2 } from 'lucide-react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PopupModal from '../components/PopupModal';

const CATEGORIES = ['General', 'Old Testament', 'New Testament', 'Gospels', 'Psalms & Proverbs', 'Church History', 'Youth Group'];

const emptyQuestion = () => ({
  questionText: '',
  questionType: 'multiple_choice',
  options: ['', '', '', ''],
  correctIndex: 0,
  timeLimit: 15,
});

const QuizCreate = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [isPublished, setIsPublished] = useState(false);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [popup, setPopup] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isAlert: false });

  const showAlert = (title, message) => setPopup({ isOpen: true, title, message, onConfirm: null, isAlert: true });
  const showConfirm = (title, message, onConfirm) => setPopup({ isOpen: true, title, message, onConfirm, isAlert: false });

  // Redirect non-admins
  useEffect(() => {
    if (user?.role !== 'ADMIN') {
      navigate('/games');
    }
  }, [user, navigate]);

  // Load quiz data for editing
  useEffect(() => {
    if (!isEdit) return;
    const fetchQuiz = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/games/quizzes/${id}?admin=true`);
        const quiz = res.data;
        setTitle(quiz.title);
        setDescription(quiz.description || '');
        setCategory(quiz.category || 'General');
        setIsPublished(quiz.isPublished);
        setQuestions(quiz.questions.map(q => ({
          questionText: q.questionText,
          questionType: q.questionType || 'multiple_choice',
          options: q.questionType === 'true_false' ? ['True', 'False'] : [...q.options],
          correctIndex: q.correctIndex,
          timeLimit: q.timeLimit || 15,
        })));
      } catch (err) {
        setError('Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id, isEdit]);

  const updateQuestion = (index, field, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // If switching to true_false, fix options
      if (field === 'questionType' && value === 'true_false') {
        updated[index].options = ['True', 'False'];
        if (updated[index].correctIndex > 1) {
          updated[index].correctIndex = 0;
        }
      }
      // If switching to multiple_choice from true_false, expand options
      if (field === 'questionType' && value === 'multiple_choice') {
        if (updated[index].options.length < 4) {
          updated[index].options = ['', '', '', ''];
          updated[index].correctIndex = 0;
        }
      }
      return updated;
    });
  };

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      const opts = [...updated[qIndex].options];
      opts[optIndex] = value;
      updated[qIndex] = { ...updated[qIndex], options: opts };
      return updated;
    });
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, emptyQuestion()]);
  };

  const removeQuestion = (index) => {
    if (questions.length <= 1) {
      showAlert('Cannot Remove', 'A quiz must have at least one question.');
      return;
    }
    setQuestions(prev => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= questions.length) return;
    setQuestions(prev => {
      const updated = [...prev];
      [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
      return updated;
    });
  };

  const addOption = (qIndex) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[qIndex] = { ...updated[qIndex], options: [...updated[qIndex].options, ''] };
      return updated;
    });
  };

  const removeOption = (qIndex, optIndex) => {
    setQuestions(prev => {
      const updated = [...prev];
      const opts = updated[qIndex].options.filter((_, i) => i !== optIndex);
      let correct = updated[qIndex].correctIndex;
      if (correct >= opts.length) correct = 0;
      if (correct === optIndex) correct = 0;
      updated[qIndex] = { ...updated[qIndex], options: opts, correctIndex: correct };
      return updated;
    });
  };

  const validate = () => {
    if (!title.trim()) return 'Title is required.';
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) return `Question ${i + 1} is missing text.`;
      if (q.questionType === 'multiple_choice') {
        if (q.options.length < 2) return `Question ${i + 1} needs at least 2 options.`;
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].trim()) return `Question ${i + 1}, Option ${j + 1} is empty.`;
        }
      }
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validate();
    if (validationError) {
      showAlert('Validation Error', validationError);
      return;
    }

    setSaving(true);
    setError('');
    try {
      const payload = { title, description, category, isPublished, questions };
      if (isEdit) {
        await api.put(`/games/quizzes/${id}`, payload);
      } else {
        await api.post('/games/quizzes', payload);
      }
      navigate('/games');
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to save quiz.';
      showAlert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    showConfirm('Delete Quiz', 'Are you sure you want to delete this quiz? All attempt data will also be deleted. This cannot be undone.', async () => {
      try {
        await api.delete(`/games/quizzes/${id}`);
        navigate('/games');
      } catch (err) {
        showAlert('Error', err.response?.data?.message || 'Failed to delete quiz.');
      }
    });
  };

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: '800px', padding: '2rem 1rem' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading quiz...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '800px', padding: '1rem' }}>
      <button onClick={() => navigate('/games')} className="back-btn">
        <ChevronLeft size={18} /> {t('back')}
      </button>

      <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Gamepad2 size={26} /> {isEdit ? 'Edit Quiz' : t('games_create_quiz')}
      </h1>

      {error && <p style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</p>}

      {/* ── Quiz Info ── */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">{t('games_quiz_title')}</label>
          <input
            type="text"
            className="form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Book of James Quiz"
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('description')}</label>
          <textarea
            className="form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this quiz..."
            style={{ minHeight: '80px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '180px' }}>
            <label className="form-label">{t('category')}</label>
            <select
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setIsPublished(!isPublished)}
              className={`btn ${isPublished ? 'btn-success' : 'btn-secondary'}`}
              style={{ gap: '0.4rem', padding: '0.5rem 1rem', whiteSpace: 'nowrap' }}
            >
              {isPublished ? <Eye size={16} /> : <EyeOff size={16} />}
              {isPublished ? 'Published' : 'Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Questions ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-main)' }}>
          Questions ({questions.length})
        </h2>
        <button onClick={addQuestion} className="btn btn-secondary" style={{ gap: '0.3rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>
          <Plus size={16} /> Add Question
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--primary)' }}>
            {/* Question header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '800', color: 'var(--primary)', fontSize: '0.9rem', flexShrink: 0 }}>Q{qIndex + 1}</span>
              <div style={{ flex: 1 }} />
              <select
                value={q.questionType}
                onChange={(e) => updateQuestion(qIndex, 'questionType', e.target.value)}
                className="form-input"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto', minWidth: '130px' }}
              >
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
              </select>
              <select
                value={q.timeLimit}
                onChange={(e) => updateQuestion(qIndex, 'timeLimit', parseInt(e.target.value))}
                className="form-input"
                style={{ padding: '0.3rem 0.5rem', fontSize: '0.8rem', width: 'auto', minWidth: '70px' }}
              >
                {[5, 10, 15, 20, 30, 45, 60].map(s => <option key={s} value={s}>{s}s</option>)}
              </select>
              <div style={{ display: 'flex', gap: '0.15rem' }}>
                <button onClick={() => moveQuestion(qIndex, -1)} disabled={qIndex === 0} className="btn btn-secondary" style={{ padding: '0.25rem', opacity: qIndex === 0 ? 0.3 : 1 }}>
                  <ChevronUp size={14} />
                </button>
                <button onClick={() => moveQuestion(qIndex, 1)} disabled={qIndex === questions.length - 1} className="btn btn-secondary" style={{ padding: '0.25rem', opacity: qIndex === questions.length - 1 ? 0.3 : 1 }}>
                  <ChevronDown size={14} />
                </button>
                <button onClick={() => removeQuestion(qIndex)} className="btn btn-secondary" style={{ padding: '0.25rem', color: '#ef4444' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Question text */}
            <input
              type="text"
              className="form-input"
              value={q.questionText}
              onChange={(e) => updateQuestion(qIndex, 'questionText', e.target.value)}
              placeholder={`Enter question ${qIndex + 1}...`}
              style={{ marginBottom: '0.75rem', fontWeight: '600' }}
            />

            {/* Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {q.options.map((opt, optIndex) => (
                <div key={optIndex} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => updateQuestion(qIndex, 'correctIndex', optIndex)}
                    className={q.correctIndex === optIndex ? 'quiz-correct-marker active' : 'quiz-correct-marker'}
                    title={q.correctIndex === optIndex ? 'Correct answer' : 'Mark as correct'}
                    style={{
                      width: '28px', height: '28px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${q.correctIndex === optIndex ? '#10b981' : 'var(--border-color)'}`,
                      background: q.correctIndex === optIndex ? 'rgba(16,185,129,0.15)' : 'transparent',
                      color: q.correctIndex === optIndex ? '#10b981' : 'var(--text-muted)',
                      cursor: 'pointer', fontSize: '0.75rem', fontWeight: '800',
                    }}
                  >
                    {String.fromCharCode(65 + optIndex)}
                  </button>
                  {q.questionType === 'true_false' ? (
                    <span style={{ flex: 1, padding: '0.5rem 0.75rem', color: 'var(--text-main)', fontSize: '0.9rem' }}>
                      {opt}
                    </span>
                  ) : (
                    <input
                      type="text"
                      className="form-input"
                      value={opt}
                      onChange={(e) => updateOption(qIndex, optIndex, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                      style={{ flex: 1, padding: '0.4rem 0.75rem', fontSize: '0.9rem' }}
                    />
                  )}
                  {q.questionType === 'multiple_choice' && q.options.length > 2 && (
                    <button onClick={() => removeOption(qIndex, optIndex)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.25rem', opacity: 0.6 }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              {q.questionType === 'multiple_choice' && q.options.length < 6 && (
                <button onClick={() => addOption(qIndex)} className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', alignSelf: 'flex-start', marginTop: '0.25rem', gap: '0.3rem' }}>
                  <Plus size={14} /> Add Option
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ flex: 1, gap: '0.4rem', padding: '0.75rem' }}>
          <Save size={18} /> {saving ? 'Saving...' : (isEdit ? 'Update Quiz' : 'Create Quiz')}
        </button>
        {isEdit && (
          <button onClick={handleDelete} className="btn btn-danger" style={{ gap: '0.4rem', padding: '0.75rem' }}>
            <Trash2 size={18} /> Delete
          </button>
        )}
      </div>

      <PopupModal
        isOpen={popup.isOpen}
        onClose={() => setPopup(p => ({ ...p, isOpen: false }))}
        title={popup.title}
        message={popup.message}
        onConfirm={popup.onConfirm}
        isAlert={popup.isAlert}
      />
    </div>
  );
};

export default QuizCreate;
