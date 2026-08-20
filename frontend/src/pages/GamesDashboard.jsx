import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Trophy, BarChart3, Plus, Play, Users, Flame, Clock, ChevronLeft, Star, Target, Zap } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import ThreadSkeleton from '../components/ThreadSkeleton';
import PageHeader from '../components/PageHeader';
import ModuleTabs from '../components/ModuleTabs';

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

  const TABS = [
    { id: 'quizzes', label: t('games_quizzes'), short: 'Quizzes', Icon: Gamepad2 },
    { id: 'leaderboard', label: t('games_leaderboard'), short: 'Ranks', Icon: Trophy },
    { id: 'my_stats', label: t('games_my_stats'), short: 'My Stats', Icon: BarChart3 },
  ];

  return (
    <div className="container module-shell" style={{ padding: 0 }}>
      {/* ── BREATHTAKING MESH GRADIENT GAMES BANNER ── */}
      <div className="games-hero-banner">
        <PageHeader
          className="page-header--flush"
          icon={Gamepad2}
          title={t('games_dashboard')}
          subtitle="Test your knowledge, challenge the community, and climb the spiritual ranks!"
          actions={
            isAdmin && (
              <Link to="/games/create" className="btn btn-primary page-header-btn-icon" title={t('games_create_quiz')}>
                <Plus size={16} />
              </Link>
            )
          }
        />
      </div>

      {/* Tab Bar */}
      <ModuleTabs
        tabs={TABS}
        activeId={activeTab}
        onChange={setActiveTab}
        ariaLabel="Games sections"
      />

      {error && <p style={{ color: '#EF4444', marginBottom: '1rem', fontWeight: '600' }}>{error}</p>}

      <div style={{ minHeight: '400px', position: 'relative', opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s ease', pointerEvents: loading ? 'none' : 'auto' }}>

        {/* ── Quizzes Tab ── */}
        {activeTab === 'quizzes' && (
          loading ? <ThreadSkeleton /> : quizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <Gamepad2 size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem', opacity: 0.5 }} />
              <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>{t('games_no_quizzes')}</p>
              {isAdmin && (
                <Link to="/games/create" className="btn btn-primary" style={{ marginTop: '1rem', borderRadius: '9999px' }}>
                  <Plus size={16} style={{ marginRight: '0.4rem' }} /> {t('games_create_quiz')}
                </Link>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {quizzes.map(quiz => (
                <div key={quiz._id} className="games-card-glass" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', cursor: 'pointer' }}
                  onClick={() => navigate(`/games/play/${quiz._id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '0.25rem', lineHeight: '1.2', letterSpacing: '-0.02em' }}>
                        {quiz.title}
                      </h3>
                      {quiz.description && (
                        <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: '1.4', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {quiz.description}
                        </p>
                      )}
                    </div>
                    {!quiz.isPublished && isAdmin && (
                      <span className="badge" style={{ fontSize: '0.7rem', flexShrink: 0, backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)', borderColor: 'color-mix(in srgb, var(--primary) 30%, transparent)' }}>Draft</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span className="badge" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}>{quiz.category}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500' }}>
                      <Target size={13} style={{ color: 'var(--primary)' }} /> {quiz.questionCount} {t('games_questions')}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500' }}>
                      <Users size={13} style={{ color: 'var(--primary)' }} /> {quiz.playCount} {quiz.playCount === 1 ? 'play' : 'plays'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.6rem' }}>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                      {format(new Date(quiz.createdAt), 'MMM d, yyyy')}
                    </span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isAdmin && (
                        <Link 
                          to={`/games/edit/${quiz._id}`}
                          className="btn btn-secondary"
                          style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', borderRadius: '9999px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('edit')}
                        </Link>
                      )}
                      <span className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem', borderRadius: '9999px', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '700' }}>
                        <Play size={12} /> {t('games_start_quiz')}
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
                <div className="games-podium" style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: '1rem', marginBottom: '2.5rem', padding: '1rem 0' }}>
                  {[1, 0, 2].map(rank => {
                    const entry = leaderboard[rank];
                    if (!entry) return null;
                    const heights = { 0: '120px', 1: '95px', 2: '75px' };
                    const colors = { 0: '#ffd700', 1: '#c0c0c0', 2: '#cd7f32' };
                    const isMe = entry._id === user?._id;
                    return (
                      <div key={rank} className="games-podium-column-glass">
                        <span style={{ fontSize: rank === 0 ? '1.8rem' : '1.4rem' }}>{['🥇', '🥈', '🥉'][rank]}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: '800', color: isMe ? 'var(--primary)' : 'var(--text-main)', textAlign: 'center', lineHeight: '1.2' }}>
                          {entry.displayName}
                        </span>
                        <div 
                          className="games-podium-tower" 
                          style={{
                            height: heights[rank],
                            background: `linear-gradient(180deg, color-mix(in srgb, ${colors[rank]} 22%, transparent) 0%, color-mix(in srgb, ${colors[rank]} 6%, transparent) 100%)`,
                            border: `1px solid color-mix(in srgb, ${colors[rank]} 40%, transparent)`
                          }}
                        >
                          <span style={{ fontSize: '1.6rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: '1' }}>{entry.totalScore}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>{entry.avgPercentage}% avg</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Full list */}
              <div className="games-card-glass" style={{ padding: 0, borderLeft: 'none' }}>
                {leaderboard.map((entry, index) => {
                  const isMe = entry._id === user?._id;
                  return (
                    <div key={entry._id}
                      className={isMe ? 'leaderboard-self' : ''}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        padding: '0.85rem 1.25rem',
                        borderBottom: index < leaderboard.length - 1 ? '1px solid var(--surface-border)' : 'none',
                        background: isMe ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'transparent',
                      }}
                    >
                      <span style={{ minWidth: '32px', display: 'flex', justifyContent: 'center' }}>{getRankIcon(index)}</span>
                      <span style={{ flex: 1, fontWeight: isMe ? '800' : '600', color: isMe ? 'var(--primary)' : 'var(--text-main)', fontSize: '0.92rem' }}>
                        {entry.displayName} {isMe && `(${t('me') || 'You'})`}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontWeight: '500' }}>
                        <Gamepad2 size={13} style={{ color: 'var(--primary)' }} /> {entry.quizzesPlayed}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{entry.avgPercentage}%</span>
                      <span style={{ fontWeight: '850', fontSize: '1.05rem', color: 'var(--primary)', minWidth: '40px', textAlign: 'right' }}>{entry.totalScore}</span>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                <div className="games-stat-tile-glass">
                  <Gamepad2 size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.8rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{myStats.quizzesPlayed}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('games_quizzes_played')}</div>
                </div>
                <div className="games-stat-tile-glass">
                  <Star size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.8rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{myStats.totalScore}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('games_total_score')}</div>
                </div>
                <div className="games-stat-tile-glass">
                  <Target size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.8rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>{myStats.avgPercentage}%</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('games_avg_score')}</div>
                </div>
                <div className="games-stat-tile-glass">
                  <Flame size={24} style={{ color: 'var(--primary)', marginBottom: '0.5rem' }} />
                  <div style={{ fontSize: '1.8rem', fontWeight: '850', color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
                    {myStats.currentStreak}
                    {myStats.currentStreak > 0 && <span style={{ marginLeft: '0.25rem' }}>🔥</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '700' }}>{t('games_streak')}</div>
                </div>
              </div>

              {/* Recent Attempts */}
              <h3 style={{ fontSize: '1.2rem', fontWeight: '850', color: 'var(--text-main)', marginBottom: '0.85rem', letterSpacing: '-0.02em' }}>
                {t('games_recent_attempts')}
              </h3>
              {myStats.recentAttempts.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                  {t('games_no_attempts')}
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {myStats.recentAttempts.map(attempt => (
                    <div key={attempt._id} className="games-card-glass" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderLeft: `4px solid ${attempt.percentage === 100 ? '#10b981' : attempt.percentage >= 70 ? 'var(--primary)' : '#f59e0b'}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                          {attempt.quizTitle}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem', fontWeight: '500' }}>
                          <span>{format(new Date(attempt.createdAt), 'MMM d, yyyy h:mm a')}</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} style={{ color: 'var(--primary)' }} /> {formatTime(attempt.timeTakenMs)}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: '850', color: attempt.percentage === 100 ? '#10b981' : 'var(--primary)', letterSpacing: '-0.02em', lineHeight: '1.1' }}>
                          {attempt.score}/{attempt.totalQuestions}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600' }}>
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
