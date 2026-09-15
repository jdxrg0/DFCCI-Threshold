const mongoose = require('mongoose');

// Drop old deprecated index for DuesPayment if it exists to fix E11000 Server error
async function dropLegacyIndex() {
  try {
    const DuesPayment = require('./models/DuesPayment');
    await DuesPayment.collection.dropIndex('member_1_weekStart_1');
    console.log('Dropped old index: member_1_weekStart_1');
  } catch (err) {
    // Ignore if index doesn't exist
  }
}

// AUTOMATED HEALING: Cleanup orphaned Weekly Dues transactions.
//
// Scoped to source:'DUES_LEDGER' — rows this server created itself while
// upserting a dues cell. It used to match on category alone, which also
// caught any transaction a treasurer had entered by hand under the "Weekly
// Dues" category: those never have a DuesPayment, so real money (and, once
// receipts landed, its receipt image) was deleted on the next restart with
// no trace. Legacy rows predate the marker, so they are reported for review
// rather than deleted.
async function cleanupOrphanedDues() {
  try {
    const Transaction = require('./models/Transaction');
    const DuesPayment = require('./models/DuesPayment');
    const { recordFundAudit, describe } = require('./utils/fundAudit');

    const candidates = await Transaction.find({ category: 'Weekly Dues' }).select(
      '_id amount type category date source receiptCloudinaryId'
    );

    let orphansRemoved = 0;
    let unmarked = 0;

    for (const t of candidates) {
      const payment = await DuesPayment.findOne({ transactionId: t._id });
      if (payment) continue;

      if (t.source !== 'DUES_LEDGER') {
        unmarked++;
        continue;
      }

      // findByIdAndDelete fires the receipt-cleanup hook on the model.
      await Transaction.findByIdAndDelete(t._id);
      orphansRemoved++;

      // A sweep that deletes money silently is indistinguishable from money
      // going missing. Leave a row naming the sweep as the actor.
      await recordFundAudit({
        req: null,
        action: 'DELETE',
        entityId: t._id,
        label: describe(t),
        amount: t.amount,
        actorName: 'System (startup cleanup)',
        actorRole: 'SYSTEM',
        note: 'Weekly dues transaction had no matching payment row and was removed automatically.',
      });
    }

    if (orphansRemoved > 0) {
      console.log(`[Self-Healing] Removed ${orphansRemoved} orphaned Weekly Dues transaction(s).`);
    }
    if (unmarked > 0) {
      console.warn(
        `[Self-Healing] ${unmarked} "Weekly Dues" transaction(s) have no payment row but are not ledger-created. ` +
        'Left in place — review them in the Fund Tracker rather than deleting blind.'
      );
    }
  } catch (err) {
    console.error('[Self-Healing] Error cleaning up orphans:', err);
  }
}

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  await dropLegacyIndex();
  await cleanupOrphanedDues();
}

module.exports = { connectDB };