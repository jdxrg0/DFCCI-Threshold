import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import MessageBubble from '../components/MessageBubble';
import TimerButton from '../components/TimerButton';
import useFormPersist from '../hooks/useFormPersist';
import { Check, X, ShieldAlert, CheckCircle, Hourglass, Trash2 } from 'lucide-react';

const formatRelativeTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = Math.max(0, now - date);
  const diffInMins = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) return 'just now';
  if (diffInMins < 60) return `${diffInMins} min${diffInMins !== 1 ? 's' : ''} ago`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
  if (diffInDays === 1) return 'yesterday';
  return `${diffInDays} days ago`;
};

const formatDuration = (startString, endString) => {
  if (!startString || !endString) return '';
  const start = new Date(startString);
  const end = new Date(endString);
  const diffInMs = Math.max(0, end - start);
  const diffInMins = Math.floor(diffInMs / 60000);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInMins < 1) return '< 1 min';
  if (diffInMins < 60) return `${diffInMins} min${diffInMins !== 1 ? 's' : ''}`;
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''}`;
  return `${diffInDays} day${diffInDays !== 1 ? 's' : ''}`;
};

const ThreadView = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [thread, setThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Reply form state
  const [form, setForm, clearSavedForm] = useFormPersist(`thread_reply_draft_${id}`, {
    clarification: '',
    feelings: '',
    acknowledgment: '',
    hopedUnderstanding: '',
    replyBibleVerse: ''
  });
  const { clarification, feelings, acknowledgment, hopedUnderstanding, replyBibleVerse } = form;
  const [replyLoading, setReplyLoading] = useState(false);

  // Modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [showCooldownModal, setShowCooldownModal] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    fetchThread();

    // Set up Server-Sent Events (SSE) for real-time updates
    const eventSource = new EventSource(`${api.defaults.baseURL}/threads/${id}/events`, {
      withCredentials: true
    });

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'UPDATE') {
          fetchThread();
          setNow(new Date());
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE Connection Error:', err);
      // EventSource auto-reconnects natively
    };

    // Update local 'now' state for UI timers (cooldowns) every 10 seconds, zero network cost
    const timerInterval = setInterval(() => {
      setNow(new Date());
    }, 10000);

    return () => {
      eventSource.close();
      clearInterval(timerInterval);
    };
  }, [id]);

  const fetchThread = useCallback(async () => {
    try {
      let res;
      try {
        res = await api.get(`/threads/${id}`);
      } catch (err) {
        if (err.response?.status === 403 && ['ADMIN', 'COUNSELOR'].includes(user.role)) {
          res = await api.get(`/counselor/threads/${id}`);
        } else {
          throw err;
        }
      }
      setThread(res?.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load thread');
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  const handleReplySubmit = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!clarification.trim() || !feelings.trim() || !acknowledgment.trim() || !hopedUnderstanding.trim() || !replyBibleVerse.trim()) return;

    setReplyLoading(true);
    try {
      await api.post(`/threads/${id}/reply`, {
        content: { clarification, feelings, acknowledgment, hopedUnderstanding, bibleVerse: replyBibleVerse }
      });
      clearSavedForm();
      setForm({
        clarification: '',
        feelings: '',
        acknowledgment: '',
        hopedUnderstanding: '',
        replyBibleVerse: ''
      });
      await fetchThread();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reply');
    } finally {
      setReplyLoading(false);
    }
  }, [id, clarification, feelings, acknowledgment, hopedUnderstanding, replyBibleVerse, clearSavedForm, setForm, fetchThread]);

  const handleResolve = async () => {
    try {
      await api.put(`/threads/${id}/resolve`);
      setShowResolveModal(false);
      fetchThread();
    } catch (err) {
      alert('Failed to resolve thread');
    }
  };

  const handleAccept = async () => {
    try {
      await api.put(`/threads/${id}/accept`);
      setShowAcceptModal(false);
      fetchThread();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept thread');
    }
  };

  const handleEscalate = async () => {
    try {
      await api.post(`/threads/${id}/escalate`);
      setShowEscalateModal(false);
      fetchThread();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request escalation');
    }
  };

  const handleEscalationConsent = async (consent) => {
    try {
      await api.put(`/threads/${id}/consent-escalation`, { consent });
      fetchThread();
    } catch (err) {
      alert('Failed to update consent');
    }
  };

  const handleCounselorConsent = async (consent) => {
    try {
      await api.put(`/threads/${id}/counselor-consent`, { consent });
      fetchThread();
    } catch (err) {
      alert('Failed to update consent');
    }
  };

  const handleRequestDeletion = async () => {
    try {
      await api.post(`/threads/${id}/request-deletion`);
      setShowDeleteModal(false);
      fetchThread();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request deletion');
    }
  };

  const handleRequestRestore = async () => {
    try {
      await api.post(`/threads/${id}/request-restore`);
      setShowRestoreModal(false);
      fetchThread();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to request restore');
    }
  };

  if (!user) return null;
  
  if (!thread) {
    if (loading) return <div className="container mt-4 text-center">Loading thread...</div>;
    return <div className="container mt-4 text-center">{error || 'Thread not found'}</div>;
  }

  const isSender = thread.sender?._id === user._id;
  const isReceiver = thread.receiver?._id === user._id;
  const isCounselorView = !isSender && !isReceiver && ['ADMIN', 'COUNSELOR'].includes(user?.role);

  const authorType = isSender ? 'Sender' : (isReceiver ? 'Receiver' : 'Counselor');
  const otherPartyName = isSender ? thread.receiver.displayName : 'Anonymous';
  
  const lastMessage = thread.messages[thread.messages.length - 1];
  const isMyTurn = !isCounselorView && lastMessage.authorType !== authorType && thread.status === 'Active';
  const repliesUsed = isSender ? thread.senderRepliesUsed : thread.receiverRepliesUsed;
  const canReply = isMyTurn && repliesUsed < 3;

  const isFormComplete = clarification.trim() !== '' && feelings.trim() !== '' && acknowledgment.trim() !== '' && hopedUnderstanding.trim() !== '' && replyBibleVerse.trim() !== '';

  // Pending early escalation check
  const myEscalationConsent = isSender ? thread.earlyEscalationSenderConsent : thread.earlyEscalationReceiverConsent;
  const pendingEscalationConsent = myEscalationConsent === 'Pending';

  // Pending counselor check
  const myCounselorConsent = isSender ? thread.counselorConsentSender : thread.counselorConsentReceiver;
  const pendingCounselorConsent = myCounselorConsent === 'Pending';

  // Reply cooldown check
  const replyCooldownTimeMs = 60 * 60 * 1000; // 1 hour
  const cooldownStart = lastMessage?.readAt ? new Date(lastMessage.readAt) : new Date(lastMessage?.createdAt || Date.now());
  const timeSinceLastMessage = Math.max(0, now.getTime() - cooldownStart.getTime());
  const replyTimeRemaining = replyCooldownTimeMs - timeSinceLastMessage;
  const isReplyCooldownActive = replyTimeRemaining > 0;
  const waitMins = Math.ceil(replyTimeRemaining / 60000);

  // Cooldown check for deletion
  const isCooldownActive = () => {
    if (!thread.lastRestoredAt) return false;
    const restoredAt = new Date(thread.lastRestoredAt);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return restoredAt > oneHourAgo;
  };

  return (
    <div className="container" style={{ maxWidth: '800px', paddingBottom: '2rem' }}>
      <div className="thread-view-header flex justify-between items-start mb-4">
        <div>
          {isCounselorView ? (
            <h1 style={{ margin: 0 }}>Counselor View: {thread.receiver?.displayName || 'Unknown'} & Anonymous Sender</h1>
          ) : (
            <h1 style={{ margin: 0 }}>{isSender ? `To: ${otherPartyName}` : `From: ${otherPartyName}`}</h1>
          )}
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Sent {formatRelativeTime(thread.createdAt)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
          <span className={`badge ${thread.status.toLowerCase()}`}>{thread.status}</span>
          {thread.acceptedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Accepted in: {formatDuration(thread.createdAt, thread.acceptedAt)}
            </span>
          )}
          {thread.resolvedAt && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Resolved in: {formatDuration(thread.createdAt, thread.resolvedAt)}
            </span>
          )}
        </div>
      </div>

      {/* Escalation Stats */}
      {(thread.escalationRequestCount > 0 || thread.escalationDeclinedCount > 0) && (
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', gap: '1rem', padding: '0.5rem 0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius)' }}>
          <span><strong>Counselor Requests:</strong> {thread.escalationRequestCount || 0}</span>
          <span><strong>Declined Requests:</strong> {thread.escalationDeclinedCount || 0}</span>
        </div>
      )}

      {/* Deletion Request Status Banner */}
      {thread.deletionRequestStatus === 'Pending' && !thread.deletedAt && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Hourglass size={24} color="#F59E0B" />
          <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-main)' }}>{t('deletion_pending')}</p>
        </div>
      )}

      {/* Restore Request Status Banner */}
      {thread.restoreRequestStatus === 'Pending' && thread.deletedAt && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #3B82F6', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Hourglass size={24} color="#3B82F6" />
          <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-main)' }}>{t('restore_pending')}</p>
        </div>
      )}
      
      {thread.deletedAt && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #EF4444', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Trash2 size={24} color="#EF4444" />
          <div>
            <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-main)' }}>{t('deleted_bin')}</p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('deleted_perm')}</p>
          </div>
        </div>
      )}

      {!isCounselorView && thread.status === 'Resolved' && !isSender && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #10B981', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <CheckCircle size={24} color="#10B981" />
          <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-main)' }}>{t('resolved_banner')}</p>
        </div>
      )}

      {!isCounselorView && thread.status === 'Accepted' && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid #3B82F6', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div>
            <p style={{ margin: 0, fontWeight: '500', color: 'var(--text-main)' }}>
              {isReceiver ? t('accepted_receiver') : t('accepted_sender')}
            </p>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {isReceiver ? t('accepted_receiver_sub') : t('accepted_sender_sub')}
            </p>
          </div>
        </div>
      )}

      {/* Counselor Consent Notice */}
      {!isCounselorView && pendingCounselorConsent && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <ShieldAlert size={20} color="#F59E0B" /> {t('counselor_access_request')}
          </h3>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)' }}>{t('counselor_access_desc')}</p>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <button onClick={() => handleCounselorConsent('Approved')} className="btn btn-primary" title="Pumapayag ako" style={{ backgroundColor: '#F59E0B', borderColor: '#F59E0B', color: '#fff', flex: 1, minWidth: '160px' }}>
              <Check size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('i_consent')}</span>
            </button>
            <button onClick={() => handleCounselorConsent('Declined')} className="btn btn-secondary" title={t('i_decline')} style={{ flex: 1, minWidth: '160px' }}>
              <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('i_decline')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Early Escalation Notice */}
      {!isCounselorView && pendingEscalationConsent && thread.earlyEscalationRequestedBy !== authorType && (
        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--primary)' }}>
          <h3 style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-main)' }}>
            <ShieldAlert size={20} color="var(--primary)" /> {t('counselor_support_requested')}
          </h3>
          <p style={{ marginBottom: '1.25rem', color: 'var(--text-muted)' }}>{t('escalation_desc')}</p>
          <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
            <button onClick={() => handleEscalationConsent('Approved')} className="btn btn-primary" title="Pumapayag ako" style={{ flex: 1, minWidth: '160px' }}>
              <Check size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('i_consent')}</span>
            </button>
            <button onClick={() => handleEscalationConsent('Declined')} className="btn btn-secondary" title={t('i_decline')} style={{ flex: 1, minWidth: '160px' }}>
              <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('i_decline')}</span>
            </button>
          </div>
        </div>
      )}

      {!isCounselorView && thread.earlyEscalationRequestedBy === authorType && pendingEscalationConsent && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Hourglass size={20} color="var(--text-muted)" />
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>{t('waiting_consent')}</p>
        </div>
      )}

      <div className="message-list">
        {thread.messages.map((msg, idx) => {
          const isCurrent = isCounselorView ? msg.authorType === 'Sender' : msg.authorType === authorType;
          return <MessageBubble key={idx} message={msg} isCurrentUser={isCurrent} />;
        })}
      </div>

      {!isCounselorView && canReply && thread.status !== 'Escalated' && (
        <div className="fun-card" style={{ marginBottom: '2rem' }}>
          <h3 className="fun-title" style={{ marginBottom: '0.5rem', textAlign: 'left' }}>{t('your_reply')} ({t('replies_remaining')(3 - repliesUsed)})</h3>
          
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {t('reply_limit_note')}
          </p>

          {repliesUsed === 2 && !isReplyCooldownActive && (
            <div style={{ backgroundColor: '#FEF2F2', color: '#991B1B', padding: '1rem', borderRadius: '0', marginBottom: '1.5rem', borderLeft: '4px solid #EF4444' }}>
              <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{t('last_chance_title')}</strong>
              {t('last_chance_body')}
            </div>
          )}

          {isReplyCooldownActive ? (
            <div style={{ backgroundColor: 'rgba(2, 132, 199, 0.05)', color: 'var(--primary)', padding: '1rem', borderRadius: '0', borderLeft: '4px solid var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Hourglass size={24} />
              <div>
                <strong style={{ display: 'block', marginBottom: '0.25rem' }}>{t('reflection_time')}</strong>
                {t('cooldown_msg')(waitMins)}
              </div>
            </div>
          ) : (
            <form onSubmit={handleReplySubmit}>
            {/* Field 1: Clarification */}
            <div className="ff-field ff-textarea">
              <textarea 
                id="reply-clarification"
                className="ff-input ff-textarea-el" 
                value={clarification} 
                onChange={e => setForm({ ...form, clarification: e.target.value })} 
                placeholder=" "
                required
              />
              <label htmlFor="reply-clarification">{t('clarification_label')}</label>
            </div>

            {/* Field 2: Feelings */}
            <div className="ff-field ff-textarea">
              <textarea 
                id="reply-feelings"
                className="ff-input ff-textarea-el" 
                value={feelings} 
                onChange={e => setForm({ ...form, feelings: e.target.value })} 
                placeholder=" "
                required
              />
              <label htmlFor="reply-feelings">{t('feelings_label')}</label>
            </div>

            {/* Field 3: Acknowledgment */}
            <div className="ff-field ff-textarea">
              <textarea 
                id="reply-acknowledgment"
                className="ff-input ff-textarea-el" 
                value={acknowledgment} 
                onChange={e => setForm({ ...form, acknowledgment: e.target.value })} 
                placeholder=" "
                required
              />
              <label htmlFor="reply-acknowledgment">{t('acknowledgment_label')}</label>
            </div>

            {/* Field 4: Hoped Understanding */}
            <div className="ff-field ff-textarea">
              <textarea 
                id="reply-understanding"
                className="ff-input ff-textarea-el" 
                value={hopedUnderstanding} 
                onChange={e => setForm({ ...form, hopedUnderstanding: e.target.value })} 
                placeholder=" "
                required
              />
              <label htmlFor="reply-understanding">{t('understanding_label')}</label>
            </div>

            {/* Field 5: Bible Verse */}
            <div className="ff-field">
              <input
                id="reply-verse"
                type="text"
                className="ff-input"
                placeholder="e.g. Kawikaan 27:6"
                value={replyBibleVerse}
                onChange={e => setForm({ ...form, replyBibleVerse: e.target.value })}
                required
              />
              <label htmlFor="reply-verse">{t('bible_verse_label')}</label>
            </div>
            
            <div className="mt-4">
              <TimerButton 
                type="submit"
                onConfirm={handleReplySubmit}

                label={t('send_reply_btn')} 
                loading={replyLoading}
                disabled={!isFormComplete}
              />
              <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                {t('breathe_note')}
              </p>
            </div>
          </form>
          )}
        </div>
      )}

      {/* Actions */}
      {!isCounselorView && thread.status !== 'Resolved' && (
        <div className="flex gap-3" style={{ marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
          
          {isSender && thread.status !== 'Resolved' && thread.deletionRequestStatus !== 'Pending' && !thread.deletedAt && (
             <button onClick={() => isCooldownActive() ? setShowCooldownModal(true) : setShowDeleteModal(true)} 
               className="btn btn-danger" 
               style={{ flex: 1, minWidth: '160px', opacity: isCooldownActive() ? 0.5 : 1 }} 
               title={isCooldownActive() ? "Nasa cooldown pa" : "Humiling ng Pagbura"}
             >
               <Trash2 size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('request_deletion')}</span>
             </button>
          )}

          {thread.status === 'Active' && (
            thread.earlyEscalationRequestedBy ? (
              <button className="btn btn-secondary" disabled style={{ opacity: 0.7, cursor: 'not-allowed', flex: 1, minWidth: '160px' }}>
                <Hourglass size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('waiting_approval')}</span>
              </button>
            ) : (
              <button onClick={() => setShowEscalateModal(true)} className="btn btn-secondary" style={{ flex: 1, minWidth: '160px' }}>
                <ShieldAlert size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('request_support')}</span>
              </button>
            )
          )}

          {isReceiver && thread.status === 'Active' && (
            <button onClick={() => setShowAcceptModal(true)} className="btn btn-success" style={{ flex: 2, minWidth: '200px' }}>
              <CheckCircle size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('accept_btn')}</span>
            </button>
          )}

          {isSender && (
            <button onClick={() => setShowResolveModal(true)} className="btn btn-success" style={{ flex: 2, minWidth: '200px' }}>
              <CheckCircle size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('resolved_btn')}</span>
            </button>
          )}
          
          {isSender && thread.deletedAt && thread.restoreRequestStatus !== 'Pending' && (
             <button onClick={() => setShowRestoreModal(true)} className="btn btn-primary" style={{ flex: 1, minWidth: '160px' }}>
               <CheckCircle size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('request_restore')}</span>
             </button>
          )}
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('are_you_sure')}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('resolve_modal_body')}</p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={() => setShowResolveModal(false)} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('not_yet')}>
                <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('not_yet')}</span>
              </button>
              <button onClick={handleResolve} className="btn btn-primary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('yes')}>
                <Check size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('yes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('accept_modal_title')}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('accept_modal_body')}</p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={() => setShowAcceptModal(false)} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('back')}>
                <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('back')}</span>
              </button>
              <button onClick={handleAccept} className="btn btn-primary" style={{ backgroundColor: '#3B82F6', border: 'none', padding: '0.6rem 1rem', flex: 1 }} title={t('yes')}>
                <Check size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('yes')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {showEscalateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('need_support')}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('escalate_modal_body')}</p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={() => setShowEscalateModal(false)} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('cancel')}>
                <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('cancel')}</span>
              </button>
              <button onClick={handleEscalate} className="btn btn-primary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('yes_request')}>
                <ShieldAlert size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('yes_request')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete Request Modal */}
      {showDeleteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('request_deletion_title')}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('deletion_modal_body')}</p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('cancel')}>
                <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('cancel')}</span>
              </button>
              <button onClick={handleRequestDeletion} className="btn btn-primary" style={{ backgroundColor: '#EF4444', border: 'none', padding: '0.6rem 1rem', flex: 1 }} title={t('yes_request')}>
                <Trash2 size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('yes_request')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Request Modal */}
      {showRestoreModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>{t('request_restore_title')}</h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('restore_modal_body')}</p>
            <div className="flex gap-3" style={{ flexWrap: 'wrap' }}>
              <button onClick={() => setShowRestoreModal(false)} className="btn btn-secondary" style={{ padding: '0.6rem 1rem', flex: 1 }} title={t('cancel')}>
                <X size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('cancel')}</span>
              </button>
              <button onClick={handleRequestRestore} className="btn btn-primary" style={{ backgroundColor: '#3B82F6', border: 'none', padding: '0.6rem 1rem', flex: 1 }} title={t('yes_request')}>
                <CheckCircle size={20} /> <span style={{ marginLeft: '0.5rem' }}>{t('yes_request')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cooldown Modal */}
      {showCooldownModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ maxWidth: '400px', width: '90%' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Hourglass size={20} color="var(--primary)" /> {t('cooldown_title')}
            </h3>
            <p style={{ marginBottom: '1.5rem' }}>{t('cooldown_modal_body')}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCooldownModal(false)} className="btn btn-primary" style={{ padding: '0.6rem 1rem', flex: 1 }}>
                {t('understood')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreadView;
