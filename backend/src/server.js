require('dotenv').config();

const app = require('./app');
const { PORT } = require('./config/env');
const { connectDB } = require('./config/database');

async function startServer() {
  try {
    await connectDB();
  } catch (error) {
    console.warn('Database unavailable. Continuing in demo-auth mode:', error.message);
  }

  app.listen(PORT, () => {
    console.log(`Backend listening on port ${PORT}`);
  });
}

startServer();
