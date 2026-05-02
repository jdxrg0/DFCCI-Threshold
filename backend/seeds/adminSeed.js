const User = require('../models/User');
const bcrypt = require('bcrypt');
require('dotenv').config();

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      console.log('Admin credentials not provided in environment variables.');
      return;
    }

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log('Admin account already exists.');
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminPassword, salt);

    const newAdmin = new User({
      displayName: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true,
    });

    await newAdmin.save();
    console.log('Admin account successfully seeded.');
  } catch (error) {
    console.error('Error seeding admin account:', error);
  }
};

module.exports = seedAdmin;
