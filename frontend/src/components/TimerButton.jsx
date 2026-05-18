import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Send, X, BookOpen } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { MIRROR_MESSAGES, AFFIRMATION_MESSAGES, DEVOTIONAL_MESSAGES } from '../data/reflectionMessages';

// ─── Change this single number to update the countdown duration everywhere ────
export const COUNTDOWN_SECONDS = 60;

const TimerButton = ({
  duration = COUNTDOWN_SECONDS,
  onConfirm,
  label,
  cancelLabel,
  disabled,
  loading,
  type = "button",
  className = "btn btn-primary",
  customStyle = {},
  module = "mirror",  // "mirror" or "affirmation"
}) => {
  const { lang, t } = useLanguage();
  const [isCounting, setIsCounting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(duration);
  const [message, setMessage] = useState(null);
  const progressRef = useRef(null);

  // Sync timeLeft if duration prop changes while not counting
  useEffect(() => {
    if (!isCounting) {
      setTimeLeft(duration);
    }
  }, [duration, isCounting]);

  const resolvedCancelLabel = cancelLabel || t('cancel') || 'Cancel';

  useEffect(() => {
    if (!isCounting) return;
    if (timeLeft <= 0) {
      setIsCounting(false);
      if (onConfirm) onConfirm();
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [isCounting, timeLeft, onConfirm]);

  useEffect(() => {
    if (isCounting) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isCounting]);

  useEffect(() => {
    if (!progressRef.current || !isCounting) return;
    const circumference = 2 * Math.PI * 54;

    // Reset to full without transition
    progressRef.current.style.transition = 'none';
    progressRef.current.style.strokeDashoffset = '0';

    // Force a reflow
    void progressRef.current.getBoundingClientRect();

    // Start continuous animation
    progressRef.current.style.transition = `stroke-dashoffset ${duration}s linear`;
    progressRef.current.style.strokeDashoffset = circumference;
  }, [isCounting, duration]);

  const handleClick = (e) => {
    e.preventDefault();
    if (disabled || loading) return;
    const pool = module === 'affirmation'
      ? (AFFIRMATION_MESSAGES[lang] || AFFIRMATION_MESSAGES['en'])
      : module === 'devotional'
      ? (DEVOTIONAL_MESSAGES[lang] || DEVOTIONAL_MESSAGES['en'])
      : (MIRROR_MESSAGES[lang] || MIRROR_MESSAGES['en']);
    const random = pool[Math.floor(Math.random() * pool.length)];
    setMessage(random);
    setTimeLeft(duration);
    setIsCounting(true);
  };

  const handleCancel = () => {
    setIsCounting(false);
    setTimeLeft(duration);
  };

  const circumference = 2 * Math.PI * 54;

  return (
    <>
      <button
        type={type}
        className={className}
        onClick={handleClick}
        disabled={disabled || loading}
        style={{ width: '100%', position: 'relative', overflow: 'hidden', padding: '0.75rem', ...customStyle }}
        title={loading ? '...' : label}
      >
        <Send size={20} />
        {label && <span style={{ marginLeft: '0.5rem' }}>{label}</span>}
      </button>

      {isCounting && message && createPortal(
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

          <h2 style={{
            fontSize: 'clamp(1.4rem, 5vw, 2.2rem)',
            marginBottom: '0.75rem',
            color: 'var(--primary)',
            fontWeight: '800',
            letterSpacing: '-0.5px'
          }}>
            {message.title}
          </h2>

          <p style={{
            fontSize: 'clamp(0.95rem, 2.5vw, 1.15rem)',
            marginBottom: '2rem',
            maxWidth: '540px',
            color: 'var(--text-main)',
            opacity: 0.85,
            lineHeight: 1.7
          }}>
            {message.text}
          </p>

          <div style={{
            maxWidth: '500px',
            backgroundColor: 'color-mix(in srgb, var(--primary) 8%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 25%, transparent)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2.5rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-start',
            textAlign: 'left'
          }}>
            <BookOpen size={20} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: '0.2rem', opacity: 0.7 }} />
            <div>
              <p style={{
                fontStyle: 'italic',
                color: 'var(--text-main)',
                fontSize: 'clamp(0.85rem, 2vw, 1rem)',
                lineHeight: 1.65,
                margin: '0 0 0.4rem 0'
              }}>
                "{message.verse}"
              </p>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: '700',
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.8px'
              }}>
                — {message.reference}
              </span>
            </div>
          </div>

          <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '2.5rem' }}>
            <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="65" cy="65" r="54" fill="none" stroke="color-mix(in srgb, var(--primary) 15%, transparent)" strokeWidth="8" />
              <circle
                ref={progressRef}
                cx="65" cy="65" r="54"
                fill="none"
                stroke="var(--primary)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={0}
              />
            </svg>
            <div style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '2.5rem',
              fontWeight: '800',
              color: 'var(--primary)',
              fontFamily: 'monospace',
              lineHeight: 1
            }}>
              {timeLeft}
            </div>
          </div>

          <button
            onClick={handleCancel}
            className="btn btn-secondary"
            style={{
              padding: '0.85rem 2.5rem',
              fontSize: '1rem',
              borderRadius: '9999px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600',
            }}
            title={resolvedCancelLabel}
          >
            <X size={20} />
            {resolvedCancelLabel}
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

export default React.memo(TimerButton);
