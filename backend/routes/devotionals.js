const express = require('express');
const router = express.Router();
const Devotional = require('../models/Devotional');
const User = require('../models/User');

const { parsePassage } = require('../utils/passageParser');
const { requireAuth, requireVerified, requireRole } = require('../middleware/authMiddleware');
const { sendDevotionalStreakReminders } = require('../utils/reminderScheduler');
const { isValidObjectId, badObjectId } = require('../utils/objectId');

// ─── Helper: normalise a Date to midnight UTC ──────────────────────────────
const toDateOnly = (d) => {
  const dt = new Date(d);
  dt.setUTCHours(0, 0, 0, 0);
  return dt;
};

const getUTC8Today = () => {
  const now = new Date();
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  utc8Time.setUTCHours(0, 0, 0, 0);
  return utc8Time;
};

// ─── GET own devotionals (paginated, filterable) ────────────────────────────
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { month, year, page = 1, limit = 10 } = req.query;
    const filter = { member: req.user._id };

    if (year) {
      const y = parseInt(year, 10);
      const m = month ? parseInt(month, 10) - 1 : 0;
      const start = month
        ? new Date(Date.UTC(y, m, 1))
        : new Date(Date.UTC(y, 0, 1));
      const end = month
        ? new Date(Date.UTC(y, m + 1, 1))
        : new Date(Date.UTC(y + 1, 0, 1));
      filter.date = { $gte: start, $lt: end };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [devotionals, total] = await Promise.all([
      Devotional.find(filter)
        .populate('acknowledgedBy', 'displayName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Devotional.countDocuments(filter),
    ]);

    res.json({ devotionals, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (error) {
    console.error('Error fetching devotionals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET personal stats & streak ────────────────────────────────────────────
router.get('/stats', requireAuth, requireVerified, async (req, res) => {
  try {
    // All distinct dates the member submitted a devotional, sorted descending
    const entries = await Devotional.find({ member: req.user._id, status: { $ne: 'Missed' } })
      .select('date')
      .sort({ date: -1 })
      .lean();

    const totalEntries = entries.length;
    if (totalEntries === 0) {
      return res.json({ totalEntries: 0, currentStreak: 0, longestStreak: 0, thisMonth: 0, acknowledged: 0 });
    }

    // Build a set of date strings for streak calculation
    const dateSet = new Set(entries.map(e => toDateOnly(e.date).toISOString().slice(0, 10)));
    const sortedDates = [...dateSet].sort().reverse(); // most recent first

    // Current streak: count consecutive days from today backwards
    const today = getUTC8Today();
    let currentStreak = 0;
    let checkDate = new Date(today);

    // Allow today or yesterday as start
    if (!dateSet.has(checkDate.toISOString().slice(0, 10))) {
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    while (dateSet.has(checkDate.toISOString().slice(0, 10))) {
      currentStreak++;
      checkDate.setUTCDate(checkDate.getUTCDate() - 1);
    }

    // Longest streak ever
    let longestStreak = 0;
    let tempStreak = 1;
    const allDatesAsc = [...dateSet].sort();
    for (let i = 1; i < allDatesAsc.length; i++) {
      const prev = new Date(allDatesAsc[i - 1]);
      const curr = new Date(allDatesAsc[i]);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // This month count
    const todayStr = getUTC8Today();
    const monthStart = new Date(Date.UTC(todayStr.getUTCFullYear(), todayStr.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(todayStr.getUTCFullYear(), todayStr.getUTCMonth() + 1, 1));
    const thisMonth = await Devotional.countDocuments({
      member: req.user._id,
      date: { $gte: monthStart, $lt: monthEnd },
      status: { $ne: 'Missed' },
    });

    // Acknowledged count
    const acknowledged = await Devotional.countDocuments({
      member: req.user._id,
      status: 'Acknowledged',
    });

    res.json({ totalEntries, currentStreak, longestStreak, thisMonth, acknowledged });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET calendar data (dates with entries for a given month) ────────────────
router.get('/calendar', requireAuth, requireVerified, async (req, res) => {
  try {
    const { year, month, memberId } = req.query;
    if (!year || !month) return res.status(400).json({ message: 'year and month are required' });

    let targetUserId = req.user._id;
    if (memberId && ['ADMIN', 'COUNSELOR'].includes(req.user.role)) {
      targetUserId = memberId;
    }

    const y = parseInt(year, 10);
    const m = parseInt(month, 10) - 1;
    const start = new Date(Date.UTC(y, m, 1));
    const end = new Date(Date.UTC(y, m + 1, 1));

    const entries = await Devotional.find({
      member: targetUserId,
      date: { $gte: start, $lt: end },
    }).select('date status passage').lean();

    const days = entries.map(e => ({
      date: toDateOnly(e.date).toISOString().slice(0, 10),
      status: (e.status === 'Acknowledged' && e.passage === 'None (Confessed)') ? 'Missed' : e.status,
    }));

    res.json(days);
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET check gap before a submission date ──────────────────────────────────
router.get('/check-gap', requireAuth, requireVerified, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ message: 'Date is required' });

    const targetDate = toDateOnly(date);

    // Find the latest entry for this member that is strictly before targetDate
    const prevEntry = await Devotional.findOne({
      member: req.user._id,
      date: { $lt: targetDate }
    }).sort({ date: -1 });

    if (!prevEntry) {
      return res.json({ hasGap: false, gapDates: [], lastEntryDate: null });
    }

    const lastEntryDate = toDateOnly(prevEntry.date);
    const gapDates = [];
    let current = new Date(lastEntryDate);
    current.setUTCDate(current.getUTCDate() + 1);

    while (current < targetDate) {
      gapDates.push(current.toISOString().slice(0, 10));
      current.setUTCDate(current.getUTCDate() + 1);
    }

    res.json({
      hasGap: gapDates.length > 0,
      gapDates,
      lastEntryDate: lastEntryDate.toISOString().slice(0, 10)
    });
  } catch (error) {
    console.error('Error checking gap:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET a single devotional ────────────────────────────────────────────────
router.get('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const devotional = await Devotional.findById(req.params.id)
      .populate('member', 'displayName email')
      .populate('acknowledgedBy', 'displayName');

    if (!devotional) return res.status(404).json({ message: 'Devotional not found' });

    // Access: owner or leader
    const isOwner = devotional.member?._id?.toString() === req.user._id.toString();
    const isLeader = ['ADMIN', 'COUNSELOR'].includes(req.user.role);

    if (!isOwner && !isLeader) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(devotional);
  } catch (error) {
    console.error('Error fetching devotional:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST submit a new devotional ──────────────────────────────────────────
router.post('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { date, book, passageStr, summary, application, prayerFocus, markGapsAsMissed } = req.body;

    if (!book?.trim()) return res.status(400).json({ message: 'Book is required.' });
    if (!passageStr?.trim()) return res.status(400).json({ message: 'Chapters/Verses are required.' });
    if (!summary?.trim()) return res.status(400).json({ message: 'Summary is required.' });
    if (!application?.trim()) return res.status(400).json({ message: 'Application is required.' });

    for (const [field, max] of [['book', 100], ['passageStr', 500], ['summary', 2000], ['application', 2000], ['prayerFocus', 2000]]) {
      if (tooLong(req.body[field], max)) {
        return res.status(400).json({ message: `${field} is too long (max ${max} characters).` });
      }
    }

    let parsedPassages;
    try {
      parsedPassages = parsePassage(book.trim(), passageStr.trim());
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }

    const passage = `${book.trim()} ${passageStr.trim()}`;

    const devotionDate = date ? toDateOnly(date) : getUTC8Today();

    // Restrict to 2 days ago / yesterday / today only
    const today = getUTC8Today();
    
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const hasCustomDatePower = req.user.customDatePowerExpires && new Date(req.user.customDatePowerExpires) > new Date();

    if (!hasCustomDatePower && (devotionDate < twoDaysAgo || devotionDate >= tomorrow)) {
      return res.status(400).json({ message: 'You can only submit devotionals for today, yesterday, or 2 days ago.' });
    }

    // Prevent duplicate entry for the same date
    const existing = await Devotional.findOne({ member: req.user._id, date: devotionDate });
    if (existing) {
      return res.status(400).json({ message: 'You already submitted a devotional for this date.' });
    }

    const devotional = await Devotional.create({
      member: req.user._id,
      date: devotionDate,
      book: book.trim(),
      passage: passage,
      parsedPassages: parsedPassages,
      summary: summary.trim(),
      application: application.trim(),
      prayerFocus: prayerFocus?.trim() || '',
    });

    if (markGapsAsMissed) {
      try {
        const prevEntry = await Devotional.findOne({
          member: req.user._id,
          date: { $lt: devotionDate }
        }).sort({ date: -1 }).select('date');

        if (prevEntry) {
          const lastEntryDate = toDateOnly(prevEntry.date);
          const gapDates = [];
          let current = new Date(lastEntryDate);
          current.setUTCDate(current.getUTCDate() + 1);

          while (current < devotionDate) {
            gapDates.push(new Date(current));
            current.setUTCDate(current.getUTCDate() + 1);
          }

          if (gapDates.length > 0) {
            // One range query instead of a findOne per gap day, then one
            // insertMany for everything that is genuinely missing.
            const existing = await Devotional.find({
              member: req.user._id,
              date: { $gte: lastEntryDate, $lte: devotionDate }
            }).select('date').lean();
            const existingSet = new Set(existing.map(e => toDateOnly(e.date).getTime()));

            const toInsert = gapDates
              .filter(d => !existingSet.has(toDateOnly(d).getTime()))
              .map(d => ({
                member: req.user._id,
                date: d,
                book: 'None',
                passage: 'None (Confessed)',
                summary: 'Confessed did not devotion.',
                application: 'Confessed did not devotion.',
                status: 'Missed',
              }));

            if (toInsert.length > 0) {
              await Devotional.insertMany(toInsert);
            }
          }
        }
      } catch (err) {
        console.error('Error auto-marking gaps as missed:', err);
      }
    }

    res.status(201).json({ message: 'Devotional submitted successfully', devotional });
  } catch (error) {
    console.error('Error submitting devotional:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST confess did not devotion (mark date as Missed) ────────────────────
router.post('/missed', requireAuth, requireVerified, async (req, res) => {
  try {
    const { date } = req.body;
    if (!date) return res.status(400).json({ message: 'Date is required.' });

    const devotionDate = toDateOnly(date);

    // Restrict to 2 days ago / yesterday / today only
    const today = getUTC8Today();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const hasCustomDatePower = req.user.customDatePowerExpires && new Date(req.user.customDatePowerExpires) > new Date();

    if (!hasCustomDatePower && (devotionDate < twoDaysAgo || devotionDate >= tomorrow)) {
      return res.status(400).json({ message: 'You can only mark dates for today, yesterday, or 2 days ago.' });
    }

    // Prevent duplicate entry for the same date
    const existing = await Devotional.findOne({ member: req.user._id, date: devotionDate });
    if (existing) {
      return res.status(400).json({ message: 'You already submitted an entry for this date.' });
    }

    const devotional = await Devotional.create({
      member: req.user._id,
      date: devotionDate,
      book: 'None',
      passage: 'None (Confessed)',
      summary: 'Confessed did not devotion.',
      application: 'Confessed did not devotion.',
      status: 'Missed',
    });

    res.status(201).json({ message: 'Marked as missed successfully', devotional });
  } catch (error) {
    console.error('Error marking date as missed:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT edit own devotional (only if not yet acknowledged) ─────────────────
router.put('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const devotional = await Devotional.findById(req.params.id);
    if (!devotional) return res.status(404).json({ message: 'Devotional not found' });

    if (devotional.member.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own devotionals.' });
    }

    if (devotional.status === 'Acknowledged') {
      return res.status(400).json({ message: 'Cannot edit an acknowledged devotional.' });
    }

    if (devotional.status === 'Missed') {
      return res.status(400).json({ message: 'Cannot edit a missed entry.' });
    }

    const { book, passageStr, summary, application, prayerFocus } = req.body;
    if (book !== undefined && passageStr !== undefined) {
      let parsedPassages;
      try {
        parsedPassages = parsePassage(book.trim(), passageStr.trim());
      } catch (err) {
        return res.status(400).json({ message: err.message });
      }
      devotional.book = book.trim();
      devotional.passage = `${book.trim()} ${passageStr.trim()}`;
      devotional.parsedPassages = parsedPassages;
    }
    if (summary !== undefined) devotional.summary = summary.trim();
    if (application !== undefined) devotional.application = application.trim();
    if (prayerFocus !== undefined) devotional.prayerFocus = prayerFocus?.trim() || '';

    await devotional.save();
    res.json({ message: 'Devotional updated', devotional });
  } catch (error) {
    console.error('Error updating devotional:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DELETE own devotional ──────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireVerified, async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const devotional = await Devotional.findById(req.params.id);
    if (!devotional) return res.status(404).json({ message: 'Devotional not found' });

    if (devotional.member.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own devotionals.' });
    }

    await Devotional.findByIdAndDelete(req.params.id);
    res.json({ message: 'Devotional deleted' });
  } catch (error) {
    console.error('Error deleting devotional:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// ─── LEADER ENDPOINTS (Counselor / Admin only) ─────────────────────────────
// ──────────────────────────────────────────────────────────────────────────────

// ─── GET all member devotionals (leader view) ───────────────────────────────
router.get('/leader/all', requireAuth, requireVerified, requireRole(['ADMIN', 'COUNSELOR']), async (req, res) => {
  try {
    const { memberId, status, page = 1, limit = 15 } = req.query;
    const filter = {};

    if (memberId && isValidObjectId(memberId)) filter.member = memberId;
    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [devotionals, total] = await Promise.all([
      Devotional.find(filter)
        .populate('member', 'displayName email')
        .populate('acknowledgedBy', 'displayName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      Devotional.countDocuments(filter),
    ]);

    res.json({ devotionals, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (error) {
    console.error('Error fetching leader devotionals:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET leader folders (all members with counts) ─────────────────────────
router.get('/leader/folders', requireAuth, requireVerified, requireRole(['ADMIN', 'COUNSELOR']), async (req, res) => {
  try {
    // Fetch all verified users
    const users = await User.find({ isVerified: true })
      .select('displayName profilePicture role')
      .lean();

    // Fetch counts and latest entry date from Devotionals
    const stats = await Devotional.aggregate([
      {
        $group: {
          _id: '$member',
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Submitted'] }, 1, 0] }
          },
          lastEntryDate: { $max: '$date' }
        }
      }
    ]);

    // Map stats to users
    const statsMap = {};
    stats.forEach(s => {
      statsMap[s._id.toString()] = { 
        total: s.total, 
        pending: s.pending,
        lastEntryDate: s.lastEntryDate
      };
    });

    const folders = users.map(u => ({
      _id: u._id,
      displayName: u.displayName,
      profilePicture: u.profilePicture,
      role: u.role,
      total: statsMap[u._id.toString()]?.total || 0,
      pending: statsMap[u._id.toString()]?.pending || 0,
      lastEntryDate: statsMap[u._id.toString()]?.lastEntryDate || null
    }));

    // Sort by pending count (desc), then latest entry date (desc), then name
    folders.sort((a, b) => {
      if (b.pending !== a.pending) return b.pending - a.pending;
      
      const dateA = a.lastEntryDate ? new Date(a.lastEntryDate) : new Date(0);
      const dateB = b.lastEntryDate ? new Date(b.lastEntryDate) : new Date(0);
      if (dateB.getTime() !== dateA.getTime()) return dateB.getTime() - dateA.getTime();

      return a.displayName.localeCompare(b.displayName);
    });

    res.json(folders);
  } catch (error) {
    console.error('Error fetching leader folders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET leader-level stats overview ────────────────────────────────────────
router.get('/leader/stats', requireAuth, requireVerified, requireRole(['ADMIN', 'COUNSELOR']), async (req, res) => {
  try {
    const today = getUTC8Today();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1));

    const [totalThisMonth, pending, acknowledged] = await Promise.all([
      Devotional.countDocuments({ date: { $gte: monthStart, $lt: monthEnd }, status: { $ne: 'Missed' } }),
      Devotional.countDocuments({ status: 'Submitted' }),
      Devotional.countDocuments({ status: 'Acknowledged', date: { $gte: monthStart, $lt: monthEnd } }),
    ]);

    res.json({ totalThisMonth, pending, acknowledged });
  } catch (error) {
    console.error('Error fetching leader stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── PUT acknowledge a devotional ───────────────────────────────────────────
router.put('/:id/acknowledge', requireAuth, requireVerified, requireRole(['ADMIN', 'COUNSELOR']), async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const devotional = await Devotional.findById(req.params.id)
      .populate('member', 'displayName email');
    if (!devotional) return res.status(404).json({ message: 'Devotional not found' });

    if (devotional.status === 'Acknowledged' || (devotional.status === 'Missed' && devotional.acknowledgedBy)) {
      return res.status(400).json({ message: 'Already acknowledged.' });
    }

    const { note } = req.body;

    if (devotional.status !== 'Missed') {
      devotional.status = 'Acknowledged';
    }
    devotional.acknowledgedBy = req.user._id;
    devotional.acknowledgedAt = new Date();
    devotional.leaderNote = note?.trim() || '';
    await devotional.save();

    res.json({ message: 'Devotional acknowledged', devotional });
  } catch (error) {
    console.error('Error acknowledging devotional:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── POST trigger devotional streak reminders manually (Admin/Counselor only) ─────────────────
router.post('/leader/test-streak-reminders', requireAuth, requireVerified, requireRole(['ADMIN', 'COUNSELOR']), async (req, res) => {
  try {
    const { hoursLeft = 3, memberId = null } = req.body;
    const count = await sendDevotionalStreakReminders(hoursLeft, memberId);
    res.json({ message: `Sent streak reminders to ${count} users.`, count });
  } catch (error) {
    console.error('Error testing streak reminders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── GET bible reading progress ──────────────────────────────────────────────
router.get('/bible-progress/all', requireAuth, requireVerified, async (req, res) => {
  try {
    let targetUserId = req.user._id;

    // Allow leaders to view other members' progress
    if (
      req.query.memberId &&
      ['ADMIN', 'COUNSELOR'].includes(req.user.role) &&
      isValidObjectId(req.query.memberId)
    ) {
      targetUserId = req.query.memberId;
    }

    const entries = await Devotional.find({ member: targetUserId, status: { $ne: 'Missed' } })
      .select('book parsedPassages')
      .lean();

    // Create an object grouping verses by chapter by book: { "Genesis": { "1": 31, "2": 10 } }
    const progress = {};
    for (const entry of entries) {
      if (!entry.book || !entry.parsedPassages) continue;
      if (!progress[entry.book]) progress[entry.book] = {};

      for (const [ch, verses] of Object.entries(entry.parsedPassages)) {
        if (!progress[entry.book][ch]) progress[entry.book][ch] = new Set();
        verses.forEach(v => progress[entry.book][ch].add(v));
      }
    }

    // Convert Sets to lengths for JSON serialization
    const result = {};
    for (const book in progress) {
      result[book] = {};
      for (const ch in progress[book]) {
        result[book][ch] = progress[book][ch].size;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching bible progress:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
