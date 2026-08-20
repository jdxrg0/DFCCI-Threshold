const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Affirmation = require('../models/Affirmation');
const Transaction = require('../models/Transaction');
const Devotional = require('../models/Devotional');
const { requireAuth, requireRole, requireVerified } = require('../middleware/authMiddleware');
const { cloudinary } = require('../utils/cloudinary');
const sendEmail = require('../utils/sendEmail');
const mongoose = require('mongoose');
const PendingUser = require('../models/PendingUser');
const AdminAudit = require('../models/AdminAudit');
const PlatformSnapshot = require('../models/PlatformSnapshot');
const { recordAudit, AUDIT_ACTIONS } = require('../utils/auditLog');
const { collectPlatformStats } = require('../services/platformSnapshot');

const getUTC8Today = () => {
  const now = new Date();
  const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  utc8Time.setUTCHours(0, 0, 0, 0);
  return utc8Time;
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Declared in seniority order: the members list's 'role' sort reads the key order, and the
// audit summaries read the labels, so both stay in step from this one place.
const ROLE_LABELS = {
  ADMIN: 'Admin',
  COUNSELOR: 'Counselor',
  YOUTH_TREASURER: 'Youth Treasurer',
  MEMBER: 'Member',
};
const ROLE_ORDER = Object.keys(ROLE_LABELS);

// Admin-typed text goes straight into a $regex, so anything with regex meaning has to be
// neutralised first — otherwise a search for "(" 500s the endpoint.
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const memberCount = (n) => `${n} member${n === 1 ? '' : 's'}`;

// Bulk endpoints all take the same shaped body, so they share one guard. The 200 cap keeps a
// runaway client from asking a 512 MB free-tier Mongo to rewrite the whole collection at once.
const validateBulkIds = (ids) => {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 'Select at least one member.';
  }
  if (ids.length > 200) {
    return 'You can only act on 200 members at a time.';
  }
  return null;
};

// Filters a raw id list down to the ones we are willing to touch. The caller is always dropped:
// an admin bulk-demoting or bulk-deleting a selection that happens to include themselves is how
// the platform loses its last administrator.
const parseBulkIds = (ids, selfId) => {
  const skipped = [];
  const candidates = [];
  const seen = new Set();

  for (const raw of ids) {
    const input = String(raw);
    if (!mongoose.Types.ObjectId.isValid(input)) {
      skipped.push({ id: input, reason: 'invalid-id' });
      continue;
    }
    // Canonical lowercase hex. Mongo casts '6A84…' and '6a84…' to the very same _id, so
    // comparing the raw strings would let an uppercase spelling of the caller's own id walk
    // straight past the self-guard below — and would desync the found/missing reconciliation
    // in resolveBulkTargets, which compares against Mongo's own lowercase form.
    const id = new mongoose.Types.ObjectId(input).toString();
    if (id === selfId) {
      skipped.push({ id, reason: 'self' });
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    candidates.push(id);
  }

  return { candidates, skipped };
};

// Same trap as above, for the single-target routes: `req.params.id === req.user._id.toString()`
// is a case-sensitive string compare standing in for an identity check.
const isSelf = (req, id) => mongoose.Types.ObjectId.isValid(id) && req.user._id.equals(id);

// A malformed :id otherwise reaches findById and surfaces a CastError as a 500 'Server error',
// which tells the admin the server is broken when the link they followed was simply stale.
const badObjectId = (res, id) => {
  if (mongoose.Types.ObjectId.isValid(id)) return false;
  res.status(400).json({ message: 'Invalid id' });
  return true;
};

// Resolves surviving ids to real users, so a stale row in the admin's browser is reported back
// as 'not-found' instead of quietly shrinking the modified count with no explanation.
const resolveBulkTargets = async (candidates) => {
  const targets = await User.find({ _id: { $in: candidates } })
    .select('_id displayName role isVerified subscribedToDuesReminders')
    .lean();
  const foundIds = new Set(targets.map((u) => u._id.toString()));
  const missing = candidates
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, reason: 'not-found' }));

  return { targets, missing };
};

const profileStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    return {
      folder: 'profile_pictures',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ width: 250, height: 250, crop: 'fill', gravity: 'face' }],
      public_id: `profile-${req.user._id}-${uniqueSuffix}`,
    };
  },
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Get a page of users, plus whole-collection stats (Admin only)
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { search, role, status, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 12));

    const query = {};
    if (search && String(search).trim() !== '') {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      query.$or = [{ displayName: rx }, { email: rx }];
    }
    if (ROLE_ORDER.includes(role)) {
      query.role = role;
    }
    if (status === 'verified') {
      query.isVerified = true;
    } else if (status === 'unverified') {
      query.isVerified = false;
    }

    const sortSpecs = {
      'name': { displayName: 1 },
      'name-desc': { displayName: -1 },
      'newest': { createdAt: -1 },
      'oldest': { createdAt: 1 },
      'role': { roleRank: 1, displayName: 1 },
    };
    const sortSpec = sortSpecs[sort] || sortSpecs.name;

    const [users, totalCount, facet] = await Promise.all([
      // Aggregated rather than found because the 'role' sort is by seniority, which is not the
      // alphabetical order of the enum and so needs a computed rank to sort on.
      User.aggregate([
        { $match: query },
        { $addFields: { roleRank: { $indexOfArray: [ROLE_ORDER, '$role'] } } },
        { $sort: sortSpec },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        // otp/otpExpires join password on the way out now that an admin can trigger one.
        { $project: { password: 0, otp: 0, otpExpires: 0, roleRank: 0 } },
      ]),
      User.countDocuments(query),
      // Deliberately unfiltered: the dashboard's KPI rail reads these and must not move when
      // the admin types in the search box. One $facet keeps it to a single round trip.
      User.aggregate([
        {
          $facet: {
            total: [{ $count: 'n' }],
            verified: [{ $match: { isVerified: true } }, { $count: 'n' }],
            byRole: [{ $group: { _id: '$role', n: { $sum: 1 } } }],
          },
        },
      ]),
    ]);

    const total = facet[0]?.total?.[0]?.n || 0;
    const verified = facet[0]?.verified?.[0]?.n || 0;
    const byRole = { ADMIN: 0, COUNSELOR: 0, YOUTH_TREASURER: 0, MEMBER: 0 };
    for (const row of facet[0]?.byRole || []) {
      if (row._id in byRole) byRole[row._id] = row.n;
    }

    res.json({
      users,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      totalCount,
      stats: { total, verified, unverified: total - verified, byRole },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/* Express 5 still matches in declaration order, so every literal-prefixed admin route below
   has to stay ABOVE the '/:id' routes that follow — otherwise '/bulk/role' binds as id='bulk'. */

// Bulk role change (Admin only)
router.patch('/bulk/role', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { ids, role } = req.body;

    const invalid = validateBulkIds(ids);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }
    if (!ROLE_ORDER.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const { candidates, skipped } = parseBulkIds(ids, req.user._id.toString());
    const { targets, missing } = await resolveBulkTargets(candidates);
    skipped.push(...missing);

    const targetIds = targets.map((u) => u._id);
    const result = await User.updateMany({ _id: { $in: targetIds } }, { $set: { role } });

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_BULK_ROLE,
      targetType: 'USER',
      // resolveBulkTargets already fetched the prior values; without them the log can say
      // 40 members became Members but not which of them were Counselors first.
      before: { members: targets.map((u) => ({ id: u._id.toString(), role: u.role })) },
      after: { role, ids: targetIds.map((id) => id.toString()) },
      summary: `Set ${memberCount(result.modifiedCount)} to ${ROLE_LABELS[role]}`,
    });

    res.json({
      message: `Set ${memberCount(result.modifiedCount)} to ${ROLE_LABELS[role]}`,
      matched: targets.length,
      modified: result.modifiedCount,
      skipped,
    });
  } catch (error) {
    console.error('Error bulk updating roles:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk dues reminders subscription (Admin only)
router.patch('/bulk/reminders', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { ids, subscribed } = req.body;

    const invalid = validateBulkIds(ids);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }
    if (typeof subscribed !== 'boolean') {
      return res.status(400).json({ message: 'subscribed must be true or false' });
    }

    const { candidates, skipped } = parseBulkIds(ids, req.user._id.toString());
    const { targets, missing } = await resolveBulkTargets(candidates);
    skipped.push(...missing);

    const targetIds = targets.map((u) => u._id);
    const result = await User.updateMany(
      { _id: { $in: targetIds } },
      { $set: { subscribedToDuesReminders: subscribed } }
    );

    const verb = subscribed ? 'Enabled' : 'Disabled';
    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_BULK_REMINDERS,
      targetType: 'USER',
      before: { members: targets.map((u) => ({ id: u._id.toString(), subscribedToDuesReminders: !!u.subscribedToDuesReminders })) },
      after: { subscribedToDuesReminders: subscribed, ids: targetIds.map((id) => id.toString()) },
      summary: `${verb} dues reminders for ${memberCount(result.modifiedCount)}`,
    });

    res.json({
      message: `${verb} dues reminders for ${memberCount(result.modifiedCount)}`,
      matched: targets.length,
      modified: result.modifiedCount,
      skipped,
    });
  } catch (error) {
    console.error('Error bulk updating reminders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk verification (Admin only)
router.patch('/bulk/verify', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { ids, isVerified } = req.body;

    const invalid = validateBulkIds(ids);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }
    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ message: 'isVerified must be true or false' });
    }

    const { candidates, skipped } = parseBulkIds(ids, req.user._id.toString());
    const { targets, missing } = await resolveBulkTargets(candidates);
    skipped.push(...missing);

    const targetIds = targets.map((u) => u._id);
    const update = { $set: { isVerified } };
    // A verified account has no business still holding a live code to redeem.
    if (isVerified) {
      update.$unset = { otp: '', otpExpires: '' };
    }
    const result = await User.updateMany({ _id: { $in: targetIds } }, update);

    const verb = isVerified ? 'Verified' : 'Unverified';
    // No confirmation emails here on purpose: 200 of them in one click would eat most of the
    // 500-a-day sending allowance. The single-user route is the one that notifies.
    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_BULK_VERIFY,
      targetType: 'USER',
      before: { members: targets.map((u) => ({ id: u._id.toString(), isVerified: !!u.isVerified })) },
      after: { isVerified, ids: targetIds.map((id) => id.toString()) },
      summary: `${verb} ${memberCount(result.modifiedCount)}`,
    });

    res.json({
      message: `${verb} ${memberCount(result.modifiedCount)}`,
      matched: targets.length,
      modified: result.modifiedCount,
      skipped,
    });
  } catch (error) {
    console.error('Error bulk updating verification:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk delete (Admin only)
router.post('/bulk/delete', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { ids } = req.body;

    const invalid = validateBulkIds(ids);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }

    const { candidates, skipped } = parseBulkIds(ids, req.user._id.toString());
    const { targets, missing } = await resolveBulkTargets(candidates);
    skipped.push(...missing);

    const targetIds = targets.map((u) => u._id);
    const result = await User.deleteMany({ _id: { $in: targetIds } });

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_BULK_DELETE,
      targetType: 'USER',
      before: { names: targets.map((u) => u.displayName) },
      after: { deleted: result.deletedCount, ids: targetIds.map((id) => id.toString()) },
      summary: `Deleted ${memberCount(result.deletedCount)}`,
    });

    res.json({
      message: `Deleted ${memberCount(result.deletedCount)}`,
      matched: targets.length,
      modified: result.deletedCount,
      skipped,
    });
  } catch (error) {
    console.error('Error bulk deleting users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// List signups that never made it past the OTP screen (Admin only)
router.get('/admin/pending-signups', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    // These rows live in PendingUser, not User, so they never show up in the members list —
    // which is exactly why "my code never arrived" needs a screen of its own.
    const pending = await PendingUser.find({})
      .select('_id displayName email createdAt otpExpires')
      .sort({ createdAt: -1 })
      .lean();

    const now = Date.now();
    const signups = pending.map((p) => ({
      _id: p._id,
      displayName: p.displayName,
      email: p.email,
      createdAt: p.createdAt,
      otpExpires: p.otpExpires,
      expired: !p.otpExpires || new Date(p.otpExpires).getTime() < now,
    }));

    res.json({ signups });
  } catch (error) {
    console.error('Error fetching pending signups:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Re-send the signup code for a stuck registration (Admin only)
router.post('/admin/pending-signups/:id/resend', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const pending = await PendingUser.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending signup not found or already expired.' });
    }

    const otp = generateOTP();
    pending.otp = otp;
    pending.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    // The collection's 15-minute TTL hangs off createdAt. Without this reset the row is swept
    // away moments after we email a code that is meant to be good for another quarter hour.
    pending.createdAt = Date.now();
    await pending.save();

    await sendEmail(
      pending.email,
      'Your New DFCCI Threshold Verification Code',
      `<p>Your new verification code is: <strong>${otp}</strong></p><p>It will expire in 15 minutes.</p>`
    );

    await recordAudit(req, {
      action: AUDIT_ACTIONS.SIGNUP_OTP_RESEND,
      target: pending._id,
      targetLabel: pending.email,
      summary: `Resent the signup verification code to ${pending.email}`,
    });

    res.json({ message: `A new verification code has been sent to ${pending.email}.` });
  } catch (error) {
    console.error('Error resending signup OTP:', error);
    res.status(500).json({ message: 'Server error while resending verification code' });
  }
});

// Drop an abandoned signup (Admin only)
router.delete('/admin/pending-signups/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const pending = await PendingUser.findByIdAndDelete(req.params.id);
    if (!pending) {
      return res.status(404).json({ message: 'Pending signup not found or already expired.' });
    }

    await recordAudit(req, {
      action: AUDIT_ACTIONS.SIGNUP_DELETE,
      target: pending._id,
      targetLabel: pending.email,
      before: { displayName: pending.displayName, email: pending.email },
      summary: `Deleted the abandoned signup for ${pending.email}`,
    });

    res.json({ message: `Signup for ${pending.email} deleted.` });
  } catch (error) {
    console.error('Error deleting pending signup:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin action log (Admin only)
router.get('/admin/audit', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { action, actor, search, from, to } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const query = {};
    if (action && Object.values(AUDIT_ACTIONS).includes(action)) {
      query.action = action;
    }
    if (actor && mongoose.Types.ObjectId.isValid(actor)) {
      query.actor = actor;
    }
    if (search && String(search).trim() !== '') {
      const rx = new RegExp(escapeRegex(String(search).trim()), 'i');
      query.$or = [{ summary: rx }, { targetLabel: rx }, { actorName: rx }];
    }

    const createdAt = {};
    const fromDate = from ? new Date(from) : null;
    const toDate = to ? new Date(to) : null;
    if (fromDate && !isNaN(fromDate.getTime())) {
      createdAt.$gte = fromDate;
    }
    if (toDate && !isNaN(toDate.getTime())) {
      // A bare 'YYYY-MM-DD' parses to that day's midnight, which would exclude everything that
      // actually happened on the day the admin picked. Stretch it to the end of that day.
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to).trim())) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
      createdAt.$lte = toDate;
    }
    if (Object.keys(createdAt).length > 0) {
      query.createdAt = createdAt;
    }

    const [entries, totalCount, actions] = await Promise.all([
      // Nothing is populated: the denormalised actorName/targetLabel are the whole point, since
      // the commonest entry to read back is one whose target no longer exists.
      AdminAudit.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AdminAudit.countDocuments(query),
      // Drawn from what is actually stored, so the filter dropdown can never offer a value that
      // would only ever return an empty page.
      AdminAudit.distinct('action'),
    ]);

    res.json({
      entries,
      page,
      totalPages: Math.max(1, Math.ceil(totalCount / limit)),
      totalCount,
      actions: actions.sort(),
    });
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Daily platform usage history (Admin only)
// Get platform limits & usage stats (Admin only)
router.get('/admin/platform-limits', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    // The collection walk, email tally and Cloudinary call now live in the snapshot service so
    // this endpoint and the daily snapshot can never report different numbers for the same day.
    const stats = await collectPlatformStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching platform limits:', error);
    res.status(500).json({ message: 'Server error fetching platform limits' });
  }
});

router.get('/admin/platform-history', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));

    // Snapshot `date` is a 'YYYY-MM-DD' Manila key, so a lexical $gte against the same format is
    // the whole window filter — same UTC+8 shift the rest of this file uses to find "today".
    const cutoff = new Date(Date.now() + 8 * 60 * 60 * 1000 - (days - 1) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Ascending: the chart plots left to right and should not have to reverse this.
    const snapshots = await PlatformSnapshot.find({ date: { $gte: cutoff } })
      .sort({ date: 1 })
      .lean();

    res.json({ snapshots, days });
  } catch (error) {
    console.error('Error fetching platform history:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Assign/remove roles (Admin only)
router.put('/:id/role', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { role } = req.body;
    
    if (isSelf(req, req.params.id)) {
      return res.status(400).json({ message: 'You cannot change your own role.' });
    }

    if (!['MEMBER', 'COUNSELOR', 'ADMIN', 'YOUTH_TREASURER'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const previousRole = user.role;
    user.role = role;
    await user.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_ROLE_CHANGE,
      target: user._id,
      targetLabel: user.displayName,
      before: { role: previousRole },
      after: { role: user.role },
      summary: `Changed ${user.displayName} from ${ROLE_LABELS[previousRole]} to ${ROLE_LABELS[user.role]}`,
    });

    res.json({ message: `User role updated to ${role}`, user: { _id: user._id, displayName: user.displayName, role: user.role } });
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle dues reminders subscription (Admin only)
router.put('/:id/toggle-reminders', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const wasSubscribed = user.subscribedToDuesReminders;
    user.subscribedToDuesReminders = !user.subscribedToDuesReminders;
    await user.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_REMINDERS_TOGGLE,
      target: user._id,
      targetLabel: user.displayName,
      before: { subscribedToDuesReminders: wasSubscribed },
      after: { subscribedToDuesReminders: user.subscribedToDuesReminders },
      summary: `${user.subscribedToDuesReminders ? 'Enabled' : 'Disabled'} dues reminders for ${user.displayName}`,
    });

    res.json({ 
      message: `Dues reminders ${user.subscribedToDuesReminders ? 'enabled' : 'disabled'} for ${user.displayName}`,
      subscribedToDuesReminders: user.subscribedToDuesReminders 
    });
  } catch (error) {
    console.error('Error toggling reminders:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request Name Change (Admin only)
router.put('/:id/request-name-change', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const wasRequested = user.nameChangeRequested;
    user.nameChangeRequested = !user.nameChangeRequested;
    await user.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_RENAME_REQUEST,
      target: user._id,
      targetLabel: user.displayName,
      before: { nameChangeRequested: wasRequested },
      after: { nameChangeRequested: user.nameChangeRequested },
      summary: user.nameChangeRequested
        ? `Asked ${user.displayName} to change their display name`
        : `Revoked the name change request for ${user.displayName}`,
    });

    res.json({ 
      message: `Name change request ${user.nameChangeRequested ? 'sent to' : 'revoked for'} ${user.displayName}`,
      nameChangeRequested: user.nameChangeRequested 
    });
  } catch (error) {
    console.error('Error toggling name change request:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Grant/revoke temporary custom date power (Admin only)
router.put('/:id/custom-date-power', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { durationMinutes } = req.body;
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (durationMinutes === undefined || isNaN(durationMinutes) || durationMinutes < 0) {
      return res.status(400).json({ message: 'Invalid durationMinutes' });
    }

    const previousExpiry = user.customDatePowerExpires;
    if (durationMinutes === 0) {
      user.customDatePowerExpires = null;
    } else {
      user.customDatePowerExpires = new Date(Date.now() + durationMinutes * 60 * 1000);
    }
    
    await user.save();

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_DATE_POWER,
      target: user._id,
      targetLabel: user.displayName,
      before: { customDatePowerExpires: previousExpiry },
      after: { customDatePowerExpires: user.customDatePowerExpires },
      summary: durationMinutes === 0
        ? `Revoked custom date power from ${user.displayName}`
        : `Granted custom date power to ${user.displayName} for ${durationMinutes} minutes`,
    });

    res.json({
      message: durationMinutes === 0 
        ? `Custom date power revoked for ${user.displayName}` 
        : `Custom date power granted to ${user.displayName} for ${durationMinutes} minutes`,
      customDatePowerExpires: user.customDatePowerExpires,
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires
      }
    });
  } catch (error) {
    console.error('Error setting custom date power:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Manually flip a member's verified flag (Admin only)
router.put('/:id/verify', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const { isVerified } = req.body;

    if (typeof isVerified !== 'boolean') {
      return res.status(400).json({ message: 'isVerified must be true or false' });
    }

    // Re-verifying yourself is harmless, but unverifying yourself locks you straight out.
    if (!isVerified && isSelf(req, req.params.id)) {
      return res.status(400).json({ message: 'You cannot unverify yourself.' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const wasVerified = user.isVerified;
    user.isVerified = isVerified;
    if (isVerified) {
      user.otp = undefined;
      user.otpExpires = undefined;
    }
    await user.save();

    // Only on the false to true transition — re-confirming an already verified member would
    // email them about something that did not change.
    if (isVerified && !wasVerified) {
      try {
        await sendEmail(
          user.email,
          'Your DFCCI Threshold account is verified',
          `<h3>Your account is ready</h3>
           <p>Hi ${user.displayName}, an administrator has verified your DFCCI Threshold account.</p>
           <p>You can now sign in with your email and password — no verification code needed.</p>`
        );
      } catch (err) {
        // The account is verified in the database by this point, so a mail failure is a missed
        // notification, not a failed request. Failing here would only invite a pointless retry.
        console.error('Failed to send verification confirmation email:', err);
      }
    }

    await recordAudit(req, {
      action: isVerified ? AUDIT_ACTIONS.USER_VERIFY : AUDIT_ACTIONS.USER_UNVERIFY,
      target: user._id,
      targetLabel: user.displayName,
      before: { isVerified: wasVerified },
      after: { isVerified: user.isVerified },
      summary: `${isVerified ? 'Verified' : 'Unverified'} the account of ${user.displayName}`,
    });

    res.json({
      message: `${user.displayName} is now ${isVerified ? 'verified' : 'unverified'}`,
      user: {
        _id: user._id,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error('Error updating verification status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Re-send a verification code to an existing member (Admin only)
router.post('/:id/resend-otp', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (badObjectId(res, req.params.id)) return;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.pendingEmail && user.isVerified) {
      return res.status(400).json({ message: 'This member is already verified and has no pending email change.' });
    }

    const otp = generateOTP();
    // A pending email change is the code the member is actually waiting on, and it has to go to
    // the address being claimed rather than the one still on the account.
    const destination = user.pendingEmail || user.email;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    if (user.pendingEmail) {
      await sendEmail(
        destination,
        'Verify Your New Email Address - DFCCI Threshold',
        `<h3>New Email Verification Code</h3>
         <p>You requested to change your email to this address on your DFCCI Threshold account.</p>
         <p>Your new 6-digit verification code is: <strong>${otp}</strong></p>
         <p>This code will expire in 15 minutes.</p>
         <p>If you did not request this change, please ignore this email.</p>`
      );
    } else {
      await sendEmail(
        destination,
        'Your New DFCCI Threshold Verification Code',
        `<h3>New Verification Code</h3>
         <p>Hi ${user.displayName}, an administrator has issued a new code for your DFCCI Threshold account.</p>
         <p>Your 6-digit verification code is: <strong>${otp}</strong></p>
         <p>Enter it on the sign-in verification screen to finish activating your account.</p>
         <p>This code will expire in 15 minutes.</p>`
      );
    }

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_OTP_RESEND,
      target: user._id,
      targetLabel: user.displayName,
      after: { sentTo: destination, forPendingEmail: !!user.pendingEmail },
      summary: `Resent a verification code to ${destination} for ${user.displayName}`,
    });

    res.json({ message: `A new verification code has been sent to ${destination}.` });
  } catch (error) {
    console.error('Error resending member OTP:', error);
    res.status(500).json({ message: 'Server error while resending verification code' });
  }
});

// Update own name (Authenticated user)
router.put('/me/update-name', requireAuth, async (req, res) => {
  try {
    const { displayName } = req.body;
    
    if (!displayName || displayName.trim() === '') {
      return res.status(400).json({ message: 'Display name is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.displayName = displayName.trim();
    user.nameChangeRequested = false;
    await user.save();

    res.json({ 
      message: 'Name updated successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires
      }
    });
  } catch (error) {
    console.error('Error updating name:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update profile name & profile picture (Authenticated user)
router.put('/me/update-profile', requireAuth, uploadProfile.single('profilePicture'), async (req, res) => {
  try {
    const { displayName, presetAvatar } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (displayName !== undefined) {
      if (displayName.trim() === '') {
        return res.status(400).json({ message: 'Display name cannot be empty' });
      }
      user.displayName = displayName.trim();
      user.nameChangeRequested = false;
    }

    if (req.file) {
      if (user.profilePictureCloudinaryId) {
        try {
          await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
      user.profilePicture = req.file.path;
      user.profilePictureCloudinaryId = req.file.filename;
    } else if (presetAvatar !== undefined) {
      if (user.profilePictureCloudinaryId) {
        try {
          await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
        } catch (err) {
          console.error('Failed to delete old profile picture:', err);
        }
      }
      user.profilePicture = presetAvatar;
      user.profilePictureCloudinaryId = '';
    }

    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ message: 'Server error while updating profile' });
  }
});

// Update email (Authenticated user - triggers verification code to new email)
router.put('/me/update-email', requireAuth, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || email.trim() === '') {
      return res.status(400).json({ message: 'Email is required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser._id.toString() !== req.user._id.toString()) {
      return res.status(400).json({ message: 'This email is already taken by another user.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.email === normalizedEmail) {
      return res.status(400).json({ message: 'This is already your current email address.' });
    }

    // Generate 6-digit verification code and save it
    const otp = generateOTP();
    user.pendingEmail = normalizedEmail;
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    // Send code to the NEW email address
    await sendEmail(
      normalizedEmail,
      'Verify Your New Email Address - DFCCI Threshold',
      `<h3>Email Verification Code</h3>
       <p>You requested to change your email to this address on your DFCCI Threshold account.</p>
       <p>Your 6-digit verification code is: <strong>${otp}</strong></p>
       <p>This code will expire in 15 minutes.</p>
       <p>If you did not request this change, please ignore this email.</p>`
    );

    res.json({
      requiresVerification: true,
      pendingEmail: normalizedEmail,
      message: 'A verification code has been sent to your new email. Please verify to complete the update.',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires,
        pendingEmail: user.pendingEmail
      }
    });
  } catch (error) {
    console.error('Error initiating email update:', error);
    res.status(500).json({ message: 'Server error while initiating email update' });
  }
});

// Verify Email Verification Code (Authenticated user)
router.post('/me/verify-email-otp', requireAuth, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) {
      return res.status(400).json({ message: 'Verification code is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ message: 'No pending email update found.' });
    }

    if (!user.otp || user.otp !== otp) {
      return res.status(400).json({ message: 'Invalid verification code.' });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
    }

    // Double check unique constraint one last time
    const existingUser = await User.findOne({ email: user.pendingEmail });
    if (existingUser && existingUser._id.toString() !== user._id.toString()) {
      return res.status(400).json({ message: 'This email is already taken by another user.' });
    }

    // Finalize update
    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      message: 'Email updated successfully!',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires
      }
    });
  } catch (error) {
    console.error('Error verifying email OTP:', error);
    res.status(500).json({ message: 'Server error while verifying email verification code' });
  }
});

// Resend Email Verification Code (Authenticated user)
router.post('/me/resend-email-otp', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({ message: 'No pending email update found.' });
    }

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    await user.save();

    await sendEmail(
      user.pendingEmail,
      'Verify Your New Email Address - DFCCI Threshold',
      `<h3>New Email Verification Code</h3>
       <p>You requested to change your email to this address on your DFCCI Threshold account.</p>
       <p>Your new 6-digit verification code is: <strong>${otp}</strong></p>
       <p>This code will expire in 15 minutes.</p>
       <p>If you did not request this change, please ignore this email.</p>`
    );

    res.json({ message: 'A new verification code has been sent to your pending email address.' });
  } catch (error) {
    console.error('Error resending email OTP:', error);
    res.status(500).json({ message: 'Server error while resending verification code' });
  }
});

// Cancel Pending Email Update (Authenticated user)
router.post('/me/cancel-email-update', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.pendingEmail = undefined;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    res.json({
      message: 'Email update request cancelled successfully.',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires,
        pendingEmail: undefined
      }
    });
  } catch (error) {
    console.error('Error cancelling email update:', error);
    res.status(500).json({ message: 'Server error while cancelling email update' });
  }
});

// Update password (Authenticated user)
router.put('/me/update-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.trim() === '') {
      return res.status(400).json({ message: 'New password is required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.password) {
      if (!currentPassword) {
        return res.status(400).json({ message: 'Current password is required to change password' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Incorrect current password' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ message: 'Server error while updating password' });
  }
});

// Remove profile picture (Authenticated user)
router.delete('/me/remove-profile-picture', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.profilePictureCloudinaryId) {
      try {
        await cloudinary.uploader.destroy(user.profilePictureCloudinaryId);
      } catch (err) {
        console.error('Failed to delete profile picture from Cloudinary:', err);
      }
    }

    user.profilePicture = '';
    user.profilePictureCloudinaryId = '';
    await user.save();

    res.json({
      message: 'Profile picture removed successfully',
      user: {
        _id: user._id,
        displayName: user.displayName,
        role: user.role,
        email: user.email,
        nameChangeRequested: user.nameChangeRequested,
        profilePicture: user.profilePicture,
        customDatePowerExpires: user.customDatePowerExpires
      }
    });
  } catch (error) {
    console.error('Error removing profile picture:', error);
    res.status(500).json({ message: 'Server error while removing profile picture' });
  }
});

// ─── Dashboard Stats (Authenticated, Verified) ─────────────────────────────
router.get('/me/dashboard-stats', requireAuth, requireVerified, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Active Gentle Mirrors (threads where user is sender or receiver and not resolved)
    const activeMirrors = await Thread.countDocuments({
      $or: [{ sender: userId }, { receiver: userId }],
      status: { $ne: 'Resolved' },
      deletedAt: null,
    });

    // 2. Received Shining Lights (affirmations where user is receiver)
    const receivedLights = await Affirmation.countDocuments({
      receiver: userId,
    });

    // 3. Global Youth Fund Balance
    const incomeAgg = await Transaction.aggregate([
      { $match: { type: 'INCOME' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const expenseAgg = await Transaction.aggregate([
      { $match: { type: 'EXPENSE' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const fundBalance = totalIncome - totalExpense;

    // 4. Devotional Day Streak
    const devotionals = await Devotional.find({ member: userId })
      .sort({ date: -1 })
      .select('date')
      .lean();

    let devotionStreak = 0;
    if (devotionals.length > 0) {
      const dateSet = new Set(
        devotionals.map((d) => {
          const dt = new Date(d.date);
          return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
        })
      );

      const today = getUTC8Today();
      // Start from today or yesterday (if no entry today yet, the streak still counts)
      const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
      let cursor = new Date(today);
      if (!dateSet.has(todayStr)) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      }

      for (let i = 0; i < 400; i++) {
        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}-${String(cursor.getUTCDate()).padStart(2, '0')}`;
        if (dateSet.has(key)) {
          devotionStreak++;
          cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
          break;
        }
      }
    }

    res.json({ activeMirrors, receivedLights, fundBalance, devotionStreak });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all verified members for selection (Authenticated, Verified MEMBER or above)
router.get('/members', requireAuth, requireVerified, async (req, res) => {
  try {
    const users = await User.find({
      _id: { $ne: req.user._id },
      isVerified: true
    })
    .select('_id displayName role')
    .sort({ displayName: 1 });

    res.json(users);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Search users by display name (Authenticated, Verified MEMBER or above)
router.get('/search', requireAuth, requireVerified, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      displayName: new RegExp(escapeRegex(String(q).trim()), 'i'),
    })
    .select('_id displayName role')
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete user (Admin only)
router.delete('/:id', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    if (isSelf(req, req.params.id)) {
      return res.status(400).json({ message: 'You cannot delete yourself.' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.findByIdAndDelete(req.params.id);

    await recordAudit(req, {
      action: AUDIT_ACTIONS.USER_DELETE,
      target: user._id,
      targetLabel: user.displayName,
      before: {
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified
      },
      summary: `Deleted the account of ${user.displayName} (${user.email})`,
    });
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
