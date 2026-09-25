const db = require('../config/database');

async function createNotification({ userId, type, title, message }) {
  const insertResult = await db.query(
    `INSERT INTO notifications (user_id, type, title, message, is_read)
     VALUES (?, ?, ?, ?, 0)`,
    [userId, type || 'system', title, message]
  );

  const result = await db.query('SELECT * FROM notifications WHERE id = ?', [insertResult.insertId]);
  return result.rows[0] || null;
}

async function listNotificationsForUser(userId) {
  const result = await db.query(
    `SELECT id, user_id, type, title, message, is_read, created_at
     FROM notifications
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

module.exports = {
  createNotification,
  listNotificationsForUser,
};
