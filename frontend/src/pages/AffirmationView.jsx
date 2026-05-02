import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Send, Heart, Sun, User, Calendar, Quote, BookOpen } from 'lucide-react';
import { format } from 'date-fns';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import PopupModal from '../components/PopupModal';

const AffirmationView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [affirmation, setAffirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [markingReceived, setMarkingReceived] = useState(false);

  const [popupState, setPopupState] = useState({ isOpen: false, title: '', message: '', isAlert: true, onConfirm: null });
  const bottomRef = useRef(null);

  useEffect(() => {
    fetchAffirmation();
  }, [id]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [affirmation]);

  const fetchAffirmation = async () => {
    try {
      const res = await api.get(`/affirmations/${id}`);
      setAffirmation(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load affirmation');
    } finally {
      setLoading(false);
    }
  };

  const showAlert = (title, message) => setPopupState({ isOpen: true, title, message, isAlert: true, onConfirm: null });
  const showConfirm = (title, message, onConfirm) => setPopupState({ isOpen: true, title, message, isAlert: false, onConfirm });

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || sendingReply) return;

    setSendingReply(true);
    try {
      const res = await api.post(`/affirmations/${id}/reply`, { text: replyText });
      setAffirmation(res.data.affirmation || res.data);
      setReplyText('');
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleMarkReceived = async () => {
    setMarkingReceived(true);
    try {
      const res = await api.put(`/affirmations/${id}/receive`);
      setAffirmation(res.data.affirmation || res.data);
    } catch (err) {
      showAlert('Error', err.response?.data?.message || 'Failed to mark as received');
    } finally {
      setMarkingReceived(false);
    }
  };

  const handleMarkReceivedClick = () => {
    showConfirm('Confirm', t('sl_mark_received_confirm'), handleMarkReceived);
  };

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  if (error) return <div className="container" style={{ padding: '2rem', color: '#EF4444', textAlign: 'center' }}>{error}</div>;
  if (!affirmation) return null;

  const isSender = affirmation.sender._id === user._id;
  const isReceiver = affirmation.receiver._id === user._id;
  const isReceived = affirmation.status === 'Received';
  const hasReplied = !!affirmation.reply?.sentAt;

  return (
    <div className="container thread-view-container" style={{ paddingBottom: '3rem', maxWidth: '800px', margin: '0 auto' }}>
      
      {/* ── Back Button ── */}
      <button onClick={() => navigate('/affirm/dashboard')} className="back-btn">
        <ChevronLeft size={18} /> <span>{t('sl_back_to_dashboard')}</span>
      </button>
      
      {/* ── Header Metadata ── */}
      <div className="thread-view-header flex justify-end items-start mb-4">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          {isReceived && (
            <span className="badge" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--primary)', fontWeight: 'bold' }}>
              {t('sl_status_received')}
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '800px' }}>
        
        {/* Status Banner */}
        {isReceived && (
          <div className="ff-alert" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', padding: '1rem 1.5rem', borderRadius: 'var(--radius-md)' }}>
            <Sun size={24} style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontWeight: '500' }}>{t('sl_received_banner')}</p>
          </div>
        )}

        <div className="messages-list" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Main Affirmation Card */}
          <div className="message-item" style={{ width: '100%' }}>
            
            <div className="fun-card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--surface-border)' }}>
              {/* Card Header */}
              <div className="sl-card-header">
                {affirmation.topic && (
                  <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', fontWeight: '800', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Sun size={24} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                    {affirmation.topic}
                  </h2>
                )}
                <div className="sl-card-meta">
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={16} style={{ flexShrink: 0 }} /> <strong>From:</strong> {isSender ? affirmation.sender.displayName : 'Anonymous'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <User size={16} style={{ flexShrink: 0 }} /> <strong>To:</strong> {affirmation.receiver.displayName}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Calendar size={16} style={{ flexShrink: 0 }} /> {format(new Date(affirmation.createdAt), 'MMM d, yyyy h:mm a')}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="sl-card-body">
                
                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    {t('sl_appreciation_label')}
                  </h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-main)', fontSize: '1.05rem', margin: 0 }}>
                    {affirmation.content.appreciation}
                  </p>
                </div>

                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }}></div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    {t('sl_impact_label')}
                  </h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-main)', fontSize: '1.05rem', margin: 0 }}>
                    {affirmation.content.impact}
                  </p>
                </div>

                <div style={{ width: '100%', height: '1px', backgroundColor: 'var(--border-color)' }}></div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                    {t('sl_encouragement_label')}
                  </h4>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', color: 'var(--text-main)', fontSize: '1.05rem', margin: 0 }}>
                    {affirmation.content.encouragement}
                  </p>
                </div>

              </div>

              {/* Bible Verse Footer */}
              <div className="sl-card-footer">
                <Quote size={24} style={{ color: 'var(--primary)', flexShrink: 0, opacity: 0.5, marginTop: '0.2rem' }} />
                <div>
                  <p style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic', color: 'var(--text-main)', fontSize: '1.1rem', margin: '0 0 0.5rem 0', lineHeight: '1.6' }}>
                    "{affirmation.content.bibleVerse}"
                  </p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                    — {t('sl_bible_verse_label')}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Receiver's Reply (if exists) */}
          {hasReplied && (
            <div className="message-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '100%' }}>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textAlign: 'right', fontWeight: 'bold' }}>
                {affirmation.receiver.displayName} • {format(new Date(affirmation.reply.sentAt), 'MMM d, yyyy h:mm a')}
              </div>
              <div style={{ 
                backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)', 
                color: 'var(--text-main)', 
                padding: '1.25rem 1.5rem', 
                borderRadius: '1.5rem',
                borderBottomRightRadius: '0.5rem',
                maxWidth: '85%',
                boxShadow: 'var(--shadow-sm)',
                border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)'
              }}>
                <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '1.05rem' }}>{affirmation.reply.text}</p>
              </div>
            </div>
          )}
          
          <div ref={bottomRef} />
        </div>

        {/* ── Actions / Forms ── */}
        
        {/* Receiver actions: Reply form or Mark Received button */}
        {isReceiver && !isReceived && (
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {!hasReplied && (
              <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="ff-input"
                  placeholder={t('sl_reply_placeholder')}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  style={{ flex: 1, margin: 0, padding: '0.75rem 1rem', borderRadius: 'var(--radius-full)' }}
                />
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={!replyText.trim() || sendingReply}
                  style={{ padding: '0 1.5rem', borderRadius: 'var(--radius-full)' }}
                >
                  <Send size={18} />
                  <span className="hide-text-mobile" style={{ marginLeft: '0.5rem' }}>{t('sl_send_reply_btn')}</span>
                </button>
              </form>
            )}

            <button 
              onClick={handleMarkReceivedClick} 
              className="btn btn-primary" 
              disabled={markingReceived}
              style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', borderRadius: 'var(--radius-md)' }}
            >
              <Heart size={20} /> 
              {t('sl_mark_received_btn')}
            </button>
          </div>
        )}

      </div>

      <PopupModal 
        isOpen={popupState.isOpen}
        title={popupState.title}
        message={popupState.message}
        isAlert={popupState.isAlert}
        onConfirm={popupState.onConfirm}
        onClose={() => setPopupState(p => ({ ...p, isOpen: false }))}
      />
    </div>
  );
};

export default AffirmationView;
