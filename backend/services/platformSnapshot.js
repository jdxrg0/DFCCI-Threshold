const cron = require('node-cron');
const mongoose = require('mongoose');
const PlatformSnapshot = require('../models/PlatformSnapshot');
const EmailLog = require('../models/EmailLog');
const User = require('../models/User');
const Thread = require('../models/Thread');
const Ticket = require('../models/Ticket');
const { cloudinary } = require('../utils/cloudinary');

/* Asia/Manila is a fixed UTC+8 with no DST, so shifting the clock by 8 hours
   and slicing the ISO string yields the local calendar day without adding a
   timezone dependency — same trick as getUTC8Today in routes/users.js. */
const getManilaDateKey = () => {
  const utc8Time = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return utc8Time.toISOString().slice(0, 10);
};

/**
 * Collects live platform usage (MongoDB, email, Cloudinary).
 * Shared by the admin platform-limits endpoint and the daily snapshot so the
 * two readings can never drift apart. Never throws — each source degrades to
 * a zeroed or null section of its own.
 */
const collectPlatformStats = async () => {
  // 1. Fetch MongoDB statistics
  let dbStats = { dataSize: 0, storageSize: 0, collectionsCount: 0, objectsCount: 0 };
  let collectionsList = [];

  try {
    if (mongoose.connection.readyState === 1) {
      const stats = await mongoose.connection.db.command({ dbStats: 1 });
      dbStats = {
        dataSize: stats.dataSize || 0,
        storageSize: stats.storageSize || 0,
        collectionsCount: stats.collections || 0,
        objectsCount: stats.objects || 0
      };

      // Query individual collection stats
      const collections = await mongoose.connection.db.listCollections().toArray();
      for (const col of collections) {
        if (col.type && col.type !== 'collection') continue;
        try {
          const colStats = await mongoose.connection.db.command({ collStats: col.name });
          collectionsList.push({
            name: col.name,
            count: colStats.count || 0,
            size: colStats.size || 0,
            storageSize: colStats.storageSize || 0
          });
        } catch (colErr) {
          console.error(`Error fetching stats for collection ${col.name}:`, colErr);
          // Fallback: count documents using collection countDocuments
          try {
            const count = await mongoose.connection.db.collection(col.name).countDocuments();
            collectionsList.push({
              name: col.name,
              count: count,
              size: 0,
              storageSize: 0
            });
          } catch (_) {}
        }
      }
      // Sort collections by size descending, then count descending
      collectionsList.sort((a, b) => (b.size || b.count) - (a.size || a.count));
    }
  } catch (dbErr) {
    console.error('Error fetching MongoDB stats:', dbErr);
  }

  // 2. Fetch Email daily usage stats (Gmail free tier limits to 500 emails/day)
  let emailStats = { sentLast24h: 0, limit: 500 };
  try {
    const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentCount = await EmailLog.countDocuments({
      status: 'sent',
      sentAt: { $gte: past24Hours }
    });
    emailStats.sentLast24h = sentCount;
  } catch (emailErr) {
    console.error('Error fetching EmailLog stats:', emailErr);
  }

  // 3. Fetch Cloudinary usage statistics
  let cloudinaryStats = null;
  try {
    const usage = await cloudinary.api.usage();
    if (usage) {
      cloudinaryStats = {
        plan: usage.plan || 'Free',
        lastUpdated: usage.last_updated || new Date().toISOString(),
        credits: usage.credits ? { usage: usage.credits.usage, limit: usage.credits.limit, usedPercent: usage.credits.used_percent } : null,
        transformations: usage.transformations ? { 
          usage: usage.transformations.usage, 
          limit: usage.transformations.limit || 25000, 
          usedPercent: usage.transformations.used_percent !== undefined ? usage.transformations.used_percent : ((usage.transformations.usage / 25000) * 100) 
        } : null,
        storage: usage.storage ? { 
          usage: usage.storage.usage, 
          limit: usage.storage.limit || (25 * 1024 * 1024 * 1024), 
          usedPercent: usage.storage.used_percent !== undefined ? usage.storage.used_percent : ((usage.storage.usage / (25 * 1024 * 1024 * 1024)) * 100) 
        } : null,
        bandwidth: usage.bandwidth ? { 
          usage: usage.bandwidth.usage, 
          limit: usage.bandwidth.limit || (25 * 1024 * 1024 * 1024), 
          usedPercent: usage.bandwidth.used_percent !== undefined ? usage.bandwidth.used_percent : ((usage.bandwidth.usage / (25 * 1024 * 1024 * 1024)) * 100) 
        } : null
      };
    }
  } catch (cloudinaryErr) {
    console.error('Error fetching Cloudinary usage stats:', cloudinaryErr.message);
  }

  return {
    success: true,
    database: {
      ...dbStats,
      collections: collectionsList,
      limitBytes: 512 * 1024 * 1024 // 512 MB Hobby Limit
    },
    emails: emailStats,
    cloudinary: cloudinaryStats
  };
};

/**
 * Writes today's usage row. Idempotent: re-running on the same Manila day
 * updates the existing row instead of creating a second one.
 * Returns the snapshot document, or null when it could not be written.
 */
const captureSnapshot = async () => {
  try {
    const date = getManilaDateKey();
    const stats = await collectPlatformStats();

    const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [users, verifiedUsers, threads, tickets, failedLast24h] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isVerified: true }),
      Thread.countDocuments(),
      Ticket.countDocuments(),
      EmailLog.countDocuments({ status: 'failed', sentAt: { $gte: past24Hours } })
    ]);

    const update = {
      date,
      capturedAt: new Date(),
      database: {
        dataSize: stats.database.dataSize,
        storageSize: stats.database.storageSize,
        objectsCount: stats.database.objectsCount,
        collectionsCount: stats.database.collectionsCount
      },
      emails: {
        sentLast24h: stats.emails.sentLast24h,
        failedLast24h
      },
      counts: { users, verifiedUsers, threads, tickets }
    };

    // Only written when the Cloudinary API actually answered. A failed call
    // must not stamp zeroes onto the row — that would read as usage dropping.
    if (stats.cloudinary) {
      update.cloudinary = {
        creditsUsage: stats.cloudinary.credits ? stats.cloudinary.credits.usage : 0,
        creditsLimit: stats.cloudinary.credits ? stats.cloudinary.credits.limit : 0,
        storageUsage: stats.cloudinary.storage ? stats.cloudinary.storage.usage : 0,
        bandwidthUsage: stats.cloudinary.bandwidth ? stats.cloudinary.bandwidth.usage : 0,
        transformations: stats.cloudinary.transformations ? stats.cloudinary.transformations.usage : 0
      };
    }

    const snapshot = await PlatformSnapshot.findOneAndUpdate(
      { date },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`[Snapshot] Captured platform usage for ${date}.`);
    return snapshot;
  } catch (error) {
    console.error('[Snapshot] Failed to capture platform usage:', error);
    return null;
  }
};

let snapshotCron = null;
let bootCaptureQueued = false;

/**
 * Starts the daily capture at 00:05 PHT plus a boot-time catch-up.
 */
const initSnapshotScheduler = () => {
  if (!snapshotCron) {
    snapshotCron = cron.schedule('5 0 * * *', async () => {
      console.log('[Snapshot] Running daily platform usage capture...');
      await captureSnapshot();
    }, { scheduled: true, timezone: "Asia/Manila" });
    console.log('[Snapshot] Daily platform snapshot cron initialized (00:05 PHT).');
  }

  /* Render's free tier restarts the process whenever it likes, so a plain cron
     silently loses any day whose 00:05 fell inside a restart. Catch up on boot
     when today has no row yet, delayed so it does not compete with startup. */
  if (!bootCaptureQueued) {
    bootCaptureQueued = true;
    setTimeout(async () => {
      try {
        const date = getManilaDateKey();
        const existing = await PlatformSnapshot.findOne({ date }).select('_id').lean();
        if (existing) {
          console.log(`[Snapshot] Row for ${date} already exists. Skipping boot capture.`);
          return;
        }
        console.log(`[Snapshot] No row for ${date} yet. Running catch-up capture...`);
        await captureSnapshot();
      } catch (error) {
        console.error('[Snapshot] Boot catch-up capture failed:', error);
      }
    }, 30 * 1000);
  }
};

module.exports = { collectPlatformStats, captureSnapshot, initSnapshotScheduler };
