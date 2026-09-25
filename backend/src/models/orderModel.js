const db = require('../config/database');

async function listOrders({ customerId, shopId, driverId } = {}) {
  let query = 'SELECT * FROM orders';
  const values = [];
  const conditions = [];

  if (customerId) {
    conditions.push('customer_id = ?');
    values.push(customerId);
  }

  if (shopId) {
    conditions.push('shop_id = ?');
    values.push(shopId);
  }

  if (driverId) {
    conditions.push('driver_id = ?');
    values.push(driverId);
  }

  if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, values);
  return result.rows;
}

async function findById(id) {
  const result = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
  return result.rows[0] || null;
}

async function createOrder(payload) {
  const insertResult = await db.query(
    `INSERT INTO orders (
      customer_id, shop_id, driver_id, status, items, subtotal, delivery_fee, total_amount,
      delivery_address, delivery_latitude, delivery_longitude, pickup_address, pickup_latitude,
      pickup_longitude, payment_status, delivery_notes, estimated_delivery, vehicle_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      payload.customerId,
      payload.shopId,
      payload.driverId || null,
      payload.status || 'pending',
      payload.items || [],
      payload.subtotal,
      payload.deliveryFee || 0,
      payload.totalAmount,
      payload.deliveryAddress,
      payload.deliveryLatitude || null,
      payload.deliveryLongitude || null,
      payload.pickupAddress || null,
      payload.pickupLatitude || null,
      payload.pickupLongitude || null,
      payload.paymentStatus || 'pending',
      payload.deliveryNotes || null,
      payload.estimatedDelivery || null,
      payload.vehicleType || null,
    ]
  );

  const result = await db.query('SELECT * FROM orders WHERE id = ?', [insertResult.insertId]);
  return result.rows[0] || null;
}

async function updateOrder(id, updates) {
  const fields = Object.entries(updates).filter(([, value]) => value !== undefined);
  if (!fields.length) return null;

  const setClauses = fields.map(([key]) => `${key} = ?`).join(', ');
  const values = fields.map(([, value]) => value);
  await db.query(
    `UPDATE orders SET ${setClauses}, updated_at = NOW() WHERE id = ?`,
    [...values, id]
  );

  const result = await db.query('SELECT * FROM orders WHERE id = ?', [id]);
  return result.rows[0] || null;
}

module.exports = { listOrders, findById, createOrder, updateOrder };
