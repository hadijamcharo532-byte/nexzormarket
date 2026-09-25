const db = require('../config/database');

const ROLE_ID_MAP = {
  customer: 1,
  shop_owner: 2,
  driver: 3,
  admin: 4,
};

function normalizeRole(roleId) {
  switch (Number(roleId)) {
    case 2:
      return 'shop_owner';
    case 3:
      return 'driver';
    case 4:
      return 'admin';
    case 1:
    default:
      return 'customer';
  }
}

function normalizeUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    full_name: row.full_name,
    role: normalizeRole(row.role_id),
    is_verified: Boolean(row.is_verified),
    account_status: row.account_status || 'approved',
    rejection_reason: row.rejection_reason || null,
    password_hash: row.password_hash,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function findByEmail(email) {
  const result = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  return normalizeUser(result.rows[0] || null);
}

async function findById(id) {
  const result = await db.query('SELECT * FROM users WHERE id = ?', [id]);
  return normalizeUser(result.rows[0] || null);
}

async function createUser({ email, fullName, passwordHash, phone, role = 'customer' }) {
  const roleId = ROLE_ID_MAP[role] || ROLE_ID_MAP.customer;
  const insertResult = await db.query(
    `INSERT INTO users (email, phone, full_name, password_hash, role_id, is_verified, account_status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [email, phone || null, fullName, passwordHash, roleId, false, role === 'customer' ? 'approved' : 'pending']
  );

  const result = await db.query(
    'SELECT id, email, phone, full_name, role_id, is_verified, account_status, rejection_reason, avatar_url, created_at, updated_at FROM users WHERE id = ?',
    [insertResult.insertId]
  );

  return normalizeUser(result.rows[0] || null);
}

async function listUsers() {
  const result = await db.query(
    'SELECT id, email, phone, full_name, role_id, is_verified, account_status, rejection_reason, avatar_url, created_at FROM users ORDER BY created_at DESC'
  );
  return result.rows.map(normalizeUser);
}

async function updateUser(id, updates) {
  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!fields.length) return null;

  const setClauses = fields.map(([key]) => `${key} = ?`).join(', ');
  const values = fields.map(([, value]) => value);
  await db.query(
    `UPDATE users SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
    [ ...values, id ]
  );

  const result = await db.query(
    'SELECT id, email, phone, full_name, role_id, is_verified, account_status, rejection_reason, avatar_url, created_at, updated_at FROM users WHERE id = ?',
    [id]
  );

  return normalizeUser(result.rows[0] || null);
}

async function updateUserStatus(id, status, rejectionReason = null) {
  await db.query(
    'UPDATE users SET account_status = ?, rejection_reason = ?, updated_at = NOW() WHERE id = ?',
    [status, rejectionReason, id]
  );

  return findById(id);
}

module.exports = { findByEmail, findById, createUser, listUsers, updateUser, updateUserStatus };
