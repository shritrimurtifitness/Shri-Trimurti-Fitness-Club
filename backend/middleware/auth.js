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
      'SELECT token_version, role FROM users WHERE id = $1',
      [decoded.id]
    );

    // Fallback for legacy tokens (default to 1)
    const tokenVersion = decoded.token_version || 1;

    if (userResult.rows.length === 0 || userResult.rows[0].token_version !== tokenVersion) {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = {
      ...decoded,
      role: userResult.rows[0].role || decoded.role,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }
    res.status(401).json({ error: 'Invalid or expired token. Please login again.' });
  }
}

/**
 * Optional authentication middleware:
 * If an Authorization header with Bearer token is provided, it verifies the token and populates req.user.
 * If no token is provided or invalid, it does not fail—it simply proceeds with req.user undefined.
 */
async function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userResult = await pool.query(
      'SELECT token_version, role FROM users WHERE id = $1',
      [decoded.id]
    );
    const tokenVersion = decoded.token_version || 1;
    if (userResult.rows.length > 0 && userResult.rows[0].token_version === tokenVersion) {
      req.user = {
        ...decoded,
        role: userResult.rows[0].role || decoded.role,
      };
    }
  } catch (err) {
    // Ignore invalid/expired token in optional mode
  }
  next();
}

authMiddleware.optional = optionalAuth;

module.exports = authMiddleware;
