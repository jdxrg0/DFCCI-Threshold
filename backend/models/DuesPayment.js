const mongoose = require('mongoose');

const duesPaymentSchema = new mongoose.Schema({
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DuesMember',
    required: true,
  },
  collectionDate: {
    type: Date,
    required: true,
  },
  amount: {
    type: Number,
    default: 10,
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
  },
}, { timestamps: true });

// Prevent duplicate payment for the same member + collectionDate
duesPaymentSchema.index({ member: 1, collectionDate: 1 }, { unique: true });

// Cascade delete when a transaction is removed, and the boot-time orphan sweep.
duesPaymentSchema.index({ transactionId: 1 });

module.exports = mongoose.model('DuesPayment', duesPaymentSchema);
