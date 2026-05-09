const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const DuesMember = require('../models/DuesMember');
const DuesPayment = require('../models/DuesPayment');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { requireAuth, requireVerified, requireRole } = require('../middleware/authMiddleware');

const adminOrTreasurerAuth = [requireAuth, requireVerified, requireRole(['ADMIN', 'YOUTH_TREASURER'])];

const DUES_START_DATE = new Date('2026-05-01');

// Helper: calculate total arrears for a member
async function calcMemberArrears(memberId) {
  const payments = await DuesPayment.find({ member: memberId });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  const now = new Date();
  let d = new Date(DUES_START_DATE);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); // first Sunday on/after start
  let sundaysCount = 0;
  while (d <= now) {
    sundaysCount++;
    d.setDate(d.getDate() + 7);
  }
  const expected = sundaysCount * 10;
  return expected - totalPaid;
}

// Helper: get Monday of the week for a given date string
function getWeekStart(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// Get summary (Accessible to all verified users)
router.get('/summary', requireAuth, requireVerified, async (req, res) => {
  try {
    const transactions = await Transaction.find({});
    
    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach(t => {
      if (t.type === 'INCOME') {
        totalIncome += t.amount;
      } else if (t.type === 'EXPENSE') {
        totalExpense += t.amount;
      }
    });

    const currentBalance = totalIncome - totalExpense;

    res.json({
      totalIncome,
      totalExpense,
      currentBalance
    });
  } catch (error) {
    console.error('Error fetching funds summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all transactions (with optional month/year filter)
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = {};

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);
      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    } else if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
      query.date = {
        $gte: startDate,
        $lte: endDate
      };
    }

    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .populate('createdBy', 'displayName');

    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get distinct categories
router.get('/categories', requireAuth, requireVerified, async (req, res) => {
  try {
    const categories = await Transaction.distinct('category');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new transaction
router.post('/', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { amount, type, category, description, date } = req.body;

    if (!amount || !type || !category) {
      return res.status(400).json({ message: 'Amount, type, and category are required' });
    }

    if (!['INCOME', 'EXPENSE'].includes(type)) {
      return res.status(400).json({ message: 'Invalid transaction type' });
    }

    const transaction = new Transaction({
      amount: Number(amount),
      type,
      category,
      description,
      date: date || Date.now(),
      createdBy: req.user._id
    });

    await transaction.save();
    
    // Populate createdBy before sending response
    await transaction.populate('createdBy', 'displayName');

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a transaction
router.put('/:id', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { amount, type, category, description, date } = req.body;

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (amount) transaction.amount = Number(amount);
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (description !== undefined) transaction.description = description;
    if (date) transaction.date = date;

    await transaction.save();
    await transaction.populate('createdBy', 'displayName');

    res.json(transaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a transaction
router.delete('/:id', adminOrTreasurerAuth, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    await transaction.deleteOne();

    // Cascade delete any linked DuesPayment
    await DuesPayment.deleteMany({ transactionId: req.params.id });

    res.json({ message: 'Transaction removed' });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── WEEKLY DUES ROSTER ──────────────────────────────────────────────────────

// Get all active roster members
router.get('/dues/members', requireAuth, requireVerified, async (req, res) => {
  try {
    const members = await DuesMember.find({ isActive: true }).sort({ name: 1 });
    res.json(members);
  } catch (err) {
    console.error('Error fetching dues members:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a member to the roster
router.post('/dues/members', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });
    const member = new DuesMember({ name: name.trim(), addedBy: req.user._id });
    await member.save();
    res.status(201).json(member);
  } catch (err) {
    console.error('Error adding dues member:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Soft-delete (deactivate) a roster member
router.delete('/dues/members/:id', adminOrTreasurerAuth, async (req, res) => {
  try {
    const member = await DuesMember.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    member.isActive = false;
    await member.save();
    res.json({ message: 'Member removed from roster' });
  } catch (err) {
    console.error('Error removing dues member:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── WEEKLY DUES LEDGER ─────────────────────────────────────────────────────

// Get all members and payments for ledger grid
router.get('/dues/ledger', requireAuth, requireVerified, async (req, res) => {
  try {
    const [members, payments] = await Promise.all([
      DuesMember.find({ isActive: true }).sort({ name: 1 }).populate('linkedUser', 'displayName email'),
      DuesPayment.find({}),
    ]);
    res.json({ members, payments });
  } catch (err) {
    console.error('Error fetching ledger:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upsert a payment amount for a specific member and date
router.post('/dues/ledger', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { memberId, collectionDate, amount } = req.body;
    if (!memberId || !collectionDate) return res.status(400).json({ message: 'memberId and collectionDate required' });

    const dDate = new Date(collectionDate);
    dDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dDate.getTime() + 24 * 60 * 60 * 1000 - 1);

    const member = await DuesMember.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    let payment = await DuesPayment.findOne({
      member: memberId,
      collectionDate: { $gte: dDate, $lte: endDate }
    });

    const numAmount = Number(amount);

    // If amount is 0, empty, or invalid, delete the record
    if (!amount || numAmount === 0 || isNaN(numAmount)) {
      if (payment) {
        if (payment.transactionId) await Transaction.findByIdAndDelete(payment.transactionId);
        await payment.deleteOne();
      }
      return res.json({ message: 'Payment cleared' });
    }

    // Update existing payment
    if (payment) {
      payment.amount = numAmount;
      await payment.save();
      if (payment.transactionId) {
        await Transaction.findByIdAndUpdate(payment.transactionId, { amount: numAmount });
      }
      return res.json({ payment });
    }

    // Create new payment
    const transaction = new Transaction({
      amount: numAmount,
      type: 'INCOME',
      category: 'Weekly Dues',
      description: `Weekly dues — ${member.name} (${dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
      date: new Date(),
      createdBy: req.user._id,
    });
    await transaction.save();

    payment = new DuesPayment({
      member: memberId,
      collectionDate: dDate,
      amount: numAmount,
      recordedBy: req.user._id,
      transactionId: transaction._id,
    });
    await payment.save();

    res.status(201).json({ payment, transaction });
  } catch (err) {
    console.error('Error upserting dues:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// Link or unlink a registered user to a roster member (Admin/Treasurer only)
router.put('/dues/members/:id/link-user', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { userId } = req.body; // pass null/undefined to unlink
    const member = await DuesMember.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    if (userId) {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ message: 'User not found' });
      member.linkedUser = user._id;
    } else {
      member.linkedUser = null;
    }

    await member.save();
    await member.populate('linkedUser', 'displayName email');
    res.json({ member });
  } catch (err) {
    console.error('Error linking user to member:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send dues statement email to the linked user (Admin/Treasurer only)
router.post('/dues/members/:id/send-dues-email', adminOrTreasurerAuth, async (req, res) => {
  try {
    const member = await DuesMember.findById(req.params.id).populate('linkedUser', 'displayName email');
    if (!member) return res.status(404).json({ message: 'Member not found' });
    if (!member.linkedUser) return res.status(400).json({ message: 'No user linked to this roster member.' });

    const arrears = await calcMemberArrears(member._id);
    const user = member.linkedUser;

    let arrearsHtml;
    if (arrears > 0) {
      arrearsHtml = `Your current dues balance is <span style="color:#ef4444;font-weight:bold;">₱${arrears} in arrears</span>. Please settle it at your earliest convenience. 🙏`;
    } else if (arrears < 0) {
      arrearsHtml = `You're advanced by <span style="color:#f59e0b;font-weight:bold;">₱${Math.abs(arrears)}</span>! You're all caught up and then some — great job! 🎉`;
    } else {
      arrearsHtml = `You're <span style="color:#22c55e;font-weight:bold;">Fully Updated</span>! No arrears at all — keep it up! ✨`;
    }

    const html = `
      <div style="font-family:sans-serif;max-width:520px;margin:20px auto;padding:30px;border-radius:20px;background:#ffffff;box-shadow:0 10px 30px rgba(0,0,0,0.07);border:1px solid #f0f0f0;">
        <div style="text-align:center;margin-bottom:25px;">
          <div style="background:#0284c7;color:white;width:60px;height:60px;line-height:60px;border-radius:50%;font-size:30px;margin:0 auto 15px;">💰</div>
          <h2 style="color:#1e293b;margin:0;font-size:24px;font-weight:800;">Your Dues Statement</h2>
        </div>
        <p style="color:#475569;font-size:16px;line-height:1.6;text-align:center;">
          Hi <strong>${user.displayName}</strong>! Here's your current dues status as of today.
        </p>
        <div style="background:#f8fafc;padding:20px;border-radius:15px;margin:20px 0;border:1px dashed #cbd5e1;">
          <span style="display:block;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;text-align:center;">Weekly Dues Balance</span>
          <p style="color:#475569;font-size:15px;line-height:1.7;text-align:center;margin:0;">
            ${arrearsHtml}
          </p>
        </div>
        <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:30px;">
          This is an official statement from <strong>DFCCI Threshold</strong>. Keep shining! ✨
        </p>
      </div>
    `;

    await sendEmail(user.email, 'Your DFCCI Threshold Weekly Dues Statement 💰', html);
    res.json({ message: `Dues statement sent to ${user.email}` });
  } catch (err) {
    console.error('Error sending dues email:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
