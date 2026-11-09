const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

// Public: Get all pricing plans (for landing page)
router.get('/', async (req, res) => {
  try {
    if (!cache.shouldBypass(req)) {
      const cached = await cache.get('pricing:all');
      if (cached) return res.json(cached);
    }

    const result = await pool.query('SELECT * FROM pricing_plans ORDER BY sort_order ASC, created_at ASC');
    await cache.set('pricing:all', result.rows, 600); // 10 min
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Create a new plan
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, subtitle, price, unit, features, popular, facility, sort_order } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'name and price required' });

    // If marking as popular, unmark all others
    if (popular) {
      await pool.query('UPDATE pricing_plans SET popular = false');
    }

    const result = await pool.query(
      `INSERT INTO pricing_plans (name, subtitle, price, unit, features, popular, facility, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, subtitle || '', price, unit || '/hour', features || [], popular || false, facility || '', sort_order || 0]
    );

    await cache.del('pricing:all');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Update a plan
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, subtitle, price, unit, features, popular, facility, sort_order } = req.body;

    // If marking as popular, unmark all others first
    if (popular) {
      await pool.query('UPDATE pricing_plans SET popular = false');
    }

    const result = await pool.query(
      `UPDATE pricing_plans SET 
        name = COALESCE($1, name), subtitle = COALESCE($2, subtitle), price = COALESCE($3, price),
        unit = COALESCE($4, unit), features = COALESCE($5, features), popular = COALESCE($6, popular),
        facility = COALESCE($7, facility), sort_order = COALESCE($8, sort_order)
       WHERE id = $9 RETURNING *`,
      [name, subtitle, price, unit, features, popular, facility, sort_order, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    await cache.del('pricing:all');

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Toggle popular
router.patch('/:id/popular', authMiddleware, async (req, res) => {
  try {
    // Unmark all, then mark this one
    await pool.query('UPDATE pricing_plans SET popular = false');
    const result = await pool.query('UPDATE pricing_plans SET popular = true WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    await cache.del('pricing:all');

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Delete a plan
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM pricing_plans WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

    await cache.del('pricing:all');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
