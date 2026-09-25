const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const DEFAULT_ACCOUNTS = [
  {
    email: 'admin@example.com',
    password: 'Admin@123',
    fullName: 'Admin User',
    role: 'admin',
    phone: '+255700000001',
  },
  {
    email: 'shopowner@example.com',
    password: 'Shop@123',
    fullName: 'Shop Owner User',
    role: 'shop_owner',
    phone: '+255700000002',
  },
  {
    email: 'customer@example.com',
    password: 'Customer@123',
    fullName: 'Customer User',
    role: 'customer',
    phone: '+255700000003',
  },
  {
    email: 'driver@example.com',
    password: 'Driver@123',
    fullName: 'Driver User',
    role: 'driver',
    phone: '+255700000004',
  },
];

const ROLE_ID_MAP = {
  customer: 1,
  shop_owner: 2,
  driver: 3,
  admin: 4,
};

async function seedAuthData() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'cargo_swift',
  });

  try {
    for (const account of DEFAULT_ACCOUNTS) {
      const existing = await connection.query('SELECT id FROM users WHERE email = ?', [account.email]);
      if (existing[0].length) {
        console.log(`User already exists: ${account.email}`);
        continue;
      }

      const passwordHash = await bcrypt.hash(account.password, 10);
      await connection.query(
        `INSERT INTO users (email, phone, full_name, password_hash, role_id, is_verified, is_active, email_verified, phone_verified)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [account.email, account.phone, account.fullName, passwordHash, ROLE_ID_MAP[account.role], 1, 1, 1, 1]
      );
      console.log(`Seeded ${account.role}: ${account.email}`);
    }
  } finally {
    await connection.end();
  }
}

seedAuthData().catch((error) => {
  console.error('Seed auth data failed:', error);
  process.exit(1);
});
