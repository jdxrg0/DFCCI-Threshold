const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'NewMirror', 'NewReply', 'CounselorConsent', 'EscalationConsent', 'Resolved', 'Accepted', 
      'DeletionApproved', 'DeletionRejected', 'ThreadDeleted', 'RestoreApproved', 'RestoreRejected', 'ThreadRestored',
      'NewAffirmation', 'AffirmationReply', 'AffirmationReceived'
    ],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  thread: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Thread',
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Notification', notificationSchema);
