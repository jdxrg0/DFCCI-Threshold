const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['INCOME', 'EXPENSE'],
    required: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  designatedFund: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DesignatedFund',
    default: null,
  },
  // Receipt photo, stored on Cloudinary. Same Url/CloudinaryId pair every other
  // model in this app uses (see Resource, BibleVideo, User.profilePicture).
  receiptUrl: {
    type: String,
    default: '',
  },
  receiptCloudinaryId: {
    type: String,
    default: '',
  },
  // Which code path created this row. The boot-time orphan sweep may only ever
  // delete DUES_LEDGER rows: a treasurer can legitimately pick the "Weekly
  // Dues" category by hand, and such a row has no DuesPayment, so a
  // category-only predicate would silently delete real money on next restart.
  source: {
    type: String,
    enum: ['MANUAL', 'DUES_LEDGER'],
    default: 'MANUAL',
  }
}, { timestamps: true });

// ── Receipt cleanup ─────────────────────────────────────────────────────────
// Deletes happen from three places: the DELETE route, the dues-payment cascade,
// and the self-healing orphan sweep in server.js. Hooking the model means no
// path can leak an orphaned Cloudinary asset.
async function destroyReceipt(doc) {
  if (!doc?.receiptCloudinaryId) return;
  try {
    const { cloudinary } = require('../utils/cloudinary');
    await cloudinary.uploader.destroy(doc.receiptCloudinaryId);
  } catch (err) {
    // Never fail a delete because the image host is unreachable.
    console.error('Failed to remove receipt from Cloudinary:', err.message);
  }
}

transactionSchema.post('deleteOne', { document: true, query: false }, function () {
  return destroyReceipt(this);
});

transactionSchema.post('findOneAndDelete', function (doc) {
  return destroyReceipt(doc);
});

transactionSchema.post('deleteMany', function () {
  // Bulk deletes cannot see the documents. Nothing in this app bulk-deletes
  // transactions today; if that changes, collect the ids first.
});

// ── Indexes ─────────────────────────────────────────────────────────────────
// Every ledger read sorts by { date: -1, createdAt: -1 }. Without these the
// list, export, summary and analytics routes each ran a full collection scan
// followed by an in-memory sort.
// Equality field first, then date, which is both the range bound and the sort
// prefix — the one case where a range field correctly precedes a sort key.

// Default ledger page, export, and the summary/analytics date windows.
transactionSchema.index({ date: -1, createdAt: -1 });

// filterType=WEEKLY_DUES plus the month/year range and the standard sort.
// Also backs distinct('category') and the category-rename updateMany.
transactionSchema.index({ category: 1, date: -1, createdAt: -1 });

// designatedFund filter + sort, the unallocated aggregate, and the per-fund
// balance lookup that runs once per fund on the Funds tab.
transactionSchema.index({ designatedFund: 1, date: -1, createdAt: -1 });

// Covered index for the group-by-type totals: {type, amount} answers the $sum
// without touching the documents at all.
transactionSchema.index({ type: 1, amount: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
