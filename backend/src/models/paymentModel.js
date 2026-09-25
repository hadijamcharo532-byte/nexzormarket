const db = require('../config/database');

async function listPayments({ orderId, customerId, sellerId } = {}) {
  let query = 'SELECT * FROM payments';
  const values = [];
  const conditions = [];

  if (orderId) {
    conditions.push('order_id = ?');
    values.push(orderId);
  }

  if (customerId) {
    conditions.push('customer_id = ?');
    values.push(customerId);
  }

  if (sellerId) {
    conditions.push('seller_id = ?');
    values.push(sellerId);
  }

  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, values);
  return result.rows;
}

async function createPayment(payload) {
  const insertResult = await db.query(
    `INSERT INTO payments (order_id, customer_id, seller_id, amount, status, payment_method, transaction_ref)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [payload.orderId, payload.customerId, payload.sellerId, payload.amount, payload.status || 'pending', payload.paymentMethod || null, payload.transactionRef || null]
  );

  const result = await db.query('SELECT * FROM payments WHERE id = ?', [insertResult.insertId]);
  return result.rows[0] || null;
}

async function updatePayment(id, updates) {
  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!fields.length) return null;

  const setClauses = fields.map(([key]) => `${key} = ?`).join(', ');
  const values = fields.map(([, value]) => value);
  await db.query(
    `UPDATE payments SET ${setClauses} WHERE id = ?`,
    [...values, id]
  );

  const result = await db.query('SELECT * FROM payments WHERE id = ?', [id]);
  return result.rows[0] || null;
}

module.exports = { listPayments, createPayment, updatePayment };
