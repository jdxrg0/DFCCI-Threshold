require('dotenv').config();
const { createApp } = require('./bootstrap');
const { connectDB } = require('./db');
const { startSchedulers, startPostListenSchedulers, startKeepAlive } = require('./schedulers');

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
  });