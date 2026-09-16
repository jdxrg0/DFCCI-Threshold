const express = require('express');
const router = express.Router();
const EmailLog = require('../models/EmailLog');
const sendEmail = require('../utils/sendEmail');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { recordAudit, AUDIT_ACTIONS } = require('../utils/auditLog');
const { escapeRegex } = require('../utils/escapeRegex');

// @route   GET /api/emails
// @desc    Get all email logs (Admin only, paginated, searchable, filterable)
// @access  Private (Admin only)
router.get('/', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const status = req.query.status || '';

    const query = {};

    if (search) {
      const safeSearch = escapeRegex(search);
      query.$or = [
        { to: { $regex: safeSearch, $options: 'i' } },
        { subject: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const totalCount = await EmailLog.countDocuments(query);
    const emails = await EmailLog.find(query)
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      emails,
      totalPages,
      currentPage: page,
      totalCount,
    });
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/emails/:id/resend
// @desc    Resend an outgoing email (Admin only)
// @access  Private (Admin only)
router.post('/:id/resend', requireAuth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const emailLog = await EmailLog.findById(req.params.id);
    if (!emailLog) {
      return res.status(404).json({ message: 'Email log not found' });
    }

    // Call sendEmail utility.
    // The utility itself will automatically log this new attempt (either as 'sent' or 'failed')!
    await sendEmail(emailLog.to, emailLog.subject, emailLog.html);

    await recordAudit(req, {
      action: AUDIT_ACTIONS.EMAIL_RESEND,
      targetType: 'EMAIL',
      target: emailLog._id,
      targetLabel: emailLog.subject,
      after: { to: emailLog.to },
      summary: `Resent the email "${emailLog.subject}" to ${emailLog.to}`,
    });

    res.json({ message: 'Email resent successfully!' });
  } catch (error) {
    console.error('Error resending email:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
