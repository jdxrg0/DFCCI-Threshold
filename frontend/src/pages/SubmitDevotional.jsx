import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookHeart, Send, BookOpen, Flame, Target, Calendar, Heart, Info, Zap, AlertTriangle } from 'lucide-react';
import api from '../api';
import useFormPersist from '../hooks/useFormPersist';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

// ─── Inline styles (mobile-first, no external CSS needed) ───────────────────
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
    borderRadius: 'var(--radius-md, 12px)',
    overflow: 'hidden',
  },
  heroBar: {
    background: 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 70%, #000))',
    padding: '1.25rem 1rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: '0.4rem', textAlign: 'center',
  },
  heroTitle: {
    color: '#fff', fontSize: '1.15rem', fontWeight: '800',
    margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  heroVerse: {
    color: 'rgba(255,255,255,0.8)', fontSize: '0.78rem', fontStyle: 'italic',
    margin: 0, lineHeight: '1.5', maxWidth: '360px',
  },
  heroRef: {
    color: 'rgba(255,255,255,0.6)', fontSize: '0.68rem', fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0,
  },
  body: {
    padding: '1.25rem 1rem 1rem',
    display: 'flex', flexDirection: 'column', gap: '1.25rem',
  },
  error: {
    fontSize: '0.82rem', color: '#EF4444', fontWeight: '600',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'color-mix(in srgb, #EF4444 8%, transparent)',
    borderRadius: '8px', border: '1px solid color-mix(in srgb, #EF4444 20%, transparent)',
    textAlign: 'center',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    fontSize: '0.72rem', fontWeight: '800', textTransform: 'uppercase',
    letterSpacing: '0.6px', color: 'var(--primary)', marginBottom: '0.4rem',
  },
  datePillRow: {
    display: 'flex', gap: '0.5rem',
  },
  datePill: (active, hasError) => ({
    flex: 1, padding: '0.6rem 0.25rem',
    borderRadius: '10px', border: '2px solid',
    borderColor: hasError ? '#EF4444' : active ? 'var(--primary)' : 'var(--border-color)',
    backgroundColor: active ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
    cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem',
  }),
  datePillDay: (active) => ({
    fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: '0.4px',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
  }),
  datePillNum: (active) => ({
    fontSize: '1.3rem', fontWeight: '900', lineHeight: 1,
    color: active ? 'var(--primary)' : 'var(--text-main)',
  }),
  datePillMonth: (active) => ({
    fontSize: '0.62rem', fontWeight: '600',
    color: active ? 'var(--primary)' : 'var(--text-muted)',
  }),
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '0.7rem 0.85rem', fontSize: '0.95rem',
    backgroundColor: 'color-mix(in srgb, var(--primary) 4%, var(--card-bg))',
    border: '1.5px solid var(--border-color)',
    borderRadius: '10px', color: 'var(--text-main)',
    outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  inputFocused: {
    borderColor: 'var(--primary)',
    boxShadow: '0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent)',
  },
  textarea: {
    resize: 'vertical', minHeight: '80px', lineHeight: '1.6',
  },
  placeholder: {
    fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem',
  },
  checkboxRow: {
    display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
    padding: '0.75rem',
    backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
    borderRadius: '10px', border: '1px solid color-mix(in srgb, var(--primary) 15%, transparent)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '20px', height: '20px', flexShrink: 0, marginTop: '0.1rem',
    accentColor: 'var(--primary)', cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '0.85rem', lineHeight: '1.45', color: 'var(--text-main)',
    fontWeight: '500', cursor: 'pointer', userSelect: 'none',
  },
  submitBtn: (disabled) => ({
    width: '100%', padding: '0.85rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
    borderRadius: '12px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '1rem', fontWeight: '700', fontFamily: 'inherit',
    color: disabled ? 'var(--text-muted)' : '#fff',
    background: disabled
      ? 'color-mix(in srgb, var(--border-color) 60%, var(--input-bg))'
      : 'linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 75%, #000))',
    opacity: disabled ? 0.8 : 1,
    transition: 'all 0.2s ease',
    boxShadow: disabled ? 'none' : '0 4px 14px color-mix(in srgb, var(--primary) 35%, transparent)',
  }),
  footnote: {
    textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)',
    marginTop: '0.5rem', fontStyle: 'italic',
  },
};

const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const BIBLE_BOOKS = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
  "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation"
];

const getUTC8TodayString = () => {
  const now = new Date();
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return utc8Time.toISOString().slice(0, 10);
};

const SubmitDevotional = () => {
  const { user } = useAuth();
  const hasCustomDatePower = useMemo(() => {
    return user?.customDatePowerExpires && new Date(user.customDatePowerExpires) > new Date();
  }, [user]);

  const [form, setForm, clearSavedForm] = useFormPersist('devo_draft', {
    date: getUTC8TodayString(),
    book: '',
    passageStr: '',
    summary: '',
    application: '',
    prayerFocus: '',
    agreement: false,
  });
  const { date, book, passageStr, summary, application, prayerFocus, agreement } = form;
  const [error, setError] = useState('');
  const [dateError, setDateError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [gapConfig, setGapConfig] = useState({
    isOpen: false,
    gapDates: [],
    lastEntryDate: null,
  });

  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  };

  // Build the 3 allowed dates: 2 days ago, yesterday, today
  const datePills = useMemo(() => {
    const now = new Date();
    const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return [-2, -1, 0].map(offset => {
      const d = new Date(utc8Time);
      d.setUTCDate(d.getUTCDate() + offset);
      const iso = d.toISOString().slice(0, 10);
      const label = offset === -2 ? '2 Days Ago' : offset === -1 ? 'Yesterday' : 'Today';
      return {
        iso,
        label,
        dayName: DAY_NAMES_SHORT[d.getUTCDay()],
        dayNum: d.getUTCDate(),
        month: MONTH_NAMES_SHORT[d.getUTCMonth()],
      };
    });
  }, []);

  const { minDate, maxDate } = useMemo(() => ({
    minDate: datePills[0].iso,
    maxDate: datePills[2].iso,
  }), [datePills]);

  const isDateValid = (d) => {
    if (hasCustomDatePower) return true;
    return d >= minDate && d <= maxDate;
  };

  const handleDatePick = (iso) => {
    setForm({ ...form, date: iso });
    setDateError('');
    setError('');
  };

  const proceedSubmit = async (markGapsAsMissed) => {
    setLoading(true);
    try {
      await api.post('/devotionals', {
        date,
        book,
        passageStr,
        summary,
        application,
        prayerFocus,
        markGapsAsMissed
      });
      clearSavedForm();
      navigate('/devotionals');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit devotional');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (loading) return;
    setError('');

    if (!isDateValid(date)) { setDateError(t('devo_date_out_of_range') || 'You can only pick yesterday, today, or tomorrow.'); return; }
    if (!book.trim()) { setError('Please select a book of the Bible.'); return; }
    if (!passageStr.trim()) { setError('Please enter the chapters and verses (e.g. 1-2, or 1:1-10).'); return; }
    if (!summary.trim()) { setError(t('devo_summary_required') || 'Summary is required.'); return; }
    if (!application.trim()) { setError(t('devo_application_required') || 'Application is required.'); return; }
    if (!agreement) { setError(t('devo_agreement_required') || 'Please confirm your agreement.'); return; }

    setLoading(true);
    try {
      const checkRes = await api.get(`/devotionals/check-gap?date=${date}`);
      if (checkRes.data.hasGap) {
        setGapConfig({
          isOpen: true,
          gapDates: checkRes.data.gapDates,
          lastEntryDate: checkRes.data.lastEntryDate
        });
        setLoading(false);
        return;
      }
      await proceedSubmit(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit devotional');
      setLoading(false);
    }
  };

  const isDisabled = loading || !book.trim() || !passageStr.trim() || !summary.trim() || !application.trim() || !agreement || !!dateError || !isDateValid(date);

  const inputStyle = (field) => ({
    ...S.input,
    ...(focusedField === field ? S.inputFocused : {}),
  });

  return (
    <div style={S.page}>
      <div className="btn-back-wrapper">
        <button onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/devotionals')} className="btn-back-pill">
          <ChevronLeft size={16} /> {t('back')}
        </button>
      </div>

      <div style={S.card}>
        {/* Hero gradient header */}
        <div style={S.heroBar}>
          <h2 style={S.heroTitle}>
            <BookHeart size={22} /> {t('devo_submit_title')}
          </h2>
          <p style={S.heroVerse}>{t('devo_scripture_quote')}</p>
          <p style={S.heroRef}>— {t('devo_scripture_ref')}</p>
        </div>

        {/* Form body */}
        <div style={S.body}>
          {error && <div style={S.error}>{error}</div>}

          {/* ── Date Pill Selector ── */}
          <div>
            <div style={S.sectionHeader}>
              <Calendar size={14} /> {t('devo_date_label')}
            </div>
            {hasCustomDatePower ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={S.datePillRow}>
                  {datePills.map(pill => {
                    const active = date === pill.iso;
                    return (
                      <button
                        key={pill.iso}
                        type="button"
                        onClick={() => handleDatePick(pill.iso)}
                        style={S.datePill(active, false)}
                      >
                        <span style={S.datePillDay(active)}>{pill.label}</span>
                        <span style={S.datePillNum(active)}>{pill.dayNum}</span>
                        <span style={S.datePillMonth(active)}>{pill.month}</span>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', padding: '0.5rem 0.75rem', background: 'rgba(139,92,246,0.06)', borderRadius: '10px', border: '1px dashed rgba(139,92,246,0.3)' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: '700', color: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Zap size={14} style={{ fill: 'rgba(139,92,246,0.1)' }} /> Custom Date:
                  </span>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => handleDatePick(e.target.value)}
                    style={{ ...S.input, padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1.5px solid #8b5cf6', background: 'var(--card-bg)', color: 'var(--text-main)', width: 'auto', flex: 1, fontSize: '0.85rem' }}
                  />
                </div>
                <span style={{ fontSize: '0.72rem', color: '#8b5cf6', fontWeight: '600', fontStyle: 'italic', paddingLeft: '0.25rem' }}>
                  ⚡ Admin has granted you temporary power to submit for any date.
                </span>
              </div>
            ) : (
              <div style={S.datePillRow}>
                {datePills.map(pill => {
                  const active = date === pill.iso;
                  return (
                    <button
                      key={pill.iso}
                      type="button"
                      onClick={() => handleDatePick(pill.iso)}
                      style={S.datePill(active, false)}
                    >
                      <span style={S.datePillDay(active)}>{pill.label}</span>
                      <span style={S.datePillNum(active)}>{pill.dayNum}</span>
                      <span style={S.datePillMonth(active)}>{pill.month}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {dateError && <div style={{ ...S.error, marginTop: '0.5rem' }}>{dateError}</div>}
          </div>

          {/* ── Scripture Passage (Structured) ── */}
          <div>
            <div style={S.sectionHeader}>
              <BookOpen size={14} /> {t('devo_passage_label')}
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <select
                value={book}
                onChange={(e) => setForm({ ...form, book: e.target.value })}
                onFocus={() => setFocusedField('book')}
                onBlur={() => setFocusedField(null)}
                style={{ ...inputStyle('book'), flex: 2, appearance: 'auto', paddingRight: '1rem' }}
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
                placeholder="Chap / Verses (e.g. 1-2, or 1:1-10)"
                value={passageStr}
                onChange={(e) => setForm({ ...form, passageStr: e.target.value })}
                onFocus={() => setFocusedField('passageStr')}
                onBlur={() => setFocusedField(null)}
                style={{ ...inputStyle('passageStr'), flex: 3 }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: '1.4' }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
              <span><strong>Supported formats:</strong> Single chapter (<code>1</code>), multiple chapters (<code>1-3</code>), specific verses (<code>1:1-10</code>), or complex ranges (<code>1, 2:1-5</code>).</span>
            </div>
          </div>

          {/* ── Summary / Key Takeaways ── */}
          <div>
            <div style={S.sectionHeader}>
              <Flame size={14} /> {t('devo_summary_label')}
            </div>
            <textarea
              id="devo-summary"
              placeholder={t('devo_summary_placeholder')}
              value={summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              onFocus={() => setFocusedField('summary')}
              onBlur={() => setFocusedField(null)}
              rows={4}
              style={{ ...inputStyle('summary'), ...S.textarea }}
            />
          </div>

          {/* ── Application ── */}
          <div>
            <div style={S.sectionHeader}>
              <Target size={14} /> {t('devo_application_label')}
            </div>
            <textarea
              id="devo-application"
              placeholder={t('devo_application_placeholder')}
              value={application}
              onChange={(e) => setForm({ ...form, application: e.target.value })}
              onFocus={() => setFocusedField('application')}
              onBlur={() => setFocusedField(null)}
              rows={3}
              style={{ ...inputStyle('application'), ...S.textarea }}
            />
          </div>

          {/* ── Prayer Focus (optional) ── */}
          <div>
            <div style={S.sectionHeader}>
              <Heart size={14} /> {t('devo_prayer_label')}
            </div>
            <textarea
              id="devo-prayer"
              placeholder={t('devo_prayer_placeholder')}
              value={prayerFocus}
              onChange={(e) => setForm({ ...form, prayerFocus: e.target.value })}
              onFocus={() => setFocusedField('prayer')}
              onBlur={() => setFocusedField(null)}
              rows={2}
              style={{ ...inputStyle('prayer'), ...S.textarea }}
            />
          </div>

          {/* ── Agreement ── */}
          <div
            style={S.checkboxRow}
            onClick={() => setForm({ ...form, agreement: !agreement })}
          >
            <input
              type="checkbox"
              id="devo-agreement"
              checked={agreement}
              onChange={(e) => setForm({ ...form, agreement: e.target.checked })}
              style={S.checkbox}
            />
            <label htmlFor="devo-agreement" style={S.checkboxLabel}>
              {t('devo_agreement_label')}
            </label>
          </div>

          {/* ── Submit ── */}
          <div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isDisabled}
              style={S.submitBtn(isDisabled)}
            >
              <Send size={18} />
              {loading ? '...' : t('devo_submit_btn')}
            </button>
            <p style={S.footnote}>{t('devo_reflect_note')}</p>
          </div>
        </div>
      </div>

      {gapConfig.isOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem',
          backdropFilter: 'blur(8px)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div className="fun-card" style={{
            backgroundColor: 'var(--surface, var(--card-bg))',
            width: '100%', maxWidth: '420px',
            padding: '1.75rem',
            position: 'relative',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color)',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          }}>
            <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={22} color="#F59E0B" /> Submission Gap Detected
            </h3>
            
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.9rem', lineHeight: '1.6' }}>
              You have a gap between your last entry on <strong>{formatDateStr(gapConfig.lastEntryDate)}</strong> and this one.
            </p>

            <div style={{
              backgroundColor: 'color-mix(in srgb, var(--primary) 4%, var(--card-bg))',
              border: '1px solid var(--border-color)',
              borderRadius: '10px',
              padding: '0.75rem',
              maxHeight: '120px',
              overflowY: 'auto'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>
                Gap Dates ({gapConfig.gapDates.length}):
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {gapConfig.gapDates.map(d => (
                  <span key={d} style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: 'color-mix(in srgb, #EF4444 12%, transparent)',
                    color: '#EF4444',
                    border: '1px solid color-mix(in srgb, #EF4444 20%, transparent)'
                  }}>
                    {formatDateStr(d)}
                  </span>
                ))}
              </div>
            </div>

            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: '1.5' }}>
              Would you like to mark these gap days as <strong>Missed</strong>?
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button
                onClick={() => {
                  setGapConfig({ isOpen: false, gapDates: [], lastEntryDate: null });
                  proceedSubmit(true);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.88rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  backgroundColor: '#EF4444',
                  color: '#fff',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
                }}
              >
                Yes, Mark as Missed
              </button>
              <button
                onClick={() => {
                  setGapConfig({ isOpen: false, gapDates: [], lastEntryDate: null });
                  proceedSubmit(false);
                }}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.88rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  transition: 'background-color 0.2s'
                }}
              >
                No, Leave as Gaps
              </button>
              <button
                onClick={() => setGapConfig({ isOpen: false, gapDates: [], lastEntryDate: null })}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  borderRadius: '10px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  transition: 'color 0.2s'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmitDevotional;
