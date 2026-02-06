require('dotenv').config();

const bcrypt = require('bcrypt');
const { query, pool } = require('../src/services/postgres');

async function run() {
  // pass args to override
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'password123';

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await query(
    'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, true) ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash RETURNING id',
    [username, passwordHash]
  );

  const userId = result.rows[0].id;
  await query(
    'INSERT INTO user_collections (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id, name) DO NOTHING',
    [userId, 'Admin Collection']
  );

  console.log(`Seeded admin user: ${username}`);
  await pool.end();
}

run().catch(function onError(err) {
  console.error(err);
  process.exit(1);
});
