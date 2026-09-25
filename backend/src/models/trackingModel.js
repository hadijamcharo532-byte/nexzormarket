const db = require('../config/database');

async function listLocations({ driverId, orderId } = {}) {
  let query = 'SELECT * FROM driver_locations';
  const values = [];
  const conditions = [];

  if (driverId) {
    conditions.push('driver_id = ?');
    values.push(driverId);
  }

  if (orderId) {
    conditions.push('order_id = ?');
    values.push(orderId);
  }

  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, values);
  return result.rows;
}

async function createLocation(payload) {
  const insertResult = await db.query(
    `INSERT INTO driver_locations (driver_id, order_id, latitude, longitude, heading, speed)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [payload.driverId, payload.orderId || null, payload.latitude, payload.longitude, payload.heading || null, payload.speed || null]
  );

  const result = await db.query('SELECT * FROM driver_locations WHERE id = ?', [insertResult.insertId]);
  return result.rows[0] || null;
}

module.exports = { listLocations, createLocation };
