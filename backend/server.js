const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const seedAdmin = require('./seeds/adminSeed');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const threadRoutes = require('./routes/threads');
const notificationRoutes = require('./routes/notifications');
const counselorRoutes = require('./routes/counselor');
const ticketRoutes = require('./routes/tickets');
const affirmationRoutes = require('./routes/affirmations');
const fruitRoutes = require('./routes/fruitEndorsements');

const app = express();

const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : true; // Allow all origins in development

app.use(cors({
  origin: function (origin, callback) {
    // In development, allow all. In production, whitelist only.
    if (allowedOrigins === true) {
      return callback(null, true);
    }
    // Allow server-to-server requests (no origin header)
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: origin ${origin} is not allowed.`));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    // Run seeders
    seedAdmin();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/counselor', counselorRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/affirmations', affirmationRoutes);
app.use('/api/fruits', fruitRoutes);

// Ping route for uptime monitoring
app.get('/api/ping', (req, res) => {
  res.status(200).send('pong');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Prevent Render's free tier from sleeping (15 min timeout)
  // Render automatically injects RENDER_EXTERNAL_URL in production
  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    const https = require('https');
    setInterval(() => {
      https.get(`${renderUrl}/api/ping`).on('error', (err) => {
        console.error('Self-ping failed:', err.message);
      });
      console.log('Self-ping sent to keep server awake.');
    }, 14 * 60 * 1000); // Ping every 14 minutes
  }
});
