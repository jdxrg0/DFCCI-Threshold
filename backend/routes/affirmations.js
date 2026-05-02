const express = require('express');
const router = express.Router();
const Affirmation = require('../models/Affirmation');
const Notification = require('../models/Notification');
const sendEmail = require('../utils/sendEmail');
const { requireAuth, requireVerified } = require('../middleware/authMiddleware');

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
router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    const affirmation = await Affirmation.findById(req.params.id)
      .populate('sender', 'displayName')
      .populate('receiver', 'displayName');

    if (!affirmation) return res.status(404).json({ message: 'Affirmation not found' });

    const isSender   = affirmation.sender._id.toString()   === req.user._id.toString();
    const isReceiver = affirmation.receiver._id.toString() === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Mark as read for receiver on first open
    if (isReceiver && !affirmation.readAt) {
      affirmation.readAt = new Date();
      await affirmation.save();
    }

    // Mark related notifications as read
    await Notification.updateMany(
      { user: req.user._id, thread: req.params.id, read: false },
      { $set: { read: true } }
    );

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

    // Notify receiver
    await Notification.create({
      user:    receiverId,
      type:    'NewAffirmation',
      message: `Someone sent you a Shining Light affirmation.`,
      // Reuse the `thread` field to store the affirmation ID for link resolution
      thread:  affirmation._id,
    });

    sendEmail(
      affirmation.receiver.email,
      'You received a Shining Light affirmation!',
      `<p><strong>A fellow member</strong> just sent you a Shining Light — a word of appreciation and encouragement. Log in to read it.</p>`
    ).catch(err => console.error('Failed to send affirmation email:', err));

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

    const isReceiver = affirmation.receiver._id.toString() === req.user._id.toString();
    if (!isReceiver) return res.status(403).json({ message: 'Only the receiver can reply.' });

    if (affirmation.reply?.sentAt) {
      return res.status(400).json({ message: 'You have already replied to this affirmation.' });
    }

    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Reply cannot be empty.' });

    affirmation.reply = { text: text.trim(), sentAt: new Date() };
    await affirmation.save();

    // Notify sender
    await Notification.create({
      user:    affirmation.sender._id,
      type:    'AffirmationReply',
      message: `${affirmation.receiver.displayName} replied to your Shining Light.`,
      thread:  affirmation._id,
    });

    sendEmail(
      affirmation.sender.email,
      'Your Shining Light received a thank-you reply',
      `<p><strong>${affirmation.receiver.displayName}</strong> replied to the affirmation you sent. Log in to read their response.</p>`
    ).catch(err => console.error('Failed to send reply email:', err));

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

    // Notify sender
    await Notification.create({
      user:    affirmation.sender._id,
      type:    'AffirmationReceived',
      message: 'Your Shining Light has been received with gratitude.',
      thread:  affirmation._id,
    });

    sendEmail(
      affirmation.sender.email,
      'Your Shining Light was received with gratitude',
      `<p>The recipient has acknowledged and accepted your Shining Light with gratitude. Thank you for being a light in their life.</p>`
    ).catch(err => console.error('Failed to send received email:', err));

    res.json({ message: 'Marked as received with gratitude', affirmation });
  } catch (error) {
    console.error('Error marking received:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
