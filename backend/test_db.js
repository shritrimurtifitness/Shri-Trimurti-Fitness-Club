const dotenv = require('dotenv');
dotenv.config();
const { Pool } = require('pg');
const pool = new Pool();
pool.query('SELECT * FROM tournaments').then(res => console.log('success', res.rows.length)).catch(console.error).finally(()=>pool.end());
