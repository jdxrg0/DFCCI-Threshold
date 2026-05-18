import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, Play, Clock, Target, RotateCcw, Trophy, CheckCircle2, XCircle, ArrowRight, Gamepad2 } from 'lucide-react';
import api from '../api';
import { useLanguage } from '../context/LanguageContext';
import ThreadSkeleton from '../components/ThreadSkeleton';

// ── Confetti particle component (pure CSS, no library) ──────────────────────
const Confetti = () => {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE'];
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    color: colors[i % colors.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.5}s`,
    size: `${Math.random() * 6 + 4}px`,
    duration: `${Math.random() * 1.5 + 1.5}s`,
  }));

  return (
    <div className="quiz-confetti-container" aria-hidden="true">
      {particles.map(p => (
        <div
          key={p.id}
          className="quiz-confetti-particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
};

// ── Timer Ring ──────────────────────────────────────────────────────────────
const TimerRing = ({ timeLeft, maxTime }) => {
  const progress = maxTime > 0 ? timeLeft / maxTime : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference * (1 - progress);
  const isLow = timeLeft <= 5;

  return (
    <div className="quiz-timer-ring-wrapper">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="40" fill="none" stroke="var(--border-color)" strokeWidth="4" opacity="0.3" />
        <circle
          cx="48" cy="48" r="40"
          fill="none"
          stroke={isLow ? '#ef4444' : 'var(--primary)'}
          strokeWidth="4"
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 48 48)"
          style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.3s ease' }}
        />
      </svg>
      <span className={`quiz-timer-text ${isLow ? 'quiz-timer-low' : ''}`}>
        {timeLeft}
      </span>
    </div>
  );
};

// ── Main QuizPlay Component ─────────────────────────────────────────────────
const QuizPlay = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // State machine: loading → preview → playing → submitting → results
  const [phase, setPhase] = useState('loading');
  const [quiz, setQuiz] = useState(null);
  const [error, setError] = useState('');

  // Playing state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [quizStartTime, setQuizStartTime] = useState(null);

  // Results state
  const [results, setResults] = useState(null);
  const [animatedScore, setAnimatedScore] = useState(0);

  const timerRef = useRef(null);

  // Fetch quiz data
  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/games/quizzes/${id}`);
        setQuiz(res.data);
        setPhase('preview');
      } catch (err) {
        setError('Quiz not found');
        setPhase('error');
      }
    };
    fetchQuiz();
  }, [id]);

  // Timer countdown
  useEffect(() => {
    if (phase !== 'playing' || timeLeft <= 0) return;

    timerRef.current = setTimeout(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — auto-advance
          handleAnswer(-1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timerRef.current);
  }, [phase, timeLeft]);

  // Score count-up animation
  useEffect(() => {
    if (phase !== 'results' || !results) return;
    const target = results.score;
    if (target === 0) return;

    let current = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setAnimatedScore(current);
    }, 50);

    return () => clearInterval(interval);
  }, [phase, results]);

  const startQuiz = () => {
    const initialAnswers = quiz.questions.map((_, i) => ({
      questionIndex: i,
      selectedIndex: -1,
      timeTakenMs: 0,
    }));
    setAnswers(initialAnswers);
    setCurrentIndex(0);
    setSelectedIndex(null);
    setTimeLeft(quiz.questions[0].timeLimit || 15);
    setQuestionStartTime(Date.now());
    setQuizStartTime(Date.now());
    setPhase('playing');
  };

  const handleAnswer = useCallback((optionIndex) => {
    if (phase !== 'playing') return;
    clearTimeout(timerRef.current);

    const elapsed = Date.now() - questionStartTime;

    setAnswers(prev => {
      const updated = [...prev];
      updated[currentIndex] = {
        questionIndex: currentIndex,
        selectedIndex: optionIndex,
        timeTakenMs: elapsed,
      };
      return updated;
    });

    setSelectedIndex(optionIndex);

    // Brief flash before advancing
    setTimeout(() => {
      if (currentIndex < quiz.questions.length - 1) {
        const nextIndex = currentIndex + 1;
        setCurrentIndex(nextIndex);
        setSelectedIndex(null);
        setTimeLeft(quiz.questions[nextIndex].timeLimit || 15);
        setQuestionStartTime(Date.now());
      } else {
        // Quiz complete — submit
        submitQuiz(currentIndex, optionIndex, elapsed);
      }
    }, 400);
  }, [phase, currentIndex, questionStartTime, quiz]);

  const submitQuiz = async (lastIndex, lastSelectedIndex, lastElapsed) => {
    setPhase('submitting');
    try {
      const finalAnswers = answers.map((a, i) => {
        if (i === lastIndex) {
          return { ...a, selectedIndex: lastSelectedIndex, timeTakenMs: lastElapsed };
        }
        return a;
      });

      const totalTime = Date.now() - quizStartTime;

      const res = await api.post(`/games/quizzes/${id}/submit`, {
        answers: finalAnswers,
        timeTakenMs: totalTime,
      });

      setResults(res.data);
      setAnimatedScore(0);
      setPhase('results');
    } catch (err) {
      setError('Failed to submit quiz. Please try again.');
      setPhase('error');
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '0s';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (phase === 'loading') {
    return (
      <div className="container" style={{ maxWidth: '700px', padding: '2rem 1rem' }}>
        <ThreadSkeleton />
      </div>
    );
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="container" style={{ maxWidth: '700px', padding: '2rem 1rem', textAlign: 'center' }}>
        <p style={{ color: '#EF4444', marginBottom: '1rem' }}>{error}</p>
        <Link to="/games" className="btn btn-secondary">
          <ChevronLeft size={18} style={{ marginRight: '0.5rem' }} /> Back to Games
        </Link>
      </div>
    );
  }

  // ── PREVIEW ───────────────────────────────────────────────────────────────
  if (phase === 'preview') {
    const totalTime = quiz.questions.reduce((sum, q) => sum + (q.timeLimit || 15), 0);
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '2rem 1rem' }}>
        <div className="btn-back-wrapper">
          <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/games')} className="btn-back-pill">
            <ChevronLeft size={16} /> {t('back')}
          </button>
        </div>
        <div className="games-card-glass" style={{ textAlign: 'center', padding: '3rem 2rem', borderLeft: 'none' }}>
          <div style={{ display: 'inline-flex', padding: '1.25rem', backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', borderRadius: '50%', marginBottom: '1.5rem', boxShadow: '0 4px 20px color-mix(in srgb, var(--primary) 15%, transparent)' }}>
            <Gamepad2 size={42} style={{ color: 'var(--primary)' }} />
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '0.75rem', letterSpacing: '-0.02em' }}>
            {quiz.title}
          </h1>
          {quiz.description && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem', lineHeight: '1.5', fontWeight: '500' }}>
              {quiz.description}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', marginBottom: '2.5rem', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', color: 'var(--primary)', marginBottom: '0.35rem' }}>
                <Target size={18} />
              </div>
              <span style={{ fontSize: '1.6rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: '1' }}>{quiz.questions.length}</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '0.2rem' }}>{t('games_questions')}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center', color: 'var(--primary)', marginBottom: '0.35rem' }}>
                <Clock size={18} />
              </div>
              <span style={{ fontSize: '1.6rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.01em', lineHeight: '1' }}>~{Math.ceil(totalTime / 60)}</span>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '0.2rem' }}>min</div>
            </div>
          </div>
          <button onClick={startQuiz} className="btn btn-primary" style={{ padding: '0.85rem 3rem', fontSize: '1.05rem', gap: '0.5rem', borderRadius: '9999px', fontWeight: '800' }}>
            <Play size={18} /> {t('games_start_quiz')}
          </button>
        </div>
      </div>
    );
  }

  // ── SUBMITTING ────────────────────────────────────────────────────────────
  if (phase === 'submitting') {
    return (
      <div className="container" style={{ maxWidth: '600px', padding: '4rem 1rem', textAlign: 'center' }}>
        <div className="quiz-loading-spinner" />
        <p style={{ color: 'var(--text-muted)', marginTop: '1.5rem', fontSize: '1.1rem', fontWeight: '600' }}>Scoring your quiz...</p>
      </div>
    );
  }

  // ── PLAYING ───────────────────────────────────────────────────────────────
  if (phase === 'playing') {
    const question = quiz.questions[currentIndex];
    const progress = ((currentIndex) / quiz.questions.length) * 100;

    return (
      <div className="container" style={{ maxWidth: '650px', padding: '2rem 1rem' }}>
        {/* Progress bar */}
        <div className="quiz-progress-bar" style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '9999px', overflow: 'hidden', border: '1px solid var(--surface-border)', marginBottom: '1.5rem' }}>
          <div className="quiz-progress-fill" style={{ height: '100%', background: 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 65%, #ffffff))', width: `${progress}%`, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)', boxShadow: '0 0 8px var(--primary)' }} />
        </div>

        {/* Header: question count + timer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('games_question')} {currentIndex + 1} / {quiz.questions.length}
          </span>
          <TimerRing timeLeft={timeLeft} maxTime={question.timeLimit || 15} />
        </div>

        {/* Question */}
        <div className="games-card-glass" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--text-main)', lineHeight: '1.4', letterSpacing: '-0.01em' }}>
            {question.questionText}
          </h2>
          {question.questionType === 'true_false' && (
            <span className="badge" style={{ marginTop: '0.75rem', fontSize: '0.7rem', backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 25%, transparent)' }}>True / False</span>
          )}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {question.options.map((option, i) => {
            const isSelected = selectedIndex === i;
            return (
              <button
                key={i}
                className={`quiz-option-btn ${isSelected ? 'quiz-option-selected' : ''}`}
                onClick={() => handleAnswer(i)}
                disabled={selectedIndex !== null}
                style={{ animationDelay: `${i * 0.05}s` }}
              >
                <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                <span className="quiz-option-text">{option}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (phase === 'results' && results) {
    const isPerfect = results.percentage === 100;
    const isGreat = results.percentage >= 70;

    return (
      <div className="container" style={{ maxWidth: '650px', padding: '2rem 1rem' }}>
        {isPerfect && <Confetti />}

        <div className="games-card-glass" style={{ textAlign: 'center', padding: '3rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden', borderLeft: 'none' }}>
          {/* Accent glow */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '4px',
            background: isPerfect ? 'linear-gradient(90deg, #10b981, #34d399, #10b981)' : isGreat ? 'linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #ffffff), var(--primary))' : 'linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b)'
          }} />

          <div style={{ marginBottom: '1.25rem' }}>
            {isPerfect ? (
              <span style={{ fontSize: '3.5rem' }}>🎉</span>
            ) : isGreat ? (
              <span style={{ fontSize: '3.5rem' }}>🌟</span>
            ) : (
              <span style={{ fontSize: '3.5rem' }}>💪</span>
            )}
          </div>

          <h2 style={{ fontSize: '1.75rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
            {isPerfect ? t('games_perfect') : isGreat ? 'Great Job!' : 'Good Effort!'}
          </h2>

          <div style={{ fontSize: '4.2rem', fontWeight: '900', color: isPerfect ? '#10b981' : 'var(--primary)', lineHeight: 1, marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>
            {animatedScore}/{results.totalQuestions}
          </div>
          <div style={{ fontSize: '1.3rem', color: 'var(--text-muted)', fontWeight: '700', marginBottom: '1.5rem' }}>
            {results.percentage}%
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: '600' }}>
              <Clock size={16} style={{ color: 'var(--primary)' }} /> {formatTime(results.timeTakenMs)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: '600' }}>
              <CheckCircle2 size={16} style={{ color: '#10b981' }} /> {results.score} correct
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.88rem', fontWeight: '600' }}>
              <XCircle size={16} style={{ color: '#ef4444' }} /> {results.totalQuestions - results.score} wrong
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => { setPhase('preview'); setResults(null); }} className="btn btn-secondary" style={{ gap: '0.4rem', borderRadius: '9999px', padding: '0.6rem 1.5rem' }}>
              <RotateCcw size={16} /> {t('games_try_again')}
            </button>
            <Link to="/games" className="btn btn-primary" style={{ gap: '0.4rem', borderRadius: '9999px', padding: '0.6rem 1.5rem', fontWeight: '700' }}>
              <Gamepad2 size={16} /> Back to Games
            </Link>
          </div>
        </div>

        {/* Answer Review */}
        <h3 style={{ fontSize: '1.25rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
          {t('games_review')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {results.results.map((r, i) => (
            <div key={i} className="games-card-glass" style={{ padding: '1rem 1.25rem', borderLeftWidth: '4px', borderLeftColor: r.isCorrect ? '#10b981' : '#ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.4rem' }}>
                {r.isCorrect ? (
                  <CheckCircle2 size={18} style={{ color: '#10b981', flexShrink: 0, marginTop: '2px' }} />
                ) : (
                  <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0, marginTop: '2px' }} />
                )}
                <span style={{ fontSize: '0.98rem', fontWeight: '700', color: 'var(--text-main)', lineHeight: '1.4' }}>
                  {r.questionText}
                </span>
              </div>
              <div style={{ marginLeft: '1.6rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {/* Chosen Answer (if wrong) */}
                {!r.isCorrect && r.selectedIndex >= 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: '#ef4444' }}>
                    <div style={{ fontWeight: '500' }}>
                      Your answer: <strong style={{ fontWeight: '700' }}>{String.fromCharCode(65 + r.selectedIndex)}. {r.options[r.selectedIndex]}</strong>
                    </div>
                    {r.explanations?.[r.selectedIndex] && (
                      <div style={{ fontStyle: 'italic', background: 'rgba(239, 68, 68, 0.03)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '8px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-main)', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', backdropFilter: 'blur(4px)' }}>
                        <span style={{ fontWeight: '800', flexShrink: 0 }}>❌</span>
                        <span>{r.explanations[r.selectedIndex]}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Timed out message */}
                {!r.isCorrect && r.selectedIndex === -1 && (
                  <div style={{ color: '#ef4444', fontStyle: 'italic', fontWeight: '600' }}>
                    Timed out
                  </div>
                )}

                {/* Correct Answer */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: '#10b981' }}>
                  <div style={{ fontWeight: '500' }}>
                    {r.isCorrect ? 'Correct: ' : 'Correct Answer: '}<strong style={{ fontWeight: '700' }}>{String.fromCharCode(65 + r.correctIndex)}. {r.options[r.correctIndex]}</strong>
                  </div>
                  {r.explanations?.[r.correctIndex] && (
                    <div style={{ fontStyle: 'italic', background: 'rgba(16, 185, 129, 0.03)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '8px', padding: '0.5rem 0.85rem', fontSize: '0.8rem', marginTop: '0.25rem', color: 'var(--text-main)', display: 'flex', gap: '0.4rem', alignItems: 'flex-start', backdropFilter: 'blur(4px)' }}>
                      <span style={{ fontWeight: '800', flexShrink: 0 }}>💡</span>
                      <span>{r.explanations[r.correctIndex]}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default QuizPlay;
