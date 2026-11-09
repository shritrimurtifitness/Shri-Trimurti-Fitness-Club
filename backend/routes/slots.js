const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

router.get('/', async (req, res) => {
  try {
    const { date, facility_type, turf_id } = req.query;
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const cacheKey = `slots:${date}:${facility_type || 'all'}:${turf_id || 'all'}`;

    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    // JIT: Auto-generate missing slots for ALL active turfs before fetching!
    // Check for global closure first
    const closureCheck = await pool.query('SELECT reason FROM arena_closures WHERE date = $1 AND turf_id IS NULL', [date]);
    if (closureCheck.rows.length > 0) {
      return res.json({ 
        is_closed: true, 
        reason: closureCheck.rows[0].reason,
        slots: [] 
      });
    }

    await pool.query('SELECT generate_daily_slots($1, id) FROM turfs WHERE is_active = true', [date]);

    let query = `
      SELECT s.*, 
        CASE 
          WHEN b.id IS NOT NULL THEN false 
          WHEN t.physical_resource_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM slots s2
            JOIN bookings b2 ON b2.slot_id = s2.id AND b2.status NOT IN ('cancelled', 'rejected')
            JOIN turfs t2 ON s2.turf_id = t2.id
            WHERE t2.physical_resource_id = t.physical_resource_id
            AND s2.date = s.date
            AND s2.start_time = s.start_time
            AND s2.id != s.id
          ) THEN false
          WHEN EXISTS (
            SELECT 1 FROM table_sessions ts 
            WHERE ts.turf_id = s.turf_id 
            AND ts.status = 'running'
            AND ts.table_number = s.table_number
            AND ts.start_time < (s.date + s.end_time)
          ) THEN false
          ELSE s.is_available 
        END as is_available,
        t.facility_type, t.name as facility_name, t.min_booking_amount, t.is_active as facility_is_active,
        u.name as user_name, u.phone, b.payment_status,
        CASE 
          WHEN b.id IS NOT NULL THEN true 
          WHEN t.physical_resource_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM slots s2
            JOIN bookings b2 ON b2.slot_id = s2.id AND b2.status NOT IN ('cancelled', 'rejected')
            JOIN turfs t2 ON s2.turf_id = t2.id
            WHERE t2.physical_resource_id = t.physical_resource_id
            AND s2.date = s.date
            AND s2.start_time = s.start_time
            AND s2.id != s.id
          ) THEN true
          WHEN EXISTS (
            SELECT 1 FROM table_sessions ts 
            WHERE ts.turf_id = s.turf_id 
            AND ts.status = 'running'
            AND ts.table_number = s.table_number
            AND ts.start_time < (s.date + s.end_time)
          ) THEN true
          ELSE false 
        END as is_booked,
        (
            SELECT t2.name FROM slots s2
            JOIN bookings b2 ON b2.slot_id = s2.id AND b2.status NOT IN ('cancelled', 'rejected')
            JOIN turfs t2 ON s2.turf_id = t2.id
            WHERE t.physical_resource_id IS NOT NULL 
            AND t2.physical_resource_id = t.physical_resource_id
            AND s2.date = s.date
            AND s2.start_time = s.start_time
            AND s2.id != s.id
            LIMIT 1
        ) as shared_booking_facility
       FROM slots s
       JOIN turfs t ON s.turf_id = t.id
       LEFT JOIN bookings b ON b.slot_id = s.id AND b.status NOT IN ('cancelled', 'rejected')
       LEFT JOIN users u ON b.user_id = u.id
       WHERE s.date = $1
    `;
    const params = [date];
    
    if (req.query.all !== 'true') {
      query += ` AND t.is_active = true`;
    }
    if (facility_type) {
      params.push(facility_type);
      query += ` AND t.facility_type = $${params.length}`;
    }
    if (turf_id) {
      params.push(turf_id);
      query += ` AND s.turf_id = $${params.length}`;
    }
    
    query += ` ORDER BY s.start_time`;

    const result = await pool.query(query, params);
    await cache.set(cacheKey, result.rows, 60); // 60 sec
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE slots SET is_available = NOT is_available WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });

    await cache.delPattern('slots:*');

    req.app.get('io').emit('slot_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create custom slot
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { turf_id, date, start_time, end_time, price, is_available } = req.body;
    const result = await pool.query(
      `INSERT INTO slots (turf_id, date, start_time, end_time, price, is_available) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [turf_id, date, start_time, end_time, price, is_available ?? true]
    );

    await cache.delPattern('slots:*');

    req.app.get('io').emit('slot_updated');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update slot details
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { start_time, end_time, price } = req.body;
    const result = await pool.query(
      `UPDATE slots SET start_time=$1, end_time=$2, price=$3 WHERE id=$4 RETURNING *`,
      [start_time, end_time, price, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });

    await cache.delPattern('slots:*');

    req.app.get('io').emit('slot_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Delete slot
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM slots WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Slot not found' });

    await cache.delPattern('slots:*');

    req.app.get('io').emit('slot_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
