const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');
const { badObjectId } = require('../utils/objectId');

// Emails are fire-and-forget side effects; a deleted user leaves a null populate.
const notifyEmail = (to, subject, html) => {
  if (!to) return;
  sendEmail(to, subject, html).catch(err => console.error('Failed to send email:', err));
};

// List escalated threads requiring attention
router.get('/threads', requireAuth, requireRole(['COUNSELOR', 'ADMIN']), async (req, res) => {
  try {
    const threads = await Thread.find({ status: 'Escalated' })
      .populate('receiver', 'displayName') // Anonymize sender by not populating sender details
      .sort({ updatedAt: -1 });

    // The counselor sees them. Sender is kept anonymous.
    const anonymizedThreads = threads.map(t => {
      const threadObj = t.toObject();
      threadObj.sender = { _id: t.sender, displayName: 'Anonymous' };
      // Strip messages to keep it lightweight, or keep them if needed. 
      // The counselor can't see messages anyway until both consent.
      threadObj.messages = [];
      return threadObj;
    });

    res.json(anonymizedThreads);
  } catch (error) {
    console.error('Error fetching counselor threads:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Guard the /threads/:id handlers (registered after the static /threads list).
router.use('/threads/:id', (req, res, next) => {
  if (badObjectId(res, req.params.id)) return;
  next();
});

// Request consent from parties
router.post('/threads/:id/request-access', requireAuth, requireRole(['COUNSELOR', 'ADMIN']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('sender').populate('receiver');
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.status !== 'Escalated') {
      return res.status(400).json({ message: 'Thread is not escalated' });
    }

    if (thread.counselorConsentSender !== 'None' || thread.counselorConsentReceiver !== 'None') {
       return res.status(400).json({ message: 'Consent already requested' });
    }

    thread.counselorConsentSender = 'Pending';
    thread.counselorConsentReceiver = 'Pending';
    thread.counselorId = req.user._id;
    await thread.save();

    notifyEmail(
      thread.sender?.email,
      'Counselor Access Request',
      '<p>A counselor is requesting access to view your escalated thread. Log in to approve or decline the request.</p>'
    );

    notifyEmail(
      thread.receiver?.email,
      'Counselor Access Request',
      '<p>A counselor is requesting access to view your escalated thread. Log in to approve or decline the request.</p>'
    );

    res.json({ message: 'Consent requested from both parties', thread });
  } catch (error) {
    console.error('Error requesting access:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// View thread details
router.get('/threads/:id', requireAuth, requireRole(['COUNSELOR', 'ADMIN']), async (req, res) => {
  try {
    const thread = await Thread.findById(req.params.id).populate('receiver', 'displayName');
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }

    if (thread.counselorConsentSender !== 'Approved' || thread.counselorConsentReceiver !== 'Approved') {
      return res.status(403).json({ message: 'Access denied. Both parties must approve access.' });
    }

    const threadObj = thread.toObject();
    // Enforce Sender Anonymity
    threadObj.sender = { _id: thread.sender, displayName: 'Anonymous' };
    
    res.json(threadObj);
  } catch (error) {
    console.error('Error fetching thread details for counselor:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
