const automationScheduler = require('./services/automationScheduler');
const { initReminderScheduler } = require('./utils/reminderScheduler');
const { initSnapshotScheduler } = require('./services/platformSnapshot');

// Start cron/automation schedulers that require an active DB connection.
function startSchedulers() {
  automationScheduler.init();
}

// Start schedulers that can run once the HTTP server is listening.
function startPostListenSchedulers() {
  initReminderScheduler();

  // Daily platform usage rows can only be captured while the process is alive
  initSnapshotScheduler();
}

// Prevent Render's free tier from sleeping (15 min timeout).
// Render automatically injects RENDER_EXTERNAL_URL in production.
function startKeepAlive(renderUrl) {
  if (!renderUrl) return;
  const https = require('https');
  setInterval(() => {
    https.get(`${renderUrl}/api/ping`).on('error', (err) => {
      console.error('Self-ping failed:', err.message);
    });
    console.log('Self-ping sent to keep server awake.');
  }, 14 * 60 * 1000); // Ping every 14 minutes
}

module.exports = { startSchedulers, startPostListenSchedulers, startKeepAlive };