const express = require('express');
const router = express.Router();
const Affirmation = require('../models/Affirmation');
const sendEmail = require('../utils/sendEmail');
const { requireAuth, requireVerified } = require('../middleware/authMiddleware');
const { badObjectId } = require('../utils/objectId');
const { escapeHtml } = require('../utils/escapeHtml');
const { LIMITS, tooLong } = require('../utils/limits');

// Emails are fire-and-forget side effects; a deleted user leaves a null populate.
const notifyEmail = (to, subject, html) => {
  if (!to) return;
  sendEmail(to, subject, html).catch(err => console.error('Failed to send email:', err));
};

// ─── GET all affirmations for the current user ──────────────────────────────
// Returns two arrays: received[] and sent[]
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const [received, sent] = await Promise.all([
      Affirmation.find({ receiver: req.user._id })
        .populate('sender', 'displayName')
        .sort({ createdAt: -1 }),
      Affirmation.find({ sender: req.user._id })
        .populate('receiver', 'displayName')
        .sort({ createdAt: -1 }),
    ]);
    res.json({ received, sent });
  } catch (error) {
    console.error('Error fetching affirmations:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET a single affirmation ───────────────────────────────────────────────
router.use('/:id', (req, res, next) => {
  if (badObjectId(res, req.params.id)) return;
  next();
});

router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const affirmation = await Affirmation.findById(req.params.id)
      .populate('sender', 'displayName')
      .populate('receiver', 'displayName');

    if (!affirmation) return res.status(404).json({ message: 'Affirmation not found' });

    const isSender   = affirmation.sender?._id?.toString()   === req.user._id.toString();
    const isReceiver = affirmation.receiver?._id?.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark as read for receiver on first open
    if (isReceiver && !affirmation.readAt) {
      affirmation.readAt = new Date();
      await affirmation.save();
    }

    res.json(affirmation);
  } catch (error) {
    console.error('Error fetching affirmation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST send a new affirmation ────────────────────────────────────────────
router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { receiverId, topic, content } = req.body;

    if (!receiverId) return res.status(400).json({ message: 'A recipient is required.' });
    if (receiverId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot send an affirmation to yourself.' });
    }
    if (!content?.appreciation?.trim() || !content?.impact?.trim() ||
        !content?.encouragement?.trim() || !content?.bibleVerse?.trim()) {
      return res.status(400).json({ message: 'All four fields are required.' });
    }
    for (const field of ['appreciation', 'impact', 'encouragement', 'bibleVerse']) {
      if (tooLong(content?.[field], 'AFFIRMATION_FIELD')) {
        return res.status(400).json({ message: `${field} is too long (max ${LIMITS.AFFIRMATION_FIELD} characters).` });
      }
    }

    const affirmation = await Affirmation.create({
      sender:   req.user._id,
      receiver: receiverId,
      topic:    topic ? topic.trim().slice(0, 80) : '',
      content: {
        appreciation:  content.appreciation.trim(),
        impact:        content.impact.trim(),
        encouragement: content.encouragement.trim(),
        bibleVerse:    content.bibleVerse.trim(),
      },
    });

    await affirmation.populate('receiver');

    notifyEmail(
      affirmation.receiver?.email,
      'You received a Shining Light affirmation!',
      `<p><strong>A fellow member</strong> just sent you a Shining Light — a word of appreciation and encouragement. Log in to read it.</p>`
    );

    res.status(201).json({ message: 'Affirmation sent successfully', affirmation });
  } catch (error) {
    console.error('Error sending affirmation:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST receiver sends a thank-you reply ──────────────────────────────────
router.post('/:id/reply', requireAuth, requireVerified, async (req, res) => {
  try {
    const affirmation = await Affirmation.findById(req.params.id)
      .populate('sender', 'displayName email')
      .populate('receiver', 'displayName');

    if (!affirmation) return res.status(404).json({ message: 'Affirmation not found' });

    const isReceiver = affirmation.receiver?._id?.toString() === req.user._id.toString();
    if (!isReceiver) return res.status(403).json({ message: 'Only the receiver can reply.' });

    if (affirmation.reply?.sentAt) {
      return res.status(400).json({ message: 'You have already replied to this affirmation.' });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Reply cannot be empty.' });
    if (tooLong(text, 'AFFIRMATION_REPLY')) {
      return res.status(400).json({ message: `Reply is too long (max ${LIMITS.AFFIRMATION_REPLY} characters).` });
    }

    affirmation.reply = { text: text.trim(), sentAt: new Date() };
    await affirmation.save();

    notifyEmail(
      affirmation.sender?.email,
      'Your Shining Light received a thank-you reply',
      `<p><strong>${escapeHtml(affirmation.receiver?.displayName || 'Someone')}</strong> replied to the affirmation you sent. Log in to read their response.</p>`
    );

    res.json({ message: 'Reply sent successfully', affirmation });
  } catch (error) {
    console.error('Error sending reply:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT receiver marks "Received with Gratitude" ───────────────────────────
router.put('/:id/receive', requireAuth, requireVerified, async (req, res) => {
  try {
    const affirmation = await Affirmation.findById(req.params.id)
      .populate('sender', 'displayName email');

    if (!affirmation) return res.status(404).json({ message: 'Affirmation not found' });

    const isReceiver = affirmation.receiver.toString() === req.user._id.toString();
    if (!isReceiver) return res.status(403).json({ message: 'Only the receiver can mark this.' });

    if (affirmation.status === 'Received') {
      return res.status(400).json({ message: 'Already marked as received.' });
    }

    affirmation.status     = 'Received';
    affirmation.receivedAt = new Date();
    await affirmation.save();

    notifyEmail(
      affirmation.sender?.email,
      'Your Shining Light was received with gratitude',
      `<p>The recipient has acknowledged and accepted your Shining Light with gratitude. Thank you for being a light in their life.</p>`
    );

    res.json({ message: 'Marked as received with gratitude', affirmation });
  } catch (error) {
    console.error('Error marking received:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
