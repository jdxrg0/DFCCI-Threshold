const mongoose = require('mongoose');

// One row per Asia/Manila day. The unique `date` key is what makes the daily
// capture idempotent — a repeated run upserts the same row instead of adding one.
const platformSnapshotSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
  },
  capturedAt: {
    type: Date,
    default: Date.now,
  },
  database: {
    dataSize: Number,
    storageSize: Number,
    objectsCount: Number,
    collectionsCount: Number,
  },
  emails: {
    sentLast24h: Number,
    failedLast24h: Number,
  },
  cloudinary: {
    creditsUsage: Number,
    creditsLimit: Number,
    storageUsage: Number,
    bandwidthUsage: Number,
    transformations: Number,
  },
  counts: {
    users: Number,
    verifiedUsers: Number,
    threads: Number,
    tickets: Number,
  },
}, { timestamps: true });

module.exports = mongoose.model('PlatformSnapshot', platformSnapshotSchema);
