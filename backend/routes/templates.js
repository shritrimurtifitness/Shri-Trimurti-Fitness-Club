const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

// Get weekly templates for a turf
router.get('/:turf_id', authMiddleware, async (req, res) => {
  try {
    const cacheKey = `templates:${req.params.turf_id}`;

    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const result = await pool.query(
      'SELECT * FROM slot_templates WHERE turf_id = $1 ORDER BY day_of_week ASC, start_time ASC',
      [req.params.turf_id]
    );
    await cache.set(cacheKey, result.rows, 300); // 5 min
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Create a new slot template
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { turf_id, day_of_week, start_time, end_time, price } = req.body;
    const result = await pool.query(
      `INSERT INTO slot_templates (turf_id, day_of_week, start_time, end_time, price) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [turf_id, day_of_week, start_time, end_time, price]
    );

    // Delete future unbooked slots for this day of week so they regenerate
    await pool.query(`
      DELETE FROM slots 
      WHERE turf_id = $1 
      AND EXTRACT(DOW FROM date) = $2 
      AND date >= CURRENT_DATE 
      AND id NOT IN (SELECT slot_id FROM bookings WHERE status != 'cancelled')
    `, [turf_id, day_of_week]);

    await cache.del(`templates:${turf_id}`);
    await cache.delPattern('slots:*');

    req.app.get('io').emit('template_updated');
    req.app.get('io').emit('slot_updated');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update slot template
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { start_time, end_time, price } = req.body;

    const tmplRes = await pool.query('SELECT turf_id, day_of_week FROM slot_templates WHERE id = $1', [req.params.id]);
    if (tmplRes.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const { turf_id, day_of_week } = tmplRes.rows[0];

    const result = await pool.query(
      `UPDATE slot_templates SET start_time=$1, end_time=$2, price=$3 WHERE id=$4 RETURNING *`,
      [start_time, end_time, price, req.params.id]
    );

    // Regenerate slots by deleting future unbooked slots for this day
    await pool.query(`
      DELETE FROM slots 
      WHERE turf_id = $1 
      AND EXTRACT(DOW FROM date) = $2 
      AND date >= CURRENT_DATE 
      AND id NOT IN (SELECT slot_id FROM bookings WHERE status != 'cancelled')
    `, [turf_id, day_of_week]);

    await cache.delPattern('templates:*');
    await cache.delPattern('slots:*');

    req.app.get('io').emit('template_updated');
    req.app.get('io').emit('slot_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Delete slot template
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM slot_templates WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });

    const { turf_id, day_of_week } = result.rows[0];
    
    // Wipe future unbooked slots for this day so the absence of template is respected
    await pool.query(`
      DELETE FROM slots 
      WHERE turf_id = $1 
      AND EXTRACT(DOW FROM date) = $2 
      AND date >= CURRENT_DATE 
      AND id NOT IN (SELECT slot_id FROM bookings WHERE status != 'cancelled')
    `, [turf_id, day_of_week]);

    await cache.delPattern('templates:*');
    await cache.delPattern('slots:*');

    req.app.get('io').emit('template_updated');
    req.app.get('io').emit('slot_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
