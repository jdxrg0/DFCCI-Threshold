import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Trophy, BarChart3, BookOpen, Plus, Play, Users, Flame, Clock, ChevronLeft, Star, Target, Zap } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThreadSkeleton from '../components/ThreadSkeleton';

const GamesDashboard = () => {
  const [activeTab, setActiveTab] = useState(() => localStorage.getItem('games_activeTab') || 'quizzes');
  const [quizzes, setQuizzes] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    setLoading(true);
    setError('');
    if (activeTab === 'quizzes') fetchQuizzes();
    else if (activeTab === 'leaderboard') fetchLeaderboard();
    else if (activeTab === 'my_stats') fetchMyStats();
    localStorage.setItem('games_activeTab', activeTab);
  }, [activeTab]);

  const fetchQuizzes = async () => {
    try {
      const res = await api.get('/games/quizzes');
      setQuizzes(res.data);
    } catch (err) {
      setError('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await api.get('/games/leaderboard');
      setLeaderboard(res.data);
    } catch (err) {
      setError('Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchMyStats = async () => {
    try {
      const res = await api.get('/games/my-stats');
      setMyStats(res.data);
    } catch (err) {
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (ms) => {
    if (!ms) return '—';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
  };

  const getRankIcon = (index) => {
    if (index === 0) return <span style={{ fontSize: '1.2rem' }}>🥇</span>;
    if (index === 1) return <span style={{ fontSize: '1.2rem' }}>🥈</span>;
    if (index === 2) return <span style={{ fontSize: '1.2rem' }}>🥉</span>;
    return <span style={{ color: 'var(--text-muted)', fontWeight: '700', fontSize: '0.85rem' }}>#{index + 1}</span>;
  };

  return (
    <div className="container mirror-dashboard-container" style={{ maxWidth: '800px' }}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="dashboard-title" style={{ fontSize: '2rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Gamepad2 size={28} /> {t('games_dashboard')}
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to="/docs/games" className="btn btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Help & Documentation">
            <BookOpen size={20} />
          </Link>
          {isAdmin && (
            <Link to="/games/create" className="btn btn-primary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={t('games_create_quiz')}>
              <Plus size={20} />
            </Link>
          )}
        </div>
      </div>

      {/* Tab Bar */}
      <div className="dashboard-tabs" style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { key: 'quizzes', label: t('games_quizzes'), Icon: Gamepad2 },
          { key: 'leaderboard', label: t('games_leaderboard'), Icon: Trophy },
          { key: 'my_stats', label: t('games_my_stats'), Icon: BarChart3 },
        ].map(({ key, label, Icon }) => (
          <button
            key={key}
            className="dashboard-tab-btn"
            onClick={() => setActiveTab(key)}
            style={{
              padding: '0.75rem 1rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              borderBottom: activeTab === key ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === key ? 'var(--primary)' : 'var(--text-muted)',
            }}
            title={label}
          >
            <span className="dashboard-tab-content" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Icon size={20} className="dashboard-tab-icon" />
              <span className="dashboard-tab-label" style={{ fontSize: '0.9rem', fontWeight: activeTab === key ? 'bold' : 'normal' }}>{label}</span>
            </span>
          </button>
        ))}
      </div>

      {error && <p style={{ color: '#EF4444' }}>{error}</p>}

      <div style={{ minHeight: '400px', position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s ease', pointerEvents: loading ? 'none' : 'auto' }}>

        {/* ── Quizzes Tab ── */}
        {activeTab === 'quizzes' && (
          loading ? <ThreadSkeleton /> : quizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Gamepad2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{t('games_no_quizzes')}</p>
              {isAdmin && (
                <Link to="/games/create" className="btn btn-primary" style={{ marginTop: '1rem' }}>
                  <Plus size={18} style={{ marginRight: '0.5rem' }} /> {t('games_create_quiz')}
                </Link>
              )}
            </div>
          ) : (
            <div className="games-quiz-grid">
              {quizzes.map(quiz => (
                <div key={quiz._id} className="card quiz-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--primary)', padding: '1rem 1.25rem', cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' }}
                  onClick={() => navigate(`/games/play/${quiz._id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '0.25rem', lineHeight: '1.2' }}>
                        {quiz.title}
                      </h3>
                      {quiz.description && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {quiz.description}
                        </p>
                      )}
                    </div>
                    {!quiz.isPublished && isAdmin && (
                      <span className="badge" style={{ fontSize: '0.7rem', flexShrink: 0, backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', borderColor: '#f59e0b' }}>Draft</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}>{quiz.category}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Target size={13} /> {quiz.questionCount} {t('games_questions')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Users size={13} /> {quiz.playCount} {quiz.playCount === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {format(new Date(quiz.createdAt), 'MMM d, yyyy')}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {isAdmin && (
                        <Link 
                          to={`/games/edit/${quiz._id}`}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('edit')}
                        </Link>
                      )}
                      <span className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Play size={13} /> {t('games_start_quiz')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Leaderboard Tab ── */}
        {activeTab === 'leaderboard' && (
          loading ? <ThreadSkeleton /> : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Trophy size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No scores yet. Be the first to play!</p>
            </div>
          ) : (
            <div>
              {/* Podium - top 3 */}
              {leaderboard.length >= 3 && (
                <div className="games-podium" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '2rem', padding: '1rem 0' }}>
                  {[1, 0, 2].map(rank => {
                    const entry = leaderboard[rank];
                    if (!entry) return null;
                    const heights = { 0: '120px', 1: '90px', 2: '70px' };
                    const colors = { 0: '#FFD700', 1: '#C0C0C0', 2: '#CD7F32' };
                    const isMe = entry._id === user?._id;
                    return (
                      <div key={rank} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: '1', maxWidth: '140px' }}>
                        <span style={{ fontSize: rank === 0 ? '1.8rem' : '1.4rem' }}>{['🥇', '🥈', '🥉'][rank]}</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isMe ? 'var(--primary)' : 'var(--text-main)', textAlign: 'center', lineHeight: '1.2' }}>
                          {entry.displayName}
                        </span>
                        <div style={{
                          width: '100%',
                          height: heights[rank],
                          background: `linear-gradient(180deg, ${colors[rank]}33 0%, ${colors[rank]}11 100%)`,
                          border: `1px solid ${colors[rank]}44`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}>
                          <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)' }}>{entry.totalScore}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{entry.avgPercentage}% avg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full list */}
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                {leaderboard.map((entry, index) => {
                  const isMe = entry._id === user?._id;
                  return (
                    <div key={entry._id}
                      className={isMe ? 'leaderboard-self' : ''}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.75rem 1rem',
                        borderBottom: index < leaderboard.length - 1 ? '1px solid var(--border-color)' : 'none',
                        background: isMe ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                      }}
                    >
                      <span style={{ minWidth: '32px', textAlign: 'center' }}>{getRankIcon(index)}</span>
                      <span style={{ flex: 1, fontWeight: isMe ? '700' : '500', color: isMe ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.9rem' }}>
                        {entry.displayName} {isMe && '(You)'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Gamepad2 size={13} /> {entry.quizzesPlayed}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{entry.avgPercentage}%</span>
                      <span style={{ fontWeight: '800', fontSize: '1rem', color: 'var(--primary)', minWidth: '40px', textAlign: 'right' }}>{entry.totalScore}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* ── My Stats Tab ── */}
        {activeTab === 'my_stats' && (
          loading ? <ThreadSkeleton /> : myStats === null ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Could not load stats.</p>
          ) : (
            <div>
              {/* Stats Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <Gamepad2 size={22} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>{myStats.quizzesPlayed}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('games_quizzes_played')}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <Star size={22} style={{ color: '#f59e0b', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>{myStats.totalScore}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('games_total_score')}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <Target size={22} style={{ color: '#10b981', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>{myStats.avgPercentage}%</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('games_avg_score')}</div>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: '1rem' }}>
                  <Flame size={22} style={{ color: '#ef4444', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {myStats.currentStreak}
                    {myStats.currentStreak > 0 && <span style={{ marginLeft: '0.25rem' }}>🔥</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>{t('games_streak')}</div>
                </div>
              </div>

              {/* Recent Attempts */}
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-main)', marginBottom: '0.75rem' }}>
                {t('games_recent_attempts')}
              </h3>
              {myStats.recentAttempts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                  {t('games_no_attempts')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {myStats.recentAttempts.map(attempt => (
                    <div key={attempt._id} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderLeft: `4px solid ${attempt.percentage === 100 ? '#10b981' : attempt.percentage >= 70 ? 'var(--primary)' : '#f59e0b'}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {attempt.quizTitle}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.2rem' }}>
                          <span>{format(new Date(attempt.createdAt), 'MMM d, yyyy h:mm a')}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} /> {formatTime(attempt.timeTakenMs)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.1rem', fontWeight: '800', color: attempt.percentage === 100 ? '#10b981' : 'var(--primary)' }}>
                          {attempt.score}/{attempt.totalQuestions}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {attempt.percentage}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default GamesDashboard;
