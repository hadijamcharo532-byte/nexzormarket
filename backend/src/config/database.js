const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'cargo_swift',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function connectDB() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Database connected successfully');
    return true;
  } catch (error) {
    console.error('Database connection error:', error.message);
    throw error;
  }
}

async function query(text, params = []) {
  const [rows] = await pool.query(text, params);

  if (Array.isArray(rows)) {
    return { rows };
  }

  return {
    rows: [],
    insertId: rows && typeof rows === 'object' ? rows.insertId : null,
    affectedRows: rows && typeof rows === 'object' ? rows.affectedRows : null,
    changedRows: rows && typeof rows === 'object' ? rows.changedRows : null,
  };
}

module.exports = {
  query,
  pool,
  connectDB,
};
