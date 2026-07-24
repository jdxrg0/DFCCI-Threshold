const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();



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
const automationScheduler = require('./services/automationScheduler');
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
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Drop old deprecated index for DuesPayment if it exists to fix E11000 Server error
    try {
      const DuesPayment = require('./models/DuesPayment');
      await DuesPayment.collection.dropIndex('member_1_weekStart_1');
      console.log('Dropped old index: member_1_weekStart_1');
    } catch (err) {
      // Ignore if index doesn't exist
    }

    // AUTOMATED HEALING: Cleanup orphaned Weekly Dues transactions
    try {
      const Transaction = require('./models/Transaction');
      const DuesPayment = require('./models/DuesPayment');
      
      const duesTransactions = await Transaction.find({ category: 'Weekly Dues' });
      let orphansRemoved = 0;
      
      for (const t of duesTransactions) {
        const payment = await DuesPayment.findOne({ transactionId: t._id });
        if (!payment) {
          await Transaction.findByIdAndDelete(t._id);
          orphansRemoved++;
        }
      }
      
      if (orphansRemoved > 0) {
        console.log(`[Self-Healing] Removed ${orphansRemoved} orphaned Weekly Dues transaction(s).`);
      }
    } catch (err) {
      console.error('[Self-Healing] Error cleaning up orphans:', err);
    }

    automationScheduler.init();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Routes
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
