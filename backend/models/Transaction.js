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
  }
}, { timestamps: true });

module.exports = mongoose.model('Transaction', transactionSchema);
