const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

// GET /api/admin/closures - List upcoming closures
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, date::text, reason, turf_id FROM arena_closures WHERE date >= CURRENT_DATE ORDER BY date ASC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/closures - Create a closure
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { date, reason, turf_id } = req.body;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    // Validate date format
    if (isNaN(new Date(date).getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // 1. Insert closure
    await pool.query(
      'INSERT INTO arena_closures (date, reason, turf_id) VALUES ($1, $2, $3) ON CONFLICT (date) DO UPDATE SET reason = $2, turf_id = $3',
      [date, reason || 'Arena closed for maintenance', turf_id || null]
    );

    // 2. Clear existing slots for that day (since they are now invalid)
    await pool.query('DELETE FROM slots WHERE date = $1', [date]);

    // 3. Clear cache
    await cache.delPattern('slots:*');

    req.app.get('io').emit('slot_updated');
    res.status(201).json({ message: 'Arena closed for the specified date' });
  } catch (err) {
    console.error('Closure error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/closures/:id - Re-open arena
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM arena_closures WHERE id = $1 RETURNING date', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Closure record not found' });
    }

    // Slots will be re-generated automatically by JIT logic when next requested
    await cache.delPattern('slots:*');
    req.app.get('io').emit('slot_updated');

    res.json({ message: 'Arena re-opened successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
