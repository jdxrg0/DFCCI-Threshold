import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, BookHeart, CheckCircle2, BookOpen, Flame, Target, MessageSquare, Calendar, Pencil, Trash2, X, Save, User, Clock, Heart, AlertTriangle, Info } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// ─── Inline styles for mobile-first premium look ────────────────────────────
const S = {
  page: {
    maxWidth: '540px',
    margin: '0 auto',
    padding: '0 0.75rem 2rem',
  },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600',
    padding: '0.6rem 0', marginBottom: '0.25rem',
    transition: 'color 0.2s',
  },
  card: {
    backgroundColor: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
  },
  heroBar: (status) => ({
    background: status === 'Acknowledged'
      ? 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 65%, #8B5CF6))'
      : status === 'Missed'
        ? 'linear-gradient(135deg, #64748b, #475569)'
        : 'linear-gradient(135deg, #F59E0B, #FB923C)',
    padding: '1.25rem 1rem',
    display: 'flex', flexDirection: 'column',
    gap: '0.75rem', color: '#fff',
  }),
  heroHeaderRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
  },
  heroTitleRow: {
    display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0,
    fontSize: '1.2rem', fontWeight: '900',
  },
  heroBadge: (status) => ({
    backgroundColor: status === 'Acknowledged' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
    color: '#fff', fontSize: '0.7rem', fontWeight: '800',
    padding: '0.25rem 0.6rem', borderRadius: '999px',
    display: 'flex', alignItems: 'center', gap: '0.2rem',
  }),
  heroMeta: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    fontSize: '0.8rem', fontWeight: '600', color: 'rgba(255,255,255,0.9)',
    flexWrap: 'wrap',
  },
  body: {
    padding: '1.25rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: '0.6px', color: 'var(--primary)', marginBottom: '0.5rem',
  },
  readBox: {
    backgroundColor: 'color-mix(in srgb, var(--primary) 4%, transparent)',
    border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
    borderRadius: '12px', padding: '0.85rem 1rem',
    color: 'var(--text-main)', fontSize: '0.95rem', lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  passageBox: {
    backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
    border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
    borderRadius: '12px', padding: '0.75rem 1rem',
    color: 'var(--text-main)', fontSize: '1rem', fontWeight: '700',
  },
  editTextarea: {
    width: '100%', boxSizing: 'border-box',
    padding: '0.75rem 1rem', fontSize: '0.95rem',
    backgroundColor: 'var(--bg-color)',
    border: '1.5px solid var(--primary)',
    borderRadius: '12px', color: 'var(--text-main)',
    fontFamily: 'inherit', lineHeight: '1.6', resize: 'vertical',
    outline: 'none', boxShadow: '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)',
  },
  leaderNote: {
    backgroundColor: 'color-mix(in srgb, #10B981 8%, transparent)',
    border: '1px solid color-mix(in srgb, #10B981 30%, transparent)',
    borderRadius: '12px', padding: '1rem',
    position: 'relative', overflow: 'hidden',
  },
  leaderNoteIcon: {
    position: 'absolute', top: '-10px', right: '-10px',
    color: 'color-mix(in srgb, #10B981 10%, transparent)',
  },
  actionRow: {
    display: 'flex', gap: '0.5rem', marginTop: '0.5rem',
  },
  btnSecondary: {
    flex: 1, padding: '0.65rem', fontSize: '0.82rem', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
    borderRadius: '10px', border: '1.5px solid var(--border-color)',
    backgroundColor: 'var(--card-bg)', color: 'var(--text-main)',
    cursor: 'pointer', transition: 'background-color 0.2s', fontFamily: 'inherit',
  },
  btnPrimary: {
    flex: 1, padding: '0.65rem', fontSize: '0.82rem', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
    borderRadius: '10px', border: 'none',
    background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))',
    color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 2px 10px color-mix(in srgb, var(--primary) 30%, transparent)',
  },
  btnDanger: {
    flex: 1, padding: '0.65rem', fontSize: '0.82rem', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
    borderRadius: '10px', border: 'none',
    backgroundColor: 'color-mix(in srgb, #EF4444 15%, transparent)',
    color: '#EF4444', cursor: 'pointer', fontFamily: 'inherit',
  },
  btnDangerSolid: {
    flex: 1, padding: '0.65rem', fontSize: '0.82rem', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
    borderRadius: '10px', border: 'none',
    backgroundColor: '#EF4444', color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 2px 10px color-mix(in srgb, #EF4444 30%, transparent)',
  },
  alertDanger: {
    padding: '1rem', marginBottom: '1.25rem',
    backgroundColor: 'color-mix(in srgb, #EF4444 8%, transparent)',
    border: '1px solid color-mix(in srgb, #EF4444 25%, transparent)',
    borderRadius: '12px', textAlign: 'center',
  },
};

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const DevotionalView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [devotional, setDevotional] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Leader acknowledgment
  const [ackNote, setAckNote] = useState('');
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState('');

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ book: '', passageStr: '', summary: '', application: '', prayerFocus: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isLeader = ['ADMIN', 'COUNSELOR'].includes(user?.role);

  useEffect(() => {
    const fetchDevotional = async () => {
      try {
        const res = await api.get(`/devotionals/${id}`);
        setDevotional(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load devotional');
      } finally {
        setLoading(false);
      }
    };
    fetchDevotional();
  }, [id]);

  const handleAcknowledge = async () => {
    if (ackLoading) return;
    setAckLoading(true);
    setAckError('');
    try {
      const res = await api.put(`/devotionals/${id}/acknowledge`, { note: ackNote });
      setDevotional(res.data.devotional);
      setAckNote('');
    } catch (err) {
      setAckError(err.response?.data?.message || 'Failed to acknowledge');
    } finally {
      setAckLoading(false);
    }
  };

  const startEditing = () => {
    let defaultPassageStr = '';
    if (devotional.book && devotional.passage) {
       if (devotional.passage.startsWith(devotional.book)) {
           defaultPassageStr = devotional.passage.slice(devotional.book.length).trim();
       } else {
           defaultPassageStr = devotional.passage;
       }
    } else {
       defaultPassageStr = devotional.passage || '';
    }

    setEditForm({
      book: devotional.book || 'Genesis',
      passageStr: defaultPassageStr,
      summary: devotional.summary,
      application: devotional.application,
      prayerFocus: devotional.prayerFocus || '',
    });
    setEditError('');
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (editLoading) return;
    if (!editForm.book.trim() || !editForm.passageStr.trim() || !editForm.summary.trim() || !editForm.application.trim()) {
      setEditError(t('devo_edit_fill_required') || 'Please fill in all required fields.');
      return;
    }
    setEditLoading(true);
    setEditError('');
    try {
      const res = await api.put(`/devotionals/${id}`, editForm);
      setDevotional(res.data.devotional);
      setEditing(false);
    } catch (err) {
      setEditError(err.response?.data?.message || 'Failed to save changes');
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = async () => {
    if (deleteLoading) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/devotionals/${id}`);
      navigate('/devotionals');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete');
      setShowDeleteConfirm(false);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={S.page}>
        <div className="skeleton-title" style={{ width: '40%', marginBottom: '1rem' }}></div>
        <div className="skeleton-title" style={{ width: '100%', height: '300px', borderRadius: '16px' }}></div>
      </div>
    );
  }

  if (error && !devotional) {
    return (
      <div style={{ ...S.page, textAlign: 'center', paddingTop: '4rem' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}><AlertTriangle size={48} color="#EF4444" /></div>
        <p style={{ color: '#EF4444', fontWeight: '600', marginBottom: '1.5rem' }}>{error}</p>
        <button onClick={() => navigate('/devotionals')} style={S.btnSecondary} className="mx-auto" style={{ maxWidth: '200px' }}>
          <ChevronLeft size={16} /> {t('devo_back_to_dashboard')}
        </button>
      </div>
    );
  }

  const isOwner = devotional?.member?._id === user?._id;
  const isAcknowledged = devotional?.status === 'Acknowledged';
  const isMissed = devotional?.status === 'Missed';
  const hasBeenAcknowledged = isAcknowledged || !!devotional?.acknowledgedBy;
  const canEdit = isOwner && !hasBeenAcknowledged && !isMissed;
  const canDelete = isOwner && !hasBeenAcknowledged;

  return (
    <div style={S.page}>
      <div className="btn-back-wrapper">
        <button onClick={() => navigate('/devotionals')} className="btn-back-pill">
          <ChevronLeft size={16} /> {t('devo_back_to_dashboard')}
        </button>
      </div>

      {error && <div style={{ color: '#EF4444', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center', fontWeight: '600' }}>{error}</div>}

      <div style={S.card}>
        {/* ── Gradient Hero Header ── */}
        <div style={S.heroBar(devotional.status)}>
          <div style={S.heroHeaderRow}>
            <h2 style={S.heroTitleRow}>
              <BookHeart size={20} /> {t('devo_detail_title')}
            </h2>
            <div style={S.heroBadge(devotional.status)}>
              {devotional.status === 'Acknowledged' ? (
                <CheckCircle2 size={12} />
              ) : devotional.status === 'Missed' ? (
                <AlertTriangle size={12} />
              ) : (
                <Clock size={12} />
              )}
              {devotional.status === 'Acknowledged'
                ? t('devo_status_acknowledged')
                : devotional.status === 'Missed'
                  ? t('devo_status_missed') || 'Missed'
                  : t('devo_status_submitted')}
            </div>
          </div>
          <div style={S.heroMeta}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Calendar size={14} /> {format(new Date(devotional.date), 'EEEE, MMM d, yyyy')}
            </span>
            {isLeader && !isOwner && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', backgroundColor: 'rgba(0,0,0,0.15)', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>
                <User size={12} /> {devotional.member?.displayName || 'Unknown'}
              </span>
            )}
          </div>
        </div>

        {/* ── Form Body ── */}
        <div style={S.body}>
          
          {/* Owner action buttons (edit / delete) */}
          {(canEdit || canDelete) && !editing && (
            <div style={S.actionRow}>
              {canEdit && (
                <button onClick={startEditing} style={S.btnSecondary}>
                  <Pencil size={15} /> {t('edit')}
                </button>
              )}
              {canDelete && (
                <button onClick={() => setShowDeleteConfirm(true)} style={S.btnDanger}>
                  <Trash2 size={15} /> {t('delete')}
                </button>
              )}
            </div>
          )}

          {/* Delete confirmation alert */}
          {showDeleteConfirm && (
            <div style={S.alertDanger}>
              <p style={{ fontSize: '0.9rem', fontWeight: '700', color: '#EF4444', margin: '0 0 1rem 0' }}>
                {t('devo_delete_confirm')}
              </p>
              <div style={S.actionRow}>
                <button onClick={() => setShowDeleteConfirm(false)} style={S.btnSecondary}>
                  {t('cancel')}
                </button>
                <button onClick={handleDelete} disabled={deleteLoading} style={{ ...S.btnDangerSolid, opacity: deleteLoading ? 0.7 : 1 }}>
                  <Trash2 size={15} /> {deleteLoading ? '...' : t('devo_delete_btn')}
                </button>
              </div>
            </div>
          )}

          {/* Edit mode save/cancel bar */}
          {editing && (
            <div style={{
              display: 'flex', gap: '0.5rem', marginBottom: '0.5rem',
              padding: '0.75rem', borderRadius: '12px',
              backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            }}>
              <button onClick={() => { setEditing(false); setEditError(''); }} style={S.btnSecondary}>
                <X size={15} /> {t('cancel')}
              </button>
              <button onClick={handleSaveEdit} disabled={editLoading} style={{ ...S.btnPrimary, opacity: editLoading ? 0.7 : 1 }}>
                <Save size={15} /> {editLoading ? '...' : t('save')}
              </button>
            </div>
          )}

          {editError && (
            <div style={{ fontSize: '0.82rem', color: '#EF4444', fontWeight: '700', padding: '0.5rem', textAlign: 'center' }}>
              {editError}
            </div>
          )}

          {/* ── Scripture Passage ── */}
          <div>
            <div style={S.sectionHeader}>
              <BookOpen size={14} /> {t('devo_passage_label')}
            </div>
            {editing ? (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <select
                    value={editForm.book}
                    onChange={(e) => setEditForm({ ...editForm, book: e.target.value })}
                    style={{ ...S.editTextarea, padding: '0.6rem', flex: 2 }}
                  >
                    <option value="" disabled>Select Book</option>
                    <optgroup label="Old Testament">
                      {BIBLE_BOOKS.slice(0, 39).map(b => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                    <optgroup label="New Testament">
                      {BIBLE_BOOKS.slice(39).map(b => <option key={b} value={b}>{b}</option>)}
                    </optgroup>
                  </select>
                  <input
                    type="text"
                    value={editForm.passageStr}
                    placeholder="Chap / Verses (e.g. 1-2, or 1:1-10)"
                    onChange={(e) => setEditForm({ ...editForm, passageStr: e.target.value })}
                    style={{ ...S.editTextarea, padding: '0.6rem', flex: 1 }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.25rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.4' }}>
                  <Info size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                  <span><strong>Supported formats:</strong> Single chapter (<code>1</code>), multiple chapters (<code>1-3</code>), specific verses (<code>1:1-10</code>), or complex ranges (<code>1, 2:1-5</code>).</span>
                </div>
              </>
            ) : (
              <div style={S.passageBox}>
                {devotional.passage}
              </div>
            )}
          </div>

          {/* ── Summary ── */}
          <div>
            <div style={S.sectionHeader}>
              <Flame size={14} /> {t('devo_summary_label')}
            </div>
            {editing ? (
              <textarea
                value={editForm.summary}
                onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
                rows={4}
                style={S.editTextarea}
              />
            ) : (
              <div style={S.readBox}>
                {devotional.summary}
              </div>
            )}
          </div>

          {/* ── Application ── */}
          <div>
            <div style={S.sectionHeader}>
              <Target size={14} /> {t('devo_application_label')}
            </div>
            {editing ? (
              <textarea
                value={editForm.application}
                onChange={(e) => setEditForm({ ...editForm, application: e.target.value })}
                rows={3}
                style={S.editTextarea}
              />
            ) : (
              <div style={S.readBox}>
                {devotional.application}
              </div>
            )}
          </div>

          {/* ── Prayer Focus ── */}
          {(editing || devotional.prayerFocus) && (
            <div>
              <div style={S.sectionHeader}>
                <Heart size={14} /> {t('devo_prayer_label')}
              </div>
              {editing ? (
                <textarea
                  value={editForm.prayerFocus}
                  onChange={(e) => setEditForm({ ...editForm, prayerFocus: e.target.value })}
                  rows={2}
                  placeholder={t('devo_prayer_placeholder')}
                  style={S.editTextarea}
                />
              ) : (
                <div style={{ ...S.readBox, fontStyle: 'italic', color: 'color-mix(in srgb, var(--text-main) 85%, transparent)' }}>
                  {devotional.prayerFocus}
                </div>
              )}
            </div>
          )}

          {/* ── Leader Note (If Acknowledged) ── */}
          {hasBeenAcknowledged && devotional.leaderNote && (
            <div style={{ marginTop: '0.5rem' }}>
              <div style={S.sectionHeader}>
                <MessageSquare size={14} /> {t('devo_leader_note')}
              </div>
              <div style={S.leaderNote}>
                <MessageSquare size={60} style={S.leaderNoteIcon} />
                <p style={{ margin: 0, position: 'relative', zIndex: 1, fontSize: '0.95rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                  "{devotional.leaderNote}"
                </p>
                <div style={{ marginTop: '0.75rem', position: 'relative', zIndex: 1, fontSize: '0.78rem', fontWeight: '700', color: '#10B981' }}>
                  — {devotional.acknowledgedBy?.displayName || 'Leader'}
                  {devotional.acknowledgedAt && ` • ${format(new Date(devotional.acknowledgedAt), 'MMM d, yyyy')}`}
                </div>
              </div>
            </div>
          )}

          {/* ── Leader Action (Acknowledge) ── */}
          {isLeader && !hasBeenAcknowledged && (
            <div style={{ marginTop: '1rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--primary)', fontWeight: '800', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                <CheckCircle2 size={18} /> {t('devo_acknowledge_title')}
              </div>
              {ackError && <div style={{ color: '#EF4444', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.5rem' }}>{ackError}</div>}
              
              <textarea
                placeholder={t('devo_ack_note_placeholder')}
                value={ackNote}
                onChange={(e) => setAckNote(e.target.value)}
                rows={2}
                style={{ ...S.editTextarea, marginBottom: '0.75rem' }}
              />
              
              <button onClick={handleAcknowledge} disabled={ackLoading} style={{ ...S.btnPrimary, opacity: ackLoading ? 0.7 : 1 }}>
                <CheckCircle2 size={16} />
                {ackLoading ? t('loading') : t('devo_acknowledge_btn')}
              </button>
            </div>
          )}

          {/* ── Acknowledgment receipt for owner ── */}
          {isOwner && hasBeenAcknowledged && !devotional.leaderNote && (
            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontWeight: '600' }}>
              {t('devo_acknowledged_by')}: <span style={{ color: 'var(--text-main)' }}>{devotional.acknowledgedBy?.displayName || 'Leader'}</span>
              {devotional.acknowledgedAt && ` • ${format(new Date(devotional.acknowledgedAt), 'MMM d, yyyy')}`}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default DevotionalView;
