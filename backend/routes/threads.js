const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const sendEmail = require('../utils/sendEmail');
const { requireAuth, requireVerified, requireRole } = require('../middleware/authMiddleware');
const appEmitter = require('../utils/eventEmitter');
const { recordAudit, AUDIT_ACTIONS } = require('../utils/auditLog');
const { badObjectId } = require('../utils/objectId');
const { LIMITS, tooLong } = require('../utils/limits');

// An admin reviewing the log recognises a thread by who it is between, never by its id.
const threadLabel = (thread) => `${thread.sender?.displayName || 'Unknown'} → ${thread.receiver?.displayName || 'Unknown'}`;

// Emails are fire-and-forget side effects. Deleting a user leaves null behind in
// populated refs, so an unguarded recipient would turn a successful mutation into
// a 500 after the save already committed.
const notifyEmail = (to, subject, html) => {
  if (!to) return;
  sendEmail(to, subject, html).catch(err => console.error('Failed to send email:', err));
};

// Get all pending deletion requests (Admin only)
router.get('/admin/deletion-requests', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    const requests = await Thread.find({ deletionRequestStatus: 'Pending', deletedAt: null })
      .populate('sender', 'displayName email')
      .populate('receiver', 'displayName email')
      .sort({ deletionRequestedAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching deletion requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve deletion request (Admin only)
router.put('/admin/:id/approve-deletion', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.deletionRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'Request is not pending.' });
    }

    const label = threadLabel(thread);
    const before = { deletionRequestStatus: thread.deletionRequestStatus, deletedAt: thread.deletedAt };

    thread.deletionRequestStatus = 'Approved';
    thread.deletedAt = new Date();
    await thread.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.THREAD_DELETION_APPROVE,
      targetType: 'THREAD',
      target: thread._id,
      targetLabel: label,
      before,
      after: { deletionRequestStatus: thread.deletionRequestStatus, deletedAt: thread.deletedAt },
      summary: `Approved the deletion of the thread ${label}`,
    });

    notifyEmail(
      thread.sender?.email,
      'Thread Deletion Approved',
      '<p>Your request to delete the thread has been approved. It will be permanently removed in 60 days.</p>'
    );

    notifyEmail(
      thread.receiver?.email,
      'Thread Deleted',
      '<p>A thread you were participating in has been deleted.</p>'
    );

    res.json({ message: 'Deletion approved', thread });
  } catch (error) {
    console.error('Error approving deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject deletion request (Admin only)
router.put('/admin/:id/reject-deletion', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    // receiver is populated only so the audit label can name both sides of the thread.
    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.deletionRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'Request is not pending.' });
    }

    const label = threadLabel(thread);
    const before = { deletionRequestStatus: thread.deletionRequestStatus };

    thread.deletionRequestStatus = 'Rejected';
    await thread.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.THREAD_DELETION_REJECT,
      targetType: 'THREAD',
      target: thread._id,
      targetLabel: label,
      before,
      after: { deletionRequestStatus: thread.deletionRequestStatus },
      summary: `Rejected the deletion request for the thread ${label}`,
    });

    notifyEmail(
      thread.sender?.email,
      'Thread Deletion Rejected',
      '<p>Your request to delete the thread has been rejected by an administrator.</p>'
    );

    res.json({ message: 'Deletion rejected', thread });
  } catch (error) {
    console.error('Error rejecting deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all pending restore requests (Admin only)
router.get('/admin/restore-requests', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    const requests = await Thread.find({ restoreRequestStatus: 'Pending', deletedAt: { $ne: null } })
      .populate('sender', 'displayName email')
      .populate('receiver', 'displayName email')
      .sort({ updatedAt: -1 });
    res.json(requests);
  } catch (error) {
    console.error('Error fetching restore requests:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Approve restore request (Admin only)
router.put('/admin/:id/approve-restore', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.restoreRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'Restore request is not pending.' });
    }

    const label = threadLabel(thread);
    const before = { restoreRequestStatus: thread.restoreRequestStatus, deletedAt: thread.deletedAt };

    thread.deletedAt = null;
    thread.restoreRequestStatus = 'Approved';
    thread.deletionRequestStatus = 'None';
    thread.lastRestoredAt = new Date();
    await thread.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.THREAD_RESTORE_APPROVE,
      targetType: 'THREAD',
      target: thread._id,
      targetLabel: label,
      before,
      after: { restoreRequestStatus: thread.restoreRequestStatus, deletedAt: thread.deletedAt },
      summary: `Approved the restoration of the thread ${label}`,
    });

    notifyEmail(
      thread.sender?.email,
      'Thread Restoration Approved',
      '<p>Your request to restore the thread has been approved. It is back in your active dashboard.</p>'
    );

    notifyEmail(
      thread.receiver?.email,
      'Thread Restored',
      '<p>A previously deleted thread you were participating in has been restored and is back in your dashboard.</p>'
    );

    res.json({ message: 'Restoration approved', thread });
  } catch (error) {
    console.error('Error approving restoration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reject restore request (Admin only)
router.put('/admin/:id/reject-restore', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    // receiver is populated only so the audit label can name both sides of the thread.
    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.restoreRequestStatus !== 'Pending') {
      return res.status(400).json({ message: 'Restore request is not pending.' });
    }

    const label = threadLabel(thread);
    const before = { restoreRequestStatus: thread.restoreRequestStatus };

    thread.restoreRequestStatus = 'Rejected';
    await thread.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.THREAD_RESTORE_REJECT,
      targetType: 'THREAD',
      target: thread._id,
      targetLabel: label,
      before,
      after: { restoreRequestStatus: thread.restoreRequestStatus },
      summary: `Rejected the restore request for the thread ${label}`,
    });

    notifyEmail(
      thread.sender?.email,
      'Thread Restoration Rejected',
      '<p>Your request to restore the thread has been rejected by an administrator.</p>'
    );

    res.json({ message: 'Restoration rejected', thread });
  } catch (error) {
    console.error('Error rejecting restoration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recently deleted threads (Admin only)
router.get('/admin/recently-deleted', requireAuth, requireVerified, requireRole(['ADMIN']), async (req, res) => {
  try {
    const threads = await Thread.find({ deletedAt: { $ne: null } })
      .populate('sender', 'displayName email')
      .populate('receiver', 'displayName email')
      .sort({ deletedAt: -1 });
    res.json(threads);
  } catch (error) {
    console.error('Error fetching recently deleted:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get sender's recently deleted threads
router.get('/recently-deleted', requireAuth, requireVerified, async (req, res) => {
  try {
    const threads = await Thread.find({ sender: req.user._id, deletedAt: { $ne: null } })
      .populate('receiver', 'displayName')
      .sort({ deletedAt: -1 });
    res.json(threads);
  } catch (error) {
    console.error('Error fetching sender recently deleted:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's threads
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { type } = req.query;
    if (!type || (type !== 'sent' && type !== 'received')) {
      return res.status(400).json({ message: 'Please specify ?type=sent or ?type=received.' });
    }

    let query = { deletedAt: null }; // Exclude deleted threads
    if (type === 'sent') {
      query.sender = req.user._id;
      // INCLUDES resolved threads
    } else if (type === 'received') {
      query.receiver = req.user._id;
      // EXCLUDES resolved threads
      query.status = { $ne: 'Resolved' };
    }

    const threads = await Thread.find(query)
      .populate('receiver', 'displayName')
      .populate('sender', 'displayName email') // populated for processing, stripped later if needed
      .sort({ updatedAt: -1 });

    const formattedThreads = threads.map(t => {
      const threadObj = t.toObject();
      if (type === 'received') {
        threadObj.sender = { _id: t.sender?._id, displayName: 'Anonymous' };
      }
      // If type === 'sent', the sender CAN see the receiver's display name.
      return threadObj;
    });

    res.json(formattedThreads);
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get archived threads (Resolved received)
// MUST BE REGISTERED BEFORE /:id
router.get('/archive', requireAuth, requireVerified, async (req, res) => {
  try {
    const threads = await Thread.find({ receiver: req.user._id, status: 'Resolved', deletedAt: null })
      .populate('receiver', 'displayName')
      .sort({ resolvedAt: -1 });

    const formattedThreads = threads.map(t => {
      const threadObj = t.toObject();
      threadObj.sender = { _id: t.sender, displayName: 'Anonymous' };
      return threadObj;
    });

    res.json(formattedThreads);
  } catch (error) {
    console.error('Error fetching archive:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// A malformed :id otherwise reaches findById and surfaces a CastError as a 500
// 'Server error'. Registered after the static prefixes (/admin, /archive, ...)
// so those are matched first, and before every /:id handler below.
router.use('/:id', (req, res, next) => {
  if (badObjectId(res, req.params.id)) return;
  next();
});

// SSE endpoint for thread updates
router.get('/:id/events', requireAuth, requireVerified, async (req, res) => {
  // The stream must not leak activity to someone who is not on the thread.
  // An authenticated member could otherwise watch another pair's mirror —
  // including the anonymous receiver's — update in real time.
  const thread = await Thread.findById(req.params.id).select('sender receiver');
  if (!thread) return res.status(404).json({ message: 'Thread not found' });

  const isSender = String(thread.sender) === String(req.user._id);
  const isReceiver = String(thread.receiver) === String(req.user._id);
  if (!isSender && !isReceiver) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const threadId = req.params.id;

  const onUpdate = () => {
    res.write(`data: ${JSON.stringify({ type: 'UPDATE' })}\n\n`);
  };

  // Send an initial ping so the client knows connection is established
  res.write(`data: ${JSON.stringify({ type: 'PING' })}\n\n`);

  appEmitter.on(`threadUpdate_${threadId}`, onUpdate);

  // Keep connection alive with periodic pings (every 30 seconds)
  const pingInterval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'PING' })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(pingInterval);
    appEmitter.off(`threadUpdate_${threadId}`, onUpdate);
  });
});

// Get thread details
router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id)
      .populate('receiver', 'displayName')
      .populate('sender', 'displayName email');

    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    const isSender = thread.sender?._id?.toString() === req.user._id.toString();
    const isReceiver = thread.receiver?._id?.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark message as read if it's the other party viewing it

    // Mark message as read if it's the other party viewing it
    let saved = false;
    if (thread.messages.length > 0) {
      const lastMessage = thread.messages[thread.messages.length - 1];
      const viewerAuthorType = isSender ? 'Sender' : 'Receiver';
      if (lastMessage.authorType !== viewerAuthorType && !lastMessage.readAt) {
        lastMessage.readAt = new Date();
        saved = true;
      }
    }
    
    if (saved) {
      await thread.save();
    }

    const threadObj = thread.toObject();

    if (isReceiver) {
      threadObj.sender = { _id: thread.sender?._id, displayName: 'Anonymous' };
    } else if (isSender) {
      // Sender can view full thread details, even if resolved.
      // We don't expose receiver email
      threadObj.receiver = { _id: thread.receiver?._id, displayName: thread.receiver?.displayName };
      threadObj.sender = { _id: thread.sender?._id, displayName: thread.sender?.displayName };
    }

    res.json(threadObj);
  } catch (error) {
    console.error('Error fetching thread details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request thread deletion (Sender only)
router.post('/:id/request-deletion', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the sender can request deletion.' });
    }

    if (thread.status === 'Resolved') {
      return res.status(400).json({ message: 'Cannot request deletion for a resolved thread.' });
    }

    if (thread.deletionRequestStatus === 'Pending') {
      return res.status(400).json({ message: 'Deletion request is already pending.' });
    }

    if (thread.lastRestoredAt) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (thread.lastRestoredAt > oneHourAgo) {
        return res.status(400).json({ message: 'You must wait 1 hour after a thread is restored before requesting deletion again.' });
      }
    }

    thread.deletionRequestStatus = 'Pending';
    thread.deletionRequestedAt = new Date();
    await thread.save();

    res.json({ message: 'Deletion requested successfully', thread });
  } catch (error) {
    console.error('Error requesting deletion:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request thread restoration (Sender only)
router.post('/:id/request-restore', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the sender can request restoration.' });
    }

    if (!thread.deletedAt) {
      return res.status(400).json({ message: 'Thread is not currently deleted.' });
    }

    if (thread.restoreRequestStatus === 'Pending') {
      return res.status(400).json({ message: 'Restore request is already pending.' });
    }

    thread.restoreRequestStatus = 'Pending';
    await thread.save();

    res.json({ message: 'Restoration requested successfully', thread });
  } catch (error) {
    console.error('Error requesting restoration:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create initial mirror message
router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { receiverId, content, topic } = req.body;
    
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot send a mirror to yourself.' });
    }
    for (const field of ['concern', 'impact', 'desiredChange']) {
      if (tooLong(content?.[field], 'THREAD_FIELD')) {
        return res.status(400).json({ message: `${field} is too long (max ${LIMITS.THREAD_FIELD} characters).` });
      }
    }
    if (tooLong(content?.bibleVerse, 'THREAD_VERSE')) {
      return res.status(400).json({ message: 'bibleVerse is too long (max 2000 characters).' });
    }

    const thread = new Thread({
      sender: req.user._id,
      receiver: receiverId,
      topic: topic ? topic.trim().slice(0, 80) : '',
      messages: [{
        authorType: 'Sender',
        isInitial: true,
        content: {
          concern: content.concern,
          impact: content.impact,
          desiredChange: content.desiredChange,
          bibleVerse: content.bibleVerse
        }
      }]
    });

    await thread.save();
    
    await thread.populate('receiver');

    notifyEmail(
      thread.receiver?.email,
      'You have received a Gentle Mirror message',
      '<p>You have received a Gentle Mirror message. Log in to read it.</p>'
    );

    res.status(201).json({ message: 'Mirror sent successfully', thread });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit a reply
router.post('/:id/reply', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('receiver').populate('sender');
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.status === 'Resolved' || thread.status === 'Accepted') {
      return res.status(400).json({ message: 'Thread is closed to new replies.' });
    }

    const isSender = thread.sender?._id?.toString() === req.user._id.toString();
    const isReceiver = thread.receiver?._id?.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Determine turn
    const lastMessage = thread.messages[thread.messages.length - 1];
    const authorType = isSender ? 'Sender' : 'Receiver';

    if (lastMessage.authorType === authorType) {
      return res.status(400).json({ message: 'It is not your turn to reply.' });
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const readAtDate = lastMessage.readAt ? new Date(lastMessage.readAt) : new Date();
    if (readAtDate > oneHourAgo) {
      return res.status(400).json({ message: 'Mangyaring maghintay ng isang oras (1 hour) bago sumagot upang makapagnilay nang maayos.' });
    }

    if (isSender && thread.senderRepliesUsed >= 3) {
      return res.status(400).json({ message: 'You have used all your replies for this thread.' });
    }
    if (isReceiver && thread.receiverRepliesUsed >= 3) {
      return res.status(400).json({ message: 'You have used all your replies for this thread.' });
    }

    const { content } = req.body;
    for (const field of ['clarification', 'feelings', 'acknowledgment', 'hopedUnderstanding']) {
      if (tooLong(content?.[field], 'THREAD_FIELD')) {
        return res.status(400).json({ message: `${field} is too long (max ${LIMITS.THREAD_FIELD} characters).` });
      }
    }
    if (tooLong(content?.bibleVerse, 'THREAD_VERSE')) {
      return res.status(400).json({ message: 'bibleVerse is too long (max 2000 characters).' });
    }

    thread.messages.push({
      authorType,
      isInitial: false,
      content: {
        clarification: content.clarification,
        feelings: content.feelings,
        acknowledgment: content.acknowledgment,
        hopedUnderstanding: content.hopedUnderstanding,
        bibleVerse: content.bibleVerse
      }
    });

    if (isSender) thread.senderRepliesUsed += 1;
    if (isReceiver) thread.receiverRepliesUsed += 1;

    // Check if auto-escalation should happen
    if (thread.senderRepliesUsed >= 3 && thread.receiverRepliesUsed >= 3) {
      thread.status = 'Escalated';

      notifyEmail(
        thread.sender?.email,
        'Thread Escalated',
        '<p>Your thread has automatically been escalated to a counselor because the maximum reply limit was reached.</p>'
      );

      notifyEmail(
        thread.receiver?.email,
        'Thread Escalated',
        '<p>Your thread has automatically been escalated to a counselor because the maximum reply limit was reached.</p>'
      );
    }

    await thread.save();

    const notifyUser = isSender ? thread.receiver : thread.sender;

    notifyEmail(
      notifyUser?.email,
      'New reply in your Gentle Mirror thread',
      '<p>You have a new reply in your Gentle Mirror thread. Log in to read it.</p>'
    );

    res.json({ message: 'Reply sent successfully', thread });
  } catch (error) {
    console.error('Error replying to thread:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as resolved (Sender only)
router.put('/:id/resolve', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('receiver');
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.status === 'Resolved') {
      return res.status(400).json({ message: 'This thread is already resolved.' });
    }

    if (thread.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the sender can mark a thread as resolved.' });
    }

    thread.status = 'Resolved';
    thread.resolvedAt = new Date();
    await thread.save();

    notifyEmail(
      thread.receiver?.email,
      'Your Gentle Mirror thread has been resolved',
      '<p>Your thread has been marked as resolved. Thank you for your openness to growth.</p>'
    );

    res.json({ message: 'Thread resolved successfully', thread });
  } catch (error) {
    console.error('Error resolving thread:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark as accepted (Receiver only)
router.put('/:id/accept', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('sender');
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.status !== 'Active') {
      return res.status(400).json({ message: 'This thread cannot be accepted.' });
    }

    if (thread.receiver.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Only the receiver can accept a thread.' });
    }

    thread.status = 'Accepted';
    thread.acceptedAt = new Date();
    await thread.save();

    notifyEmail(
      thread.sender?.email,
      'Your Gentle Mirror has been accepted',
      '<p>The receiver has accepted your Gentle Mirror and is willing to change.</p>'
    );

    res.json({ message: 'Thread accepted successfully', thread });
  } catch (error) {
    console.error('Error accepting thread:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request early escalation
router.post('/:id/escalate', requireAuth, requireVerified, async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('receiver').populate('sender');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    if (thread.status !== 'Active') {
      return res.status(400).json({ message: 'Thread is not active' });
    }

    const isSender = thread.sender?._id?.toString() === req.user._id.toString();
    const isReceiver = thread.receiver?._id?.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) return res.status(403).json({ message: 'Access denied' });

    if (thread.earlyEscalationRequestedBy) {
      return res.status(400).json({ message: 'Early escalation already requested' });
    }

    thread.earlyEscalationRequestedBy = isSender ? 'Sender' : 'Receiver';
    thread.escalationRequestCount = (thread.escalationRequestCount || 0) + 1;
    if (isSender) {
      thread.earlyEscalationSenderConsent = 'Approved';
      thread.earlyEscalationReceiverConsent = 'Pending';
    } else {
      thread.earlyEscalationReceiverConsent = 'Approved';
      thread.earlyEscalationSenderConsent = 'Pending';
    }

    await thread.save();

    const notifyUser = isSender ? thread.receiver : thread.sender;

    notifyEmail(
      notifyUser?.email,
      'Counselor Support Requested',
      '<p>The other person in your Gentle Mirror thread is requesting counselor support. Log in to review the request.</p>'
    );

    res.json({ message: 'Escalation requested', thread });
  } catch (error) {
    console.error('Error requesting escalation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Consent to early escalation
router.put('/:id/consent-escalation', requireAuth, requireVerified, async (req, res) => {
  try {
    const { consent } = req.body; // 'Approved' or 'Declined'
    if (!['Approved', 'Declined'].includes(consent)) {
      return res.status(400).json({ message: 'Invalid consent value' });
    }

    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const isSender = thread.sender?._id?.toString() === req.user._id.toString();
    const isReceiver = thread.receiver?._id?.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) return res.status(403).json({ message: 'Access denied' });

    if (isSender) {
      thread.earlyEscalationSenderConsent = consent;
    } else {
      thread.earlyEscalationReceiverConsent = consent;
    }

    if (consent === 'Declined') {
      thread.earlyEscalationRequestedBy = null;
      thread.earlyEscalationSenderConsent = 'None';
      thread.earlyEscalationReceiverConsent = 'None';
      thread.escalationDeclinedCount = (thread.escalationDeclinedCount || 0) + 1;
      // notify requester
      const notifyUser = isSender ? thread.receiver : thread.sender;
      notifyEmail(
        notifyUser?.email,
        'Counselor Support Declined',
        '<p>The other person in your Gentle Mirror thread has declined the request for counselor support.</p>'
      );
    } else if (thread.earlyEscalationSenderConsent === 'Approved' && thread.earlyEscalationReceiverConsent === 'Approved') {
      thread.status = 'Escalated';
      // Notify counselors
    }

    await thread.save();
    res.json({ message: 'Consent updated', thread });
  } catch (error) {
    console.error('Error consenting to escalation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Consent to counselor access
router.put('/:id/counselor-consent', requireAuth, requireVerified, async (req, res) => {
  try {
    const { consent } = req.body; // 'Approved' or 'Declined'
    if (!['Approved', 'Declined'].includes(consent)) {
      return res.status(400).json({ message: 'Invalid consent value' });
    }

    const thread = await Thread.findById(req.params.id);
    if (!thread) return res.status(404).json({ message: 'Thread not found' });

    const isSender = thread.sender.toString() === req.user._id.toString();
    const isReceiver = thread.receiver.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) return res.status(403).json({ message: 'Access denied' });

    if (isSender) {
      thread.counselorConsentSender = consent;
    } else {
      thread.counselorConsentReceiver = consent;
    }

    await thread.save();

    res.json({ message: 'Counselor consent updated', thread });
  } catch (error) {
    console.error('Error in counselor consent:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
