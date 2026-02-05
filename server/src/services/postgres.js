const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// wrapping pool.query so we dont have to pass pool around everywhere
// **** add error logging here
function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query };
