const mongoose = require('mongoose');

const fruitEndorsementSchema = new mongoose.Schema({
  endorser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  endorsee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  fruits: [{
    type: String,
    enum: [
      'Love', 'Joy', 'Peace', 'Patience', 'Kindness', 
      'Goodness', 'Faithfulness', 'Gentleness', 'Self-control'
    ]
  }]
}, { timestamps: true });

// Ensure one user can only have one endorsement record for another user
fruitEndorsementSchema.index({ endorser: 1, endorsee: 1 }, { unique: true });

module.exports = mongoose.model('FruitEndorsement', fruitEndorsementSchema);
