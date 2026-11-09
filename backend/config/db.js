const { Pool } = require('pg');
require('dotenv').config();

// Cloud-optimized connection pool for Neon/Serverless
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,           // Neon free tier supports limited connections
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 10000, 
  ssl: {
    rejectUnauthorized: false // Required for Neon connection strings
  }
});

// Basic error logging for the pool
pool.on('error', (err) => {
  console.error('[DB POOL ERROR] Unexpected error on idle client', err);
});

module.exports = pool;
