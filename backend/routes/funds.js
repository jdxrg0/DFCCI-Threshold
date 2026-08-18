const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const DuesMember = require('../models/DuesMember');
const DuesPayment = require('../models/DuesPayment');
const DesignatedFund = require('../models/DesignatedFund');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { sendDuesReminders } = require('../utils/reminderScheduler');
const { requireAuth, requireVerified, requireRole } = require('../middleware/authMiddleware');

const adminOrTreasurerAuth = [requireAuth, requireVerified, requireRole(['ADMIN', 'YOUTH_TREASURER'])];

const DUES_START_DATE = new Date('2026-05-01');
const DUES_WEEKLY_AMOUNT = 10;
const DUES_TIMEZONE = 'Asia/Manila';

// User-supplied text goes into a $regex, so anything with regex meaning has to
// be neutralised first — otherwise a search for "(" throws and a search for
// ".*" scans everything.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Shared by the paginated list and the export route so both honour the exact
// same filters — the export used to be impossible to keep in sync by hand.
function buildTxQuery({ month, year, filterType, designatedFund, q }) {
  const query = {};

  if (filterType === 'WEEKLY_DUES') {
    query.category = 'Weekly Dues';
  } else if (filterType === 'OTHERS') {
    query.category = { $ne: 'Weekly Dues' };
  }

  if (designatedFund) {
    query.designatedFund = designatedFund === 'UNASSIGNED' ? null : designatedFund;
  }

  if (month && year) {
    query.date = {
      $gte: new Date(year, month - 1, 1),
      $lte: new Date(year, month, 0, 23, 59, 59, 999),
    };
  } else if (year) {
    query.date = {
      $gte: new Date(year, 0, 1),
      $lte: new Date(year, 11, 31, 23, 59, 59, 999),
    };
  }

  if (q && String(q).trim()) {
    const rx = new RegExp(escapeRegex(String(q).trim()), 'i');
    query.$or = [{ category: rx }, { description: rx }];
  }

  return query;
}

// Helper: how many dues Sundays have already come around as of today (PH time).
// Extracted so the ledger grid, the statement email and the batch reminders all
// agree on what "expected so far" means.
function duesSundaysToDate() {
  const nowSystem = new Date();
  const now = new Date(nowSystem.getTime() + 8 * 60 * 60 * 1000);
  now.setUTCHours(0, 0, 0, 0);
  let d = new Date(DUES_START_DATE.getTime() + 8 * 60 * 60 * 1000);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); // first Sunday on/after start
  let sundaysCount = 0;
  while (d <= now) {
    sundaysCount++;
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return sundaysCount;
}

// Helper: calculate total arrears for a member
async function calcMemberArrears(memberId) {
  const payments = await DuesPayment.find({ member: memberId });
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  return duesSundaysToDate() * DUES_WEEKLY_AMOUNT - totalPaid;
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
// Aggregated in the database rather than pulled into memory — the old version
// loaded every transaction ever recorded on each dashboard open.
router.get('/summary', requireAuth, requireVerified, async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [totals, monthTotals, prevMonthTotals, unassigned, txCount] = await Promise.all([
      Transaction.aggregate([
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { date: { $gte: prevMonthStart, $lt: monthStart } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { designatedFund: null } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]),
      Transaction.countDocuments({}),
    ]);

    const pick = (rows, type) => rows.find(r => r._id === type)?.total || 0;

    const totalIncome = pick(totals, 'INCOME');
    const totalExpense = pick(totals, 'EXPENSE');
    const monthIncome = pick(monthTotals, 'INCOME');
    const monthExpense = pick(monthTotals, 'EXPENSE');

    res.json({
      totalIncome,
      totalExpense,
      currentBalance: totalIncome - totalExpense,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      prevMonthNet: pick(prevMonthTotals, 'INCOME') - pick(prevMonthTotals, 'EXPENSE'),
      // What is still sitting in the general pot, not earmarked to any fund
      unallocated: pick(unassigned, 'INCOME') - pick(unassigned, 'EXPENSE'),
      transactionCount: txCount,
    });
  } catch (error) {
    console.error('Error fetching funds summary:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Monthly trend + category breakdown for the Insights tab
router.get('/analytics', requireAuth, requireVerified, async (req, res) => {
  try {
    const months = Math.min(24, Math.max(3, Number(req.query.months) || 6));
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const match = { date: { $gte: start } };

    // $year/$month default to UTC; the community banks in PH time, so a Sunday
    // evening entry would otherwise land in the wrong month.
    const [monthly, categories, funds] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: {
              y: { $year: { date: '$date', timezone: DUES_TIMEZONE } },
              m: { $month: { date: '$date', timezone: DUES_TIMEZONE } },
              type: '$type',
            },
            total: { $sum: '$amount' },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: { category: '$category', type: '$type' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
      ]),
      DesignatedFund.find({}).select('name color').lean(),
    ]);

    // Fill every month in the window, including ones with no activity, so the
    // chart keeps an even x-axis instead of collapsing empty months.
    const series = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - (months - 1) + i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const find = (type) =>
        monthly.find(r => r._id.y === y && r._id.m === m && r._id.type === type)?.total || 0;
      const income = find('INCOME');
      const expense = find('EXPENSE');
      series.push({ year: y, month: m, income, expense, net: income - expense });
    }

    res.json({
      months,
      series,
      categories: categories.map(c => ({
        category: c._id.category,
        type: c._id.type,
        total: c.total,
        count: c.count,
      })),
      funds,
    });
  } catch (error) {
    console.error('Error building analytics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Full (unpaginated) result set for the current filters, used by the export
// button. Capped so a runaway export cannot exhaust memory.
router.get('/export', requireAuth, requireVerified, async (req, res) => {
  try {
    const query = buildTxQuery(req.query);
    const transactions = await Transaction.find(query)
      .sort({ date: -1, createdAt: -1 })
      .limit(5000)
      .populate('createdBy', 'displayName')
      .populate('designatedFund', 'name')
      .lean();

    res.json({ transactions, total: transactions.length, capped: transactions.length === 5000 });
  } catch (error) {
    console.error('Error exporting transactions:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get transactions with pagination (10 per page by default)
router.get('/', requireAuth, requireVerified, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const query = buildTxQuery(req.query);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .sort({ date: -1, createdAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .populate('createdBy', 'displayName')
        .populate('designatedFund', 'name'),
      Transaction.countDocuments(query),
    ]);

    res.json({
      transactions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
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

// Rename a category across all transactions (Admin/Treasurer only)
router.patch('/categories/rename', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { oldName, newName } = req.body;
    if (!oldName || !newName || !newName.trim()) {
      return res.status(400).json({ message: 'oldName and newName are required.' });
    }
    const trimmed = newName.trim();
    const result = await Transaction.updateMany(
      { category: oldName },
      { $set: { category: trimmed } }
    );
    res.json({ message: `Renamed "${oldName}" to "${trimmed}" (${result.modifiedCount} transaction(s) updated).` });
  } catch (error) {
    console.error('Error renaming category:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new transaction
router.post('/', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { amount, type, category, description, date, designatedFund } = req.body;

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
      designatedFund: designatedFund || null,
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
    const { amount, type, category, description, date, designatedFund } = req.body;

    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    if (amount) transaction.amount = Number(amount);
    if (type) transaction.type = type;
    if (category) transaction.category = category;
    if (description !== undefined) transaction.description = description;
    if (date) transaction.date = date;
    
    // Allow explicitly setting to null or empty string to unset
    if (designatedFund !== undefined) {
      transaction.designatedFund = designatedFund || null;
    }

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

    // Cascade delete any linked DuesPayment BEFORE deleting the transaction
    await DuesPayment.deleteMany({ transactionId: req.params.id });

    await transaction.deleteOne();

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

    // The rate and start date used to be duplicated as literals on the client.
    // Shipping them with the ledger keeps the grid, the status pills and the
    // emailed statements on one definition.
    const sundaysToDate = duesSundaysToDate();
    res.json({
      members,
      payments,
      config: {
        startDate: DUES_START_DATE,
        weeklyAmount: DUES_WEEKLY_AMOUNT,
        sundaysToDate,
        expectedToDate: sundaysToDate * DUES_WEEKLY_AMOUNT,
      },
    });
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
    // Expand window by ±24 hours to handle timezone shifts between local and Vercel UTC
    const startDate = new Date(dDate.getTime() - 24 * 60 * 60 * 1000);
    const endDate = new Date(dDate.getTime() + 48 * 60 * 60 * 1000);

    const member = await DuesMember.findById(memberId);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    let payment = await DuesPayment.findOne({
      member: memberId,
      collectionDate: { $gte: startDate, $lte: endDate }
    });

    const numAmount = Number(amount);

    // If amount is 0, empty, or invalid, delete the record
    if (!amount || numAmount === 0 || isNaN(numAmount)) {
      if (payment) {
        await payment.deleteOne();
        if (payment.transactionId) {
          await Transaction.findByIdAndDelete(payment.transactionId);
        }
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
    // Check if a designated fund is set to auto-assign weekly dues
    const autoFund = await DesignatedFund.findOne({ autoAssignWeeklyDues: true });

    const transaction = new Transaction({
      amount: numAmount,
      type: 'INCOME',
      category: 'Weekly Dues',
      description: `Weekly dues — ${member.name} (${dDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`,
      date: new Date(),
      designatedFund: autoFund ? autoFund._id : null,
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
    
    try {
      await payment.save();
    } catch (err) {
      // If saving the payment fails (e.g. unique constraint), clean up the transaction to prevent orphans
      await transaction.deleteOne();
      throw err; // rethrow to be caught by the outer catch block
    }

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
      arrearsHtml = `Your current dues balance is <span style="color:#ef4444;font-weight:bold;">₱${arrears} in arrears</span>. Please settle it at your earliest convenience.`;
    } else if (arrears < 0) {
      arrearsHtml = `You're advanced by <span style="color:#f59e0b;font-weight:bold;">₱${Math.abs(arrears)}</span>! You're all caught up and then some — great job!`;
    } else {
      arrearsHtml = `You're <span style="color:#22c55e;font-weight:bold;">Fully Updated</span>! No arrears at all — keep it up!`;
    }

    const html = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout:fixed;background-color:#f8fafc;padding:20px 0;font-family:sans-serif;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background-color:#ffffff;border:1px solid #f0f0f0;border-radius:20px;padding:30px;box-shadow:0 10px 30px rgba(0,0,0,0.07);">
              <tr>
                <td align="center" style="padding-bottom:25px;">
                  <h2 style="color:#1e293b;margin:0;font-size:24px;font-weight:800;font-family:sans-serif;">Your Dues Statement</h2>
                </td>
              </tr>
              <tr>
                <td align="center" style="color:#475569;font-size:16px;line-height:1.6;padding-bottom:20px;font-family:sans-serif;">
                  Hi <strong>${user.displayName}</strong>! Here's your current dues status as of today.
                </td>
              </tr>
              <tr>
                <td align="center" style="padding-bottom:20px;">
                  <table border="0" cellpadding="20" cellspacing="0" width="100%" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:15px;">
                    <tr>
                      <td align="center">
                        <span style="display:block;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;font-family:sans-serif;">Weekly Dues Balance</span>
                        <p style="color:#475569;font-size:15px;line-height:1.7;margin:0;font-family:sans-serif;">
                          ${arrearsHtml}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td align="center" style="color:#94a3b8;font-size:12px;padding-top:20px;font-family:sans-serif;">
                  This is an official statement from <strong>DFCCI Threshold</strong>. Keep shining!
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    await sendEmail(user.email, 'Your DFCCI Threshold Weekly Dues Statement', html);
    res.json({ message: `Dues statement sent to ${user.email}` });
  } catch (err) {
    console.error('Error sending dues email:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send batch dues reminders to all subscribed users (Admin/Treasurer only)
router.post('/dues/send-batch-reminders', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { timing = 'Manual' } = req.body;
    await sendDuesReminders(timing);
    res.json({ message: `Batch dues reminders triggered successfully (${timing} template).` });
  } catch (err) {
    console.error('Error triggering batch reminders:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ─── DESIGNATED FUNDS (BUDGETS) ─────────────────────────────────────────────

// Get all designated funds with dynamically calculated balances
router.get('/designated', requireAuth, requireVerified, async (req, res) => {
  try {
    const funds = await DesignatedFund.find({}).sort({ createdAt: -1 });
    
    // For each fund, compute the current balance by aggregating transactions assigned to it
    const fundsWithBalances = await Promise.all(funds.map(async (fund) => {
      const [rows, lastTx] = await Promise.all([
        Transaction.aggregate([
          { $match: { designatedFund: fund._id } },
          { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        ]),
        Transaction.findOne({ designatedFund: fund._id }).sort({ date: -1 }).select('date').lean(),
      ]);

      const income = rows.find(r => r._id === 'INCOME');
      const expense = rows.find(r => r._id === 'EXPENSE');
      const totalIncome = income?.total || 0;
      const totalExpense = expense?.total || 0;

      return {
        ...fund.toObject(),
        totalIncome,
        totalExpense,
        currentBalance: totalIncome - totalExpense,
        transactionCount: (income?.count || 0) + (expense?.count || 0),
        lastActivity: lastTx?.date || null,
      };
    }));

    res.json(fundsWithBalances);
  } catch (error) {
    console.error('Error fetching designated funds:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new designated fund
router.post('/designated', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { name, description, targetAmount, color, autoAssignWeeklyDues } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Fund name is required' });
    }

    // Ensure only one fund has autoAssignWeeklyDues at a time
    if (autoAssignWeeklyDues) {
      await DesignatedFund.updateMany({}, { autoAssignWeeklyDues: false });
    }

    const newFund = new DesignatedFund({
      name: name.trim(),
      description,
      targetAmount: Number(targetAmount) || 0,
      color: color || '#3b82f6',
      autoAssignWeeklyDues: !!autoAssignWeeklyDues,
      createdBy: req.user._id,
    });

    await newFund.save();
    res.status(201).json(newFund);
  } catch (error) {
    console.error('Error creating designated fund:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a designated fund
router.put('/designated/:id', adminOrTreasurerAuth, async (req, res) => {
  try {
    const { name, description, targetAmount, color, autoAssignWeeklyDues } = req.body;
    
    const fund = await DesignatedFund.findById(req.params.id);
    if (!fund) {
      return res.status(404).json({ message: 'Designated fund not found' });
    }

    if (name) fund.name = name.trim();
    if (description !== undefined) fund.description = description;
    if (targetAmount !== undefined) fund.targetAmount = Number(targetAmount) || 0;
    if (color) fund.color = color;
    if (autoAssignWeeklyDues !== undefined) {
      // Ensure only one fund has the flag
      if (autoAssignWeeklyDues) {
        await DesignatedFund.updateMany({ _id: { $ne: fund._id } }, { autoAssignWeeklyDues: false });
      }
      fund.autoAssignWeeklyDues = !!autoAssignWeeklyDues;
    }

    await fund.save();
    res.json(fund);
  } catch (error) {
    console.error('Error updating designated fund:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a designated fund
router.delete('/designated/:id', adminOrTreasurerAuth, async (req, res) => {
  try {
    const fund = await DesignatedFund.findById(req.params.id);
    if (!fund) {
      return res.status(404).json({ message: 'Designated fund not found' });
    }

    await fund.deleteOne();
    res.json({ message: 'Designated fund removed' });
  } catch (error) {
    console.error('Error deleting designated fund:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
