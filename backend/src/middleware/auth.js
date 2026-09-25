const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const userModel = require('../models/userModel');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, error: 'Authentication token is required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

function authorize(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    next();
  };
}

async function requireApprovedAccount(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const dbUser = await userModel.findById(req.user.id);
    if (!dbUser) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }

    if (dbUser.account_status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: `Account status is ${dbUser.account_status}. Access denied.`,
        code: 'ACCOUNT_NOT_APPROVED',
      });
    }

    req.user.account_status = dbUser.account_status;
    return next();
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Unable to validate account status' });
  }
}

module.exports = { authenticate, authorize, requireApprovedAccount };
