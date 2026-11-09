const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');

// Admin-only guard
function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// GET /staff - List all staff
router.get('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, allowed_tabs, (pin_hash IS NOT NULL) as has_pin, created_at FROM users WHERE role = 'staff' ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /staff - Create staff account
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, pin, allowed_tabs } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already in use' });

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHashValue = pin ? await bcrypt.hash(pin, 10) : null;
    const result = await pool.query(
      `INSERT INTO users (name, email, phone, password_hash, pin_hash, role, allowed_tabs) VALUES ($1, $2, $3, $4, $5, 'staff', $6) RETURNING id, name, email, phone, allowed_tabs, created_at`,
      [name, email, phone || '', passwordHash, pinHashValue, allowed_tabs || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PATCH /staff/:id - Update staff
router.patch('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { name, email, phone, password, pin, allowed_tabs } = req.body;
    const { id } = req.params;

    // Verify it's a staff user
    const check = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [id, 'staff']);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });

    // Build dynamic update
    const updates = [];
    const values = [];
    let idx = 1;

    if (name) { updates.push(`name = $${idx++}`); values.push(name); }
    if (email) { updates.push(`email = $${idx++}`); values.push(email); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); values.push(phone); }
    if (allowed_tabs) { updates.push(`allowed_tabs = $${idx++}`); values.push(allowed_tabs); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
    }
    if (pin) {
      if (!/^\d{6}$/.test(pin)) return res.status(400).json({ error: 'PIN must be exactly 6 digits' });
      const hash = await bcrypt.hash(pin, 10);
      updates.push(`pin_hash = $${idx++}`);
      values.push(hash);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, phone, allowed_tabs`,
      values
    );

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// DELETE /staff/:id - Delete staff account
router.delete('/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM users WHERE id = $1 AND role = $2 RETURNING id', [id, 'staff']);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff not found' });
    res.json({ message: 'Staff account deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
