const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token version for global logout support
    const userResult = await pool.query(
      'SELECT token_version FROM users WHERE id = $1',
      [decoded.id]
    );

    // Fallback for legacy tokens (default to 1)
    const tokenVersion = decoded.token_version || 1;

    if (userResult.rows.length === 0 || userResult.rows[0].token_version !== tokenVersion) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = authMiddleware;
