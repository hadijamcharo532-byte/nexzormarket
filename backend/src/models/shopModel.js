const db = require('../config/database');

async function listShops({ ownerId, activeOnly = true } = {}) {
  let query = 'SELECT * FROM shops';
  const values = [];
  const conditions = [];

  if (ownerId) {
    conditions.push('owner_id = ?');
    values.push(ownerId);
  }

  if (activeOnly) {
    conditions.push('is_active = true');
  }

  if (conditions.length) {
    query += ` WHERE ${conditions.join(' AND ')}`;
  }

  query += ' ORDER BY created_at DESC';
  const result = await db.query(query, values);
  return result.rows;
}

async function findById(id) {
  const result = await db.query('SELECT * FROM shops WHERE id = ?', [id]);
  return result.rows[0] || null;
}

async function createShop({ ownerId, name, description, address, latitude, longitude, licenseNumber, tinNumber }) {
  const insertResult = await db.query(
    `INSERT INTO shops (owner_id, name, description, address, latitude, longitude, license_number, tin_number)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [ownerId, name, description || null, address, latitude || null, longitude || null, licenseNumber || null, tinNumber || null]
  );

  const result = await db.query('SELECT * FROM shops WHERE id = ?', [insertResult.insertId]);
  return result.rows[0] || null;
}

async function updateShop(id, updates) {
  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!fields.length) return null;

  const setClauses = fields.map(([key]) => `${key} = ?`).join(', ');
  const values = fields.map(([, value]) => value);
  await db.query(
    `UPDATE shops SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
    [...values, id]
  );

  const result = await db.query('SELECT * FROM shops WHERE id = ?', [id]);
  return result.rows[0] || null;
}

module.exports = { listShops, findById, createShop, updateShop };
