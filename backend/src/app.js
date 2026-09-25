const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const shopRoutes = require('./routes/shopRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const trackingRoutes = require('./routes/trackingRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const shopOwnerRoutes = require('./routes/shopOwnerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:8081',
      'http://127.0.0.1:8081',
      'http://localhost:19006',
      'http://127.0.0.1:19006',
      'http://10.0.2.2:8081',
      'http://10.0.2.2:19006',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];

    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://10.') || origin.startsWith('http://172.')) {
      callback(null, true);
      return;
    }

    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use((req, _res, next) => {
  console.log('[api]', req.method, req.originalUrl);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'cargo-swift-backend' });
});

app.get('/test-db', async (_req, res) => {
  try {
    const result = await db.query('SELECT 1 AS test');
    res.json({ success: true, message: 'Database connection successful', data: result.rows[0] });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ success: false, error: 'Database connection failed' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/shop-owner', shopOwnerRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use(errorHandler);

module.exports = app;
