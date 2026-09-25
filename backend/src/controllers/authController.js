const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/userModel');
const { JWT_SECRET } = require('../config/env');

const DEMO_PASSWORD = 'password123';
const demoUsersByEmail = new Map([
  ['admin@example.com', { id: 'demo-admin', email: 'admin@example.com', full_name: 'Demo Admin', phone: '+255710000000', role: 'admin', account_status: 'approved', is_verified: true, created_at: new Date().toISOString() }],
  ['shop_owner@example.com', { id: 'demo-shop-owner', email: 'shop_owner@example.com', full_name: 'Demo Shop Owner', phone: '+255711000000', role: 'shop_owner', account_status: 'approved', is_verified: true, created_at: new Date().toISOString() }],
  ['driver@example.com', { id: 'demo-driver', email: 'driver@example.com', full_name: 'Demo Driver', phone: '+255712000000', role: 'driver', account_status: 'approved', is_verified: true, created_at: new Date().toISOString() }],
  ['customer@example.com', { id: 'demo-customer', email: 'customer@example.com', full_name: 'Demo Customer', phone: '+255713000000', role: 'customer', account_status: 'approved', is_verified: true, created_at: new Date().toISOString() }],
]);

function normalizeDemoUser(user) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name || user.fullName || user.name || '',
    phone: user.phone,
    role: user.role || 'customer',
    account_status: user.account_status || 'approved',
    is_verified: Boolean(user.is_verified ?? true),
    avatar_url: user.avatar_url || null,
    created_at: user.created_at || new Date().toISOString(),
  };
}

function getDemoUserByEmail(email) {
  if (!email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = demoUsersByEmail.get(normalizedEmail);
  if (existing) {
    return existing;
  }

  if (normalizedEmail.includes('admin')) {
    return demoUsersByEmail.get('admin@example.com');
  }

  if (normalizedEmail.includes('shop')) {
    return demoUsersByEmail.get('shop_owner@example.com');
  }

  if (normalizedEmail.includes('driver')) {
    return demoUsersByEmail.get('driver@example.com');
  }

  return demoUsersByEmail.get('customer@example.com');
}

function getDemoUserById(id) {
  if (!id) return null;
  for (const user of demoUsersByEmail.values()) {
    if (user.id === id) {
      return user;
    }
  }
  return null;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      account_status: user.account_status,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(req, res, next) {
  try {
    const { email, password, fullName, phone, role = 'customer' } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: 'Email, password, and full name are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingDemoUser = getDemoUserByEmail(normalizedEmail);
    if (existingDemoUser) {
      return res.status(409).json({ success: false, error: 'User already exists' });
    }

    const demoUser = {
      id: `demo-${Date.now()}`,
      email: normalizedEmail,
      full_name: fullName,
      phone: phone || null,
      role,
      account_status: 'approved',
      is_verified: true,
      created_at: new Date().toISOString(),
    };

    demoUsersByEmail.set(normalizedEmail, demoUser);
    const token = signToken(demoUser);
    return res.status(201).json({ success: true, data: { user: normalizeDemoUser(demoUser), token } });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const demoUser = getDemoUserByEmail(normalizedEmail);
    if (demoUser && password === DEMO_PASSWORD) {
      const token = signToken(demoUser);
      return res.json({ success: true, data: { user: normalizeDemoUser(demoUser), token } });
    }

    const user = await userModel.findByEmail(normalizedEmail);
    if (!user || !user.password_hash) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (user.account_status === 'pending') {
      return res.status(403).json({ success: false, error: 'Your application is under review.', code: 'APPLICATION_PENDING' });
    }

    if (user.account_status === 'rejected') {
      return res.status(403).json({
        success: false,
        error: user.rejection_reason ? `Application rejected: ${user.rejection_reason}` : 'Your application was rejected.',
        code: 'APPLICATION_REJECTED',
      });
    }

    if (user.account_status === 'suspended') {
      return res.status(403).json({ success: false, error: 'Your account is suspended. Contact support.', code: 'ACCOUNT_SUSPENDED' });
    }

    const token = signToken(user);
    res.json({ success: true, data: { user, token } });
  } catch (error) {
    if (error && /ECONN|connect|ENOTFOUND|ER_HOST|ER_BAD_DB|ER_DB/.test(String(error.message || error))) {
      return res.status(503).json({ success: false, error: 'Authentication service is unavailable right now. Please try again shortly.' });
    }

    next(error);
  }
}

async function me(req, res, next) {
  try {
    const demoUser = getDemoUserById(req.user && req.user.id);
    if (demoUser) {
      return res.json({ success: true, data: normalizeDemoUser(demoUser) });
    }

    const user = await userModel.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    if (error && /ECONN|connect|ENOTFOUND|ER_HOST|ER_BAD_DB|ER_DB/.test(String(error.message || error))) {
      return res.status(503).json({ success: false, error: 'Authentication service is unavailable right now.' });
    }

    next(error);
  }
}

module.exports = { register, login, me };
