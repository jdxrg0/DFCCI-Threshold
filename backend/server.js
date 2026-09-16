require('dotenv').config();
const { createApp } = require('./bootstrap');
const { connectDB } = require('./db');
const { startSchedulers, startPostListenSchedulers, startKeepAlive } = require('./schedulers');

// Refuse to boot without the signing key. A missing JWT_SECRET used to fall
// back to a hardcoded value, minting unforgettable tokens with a widely-known
// secret — and tokens signed under any fallback can never be verified anyway.
if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set. Set it in the environment before starting the server.');
  process.exit(1);
}

const app = createApp();
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    startSchedulers();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);

      startKeepAlive(process.env.RENDER_EXTERNAL_URL);
      startPostListenSchedulers();
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    // Without a database there is nothing to serve and no listener to answer
    // /api/ping, yet a live-but-dead process looks "up" to platform monitors.
    // Exit so the host restarts the app and retries the connection.
    process.exit(1);
  });