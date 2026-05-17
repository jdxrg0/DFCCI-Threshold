const mongoose = require('mongoose');

const designatedFundSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  targetAmount: {
    type: Number,
    default: 0,
  },
  color: {
    type: String,
    default: '#3b82f6', // Default blue color for the UI
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, { timestamps: true });

module.exports = mongoose.model('DesignatedFund', designatedFundSchema);
