const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();



const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const threadRoutes = require('./routes/threads');
const notificationRoutes = require('./routes/notifications');
const counselorRoutes = require('./routes/counselor');
const ticketRoutes = require('./routes/tickets');
const affirmationRoutes = require('./routes/affirmations');
const fruitRoutes = require('./routes/fruitEndorsements');
const fundRoutes = require('./routes/funds');
const resourceRoutes = require('./routes/resources');
const gameRoutes = require('./routes/games');
const devotionalRoutes = require('./routes/devotionals');
const emailRoutes = require('./routes/emails');
const { initReminderScheduler } = require('./utils/reminderScheduler');


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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
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
app.use('/api/funds', fundRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/devotionals', devotionalRoutes);
app.use('/api/emails', emailRoutes);


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

  // Start the background scheduler
  initReminderScheduler();
});
