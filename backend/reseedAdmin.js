/**
 * One-time admin re-seed script.
 * Run with: node reseedAdmin.js
 * Safe to delete after use.
 */
const mongoose = require('mongoose');
const seedAdmin = require('./seeds/adminSeed');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    await seedAdmin();
    mongoose.disconnect();
    console.log('Done. You can now log in with the admin credentials in your .env file.');
  })
  .catch((err) => {
    console.error('Connection error:', err);
    process.exit(1);
  });
