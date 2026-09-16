const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const { apiLimiter } = require('./middleware/rateLimiters');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const threadRoutes = require('./routes/threads');
const counselorRoutes = require('./routes/counselor');
const ticketRoutes = require('./routes/tickets');
const affirmationRoutes = require('./routes/affirmations');
const fruitRoutes = require('./routes/fruitEndorsements');
const fundRoutes = require('./routes/funds');
const resourceRoutes = require('./routes/resources');
const gameRoutes = require('./routes/games');
const devotionalRoutes = require('./routes/devotionals');
const emailRoutes = require('./routes/emails');
const bibleVideoRoutes = require('./routes/bibleVideos');
const automationRoutes = require('./routes/automation');
const memberRoutes = require('./routes/members');
const submissionRoutes = require('./routes/submissions');
const calendarRoutes = require('./routes/calendar');
const settingsRoutes = require('./routes/settings');

function registerRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/threads', threadRoutes);
  app.use('/api/counselor', counselorRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/affirmations', affirmationRoutes);
  app.use('/api/fruits', fruitRoutes);
  app.use('/api/funds', fundRoutes);
  app.use('/api/resources', resourceRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/devotionals', devotionalRoutes);
  app.use('/api/emails', emailRoutes);
  app.use('/api/bible-videos', bibleVideoRoutes);
  app.use('/api/automation', automationRoutes);
  app.use('/api/members', memberRoutes);
  app.use('/api/submissions', submissionRoutes);
  app.use('/api/calendar', calendarRoutes);
  app.use('/api/settings', settingsRoutes);

  // Ping route for uptime monitoring
  app.get('/api/ping', (req, res) => {
    res.status(200).send('pong');
  });
}

function createApp() {
  const app = express();

  const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL].filter(Boolean)
    : true; // Allow all origins in development

  app.use(cors({
    origin: function (origin, callback) {
      // In development, allow all origins (helpful for mobile testing via IP)
      if (process.env.NODE_ENV !== 'production' || !origin) {
        return callback(null, true);
      }

      // In production, whitelist only
      if (allowedOrigins === true || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        console.warn('CORS blocked origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // Backstop against firehose abuse across the whole API surface.
  app.use('/api', apiLimiter);

  registerRoutes(app);

  // Global error handler — must be registered after all routes
  app.use((err, req, res, _next) => {
    // Oversized uploads are a client mistake, not a server fault. Route-scoped
    // handlers (funds) already map this to 413; this catches the rest so users
    // don't read a 500 for a too-big profile picture.
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large. Maximum size is 5MB.'
        : err.message;
      return res.status(413).json({ message });
    }

    console.error('[Error]', err.message);
    const status = err.status || err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message || 'Internal server error';
    res.status(status).json({ message });
  });

  return app;
}

module.exports = { createApp };