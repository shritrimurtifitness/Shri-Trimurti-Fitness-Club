const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');
const { reviewLimiter } = require('../middleware/rateLimiter');

// Public: Get approved testimonials
router.get('/', async (req, res) => {
  try {
    if (!cache.shouldBypass(req)) {
      const cached = await cache.get('testimonials:approved');
      if (cached) return res.json(cached);
    }

    const result = await pool.query(
      'SELECT * FROM (SELECT * FROM testimonials WHERE status = $1 ORDER BY rating DESC, is_featured DESC, created_at DESC LIMIT 12) AS top_reviews ORDER BY RANDOM()',
      ['approved']
    );

    await cache.set('testimonials:approved', result.rows, 600); // 10 min
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Get all testimonials (for moderation)
router.get('/admin', authMiddleware, async (req, res) => {
  try {
    if (!cache.shouldBypass(req)) {
      const cached = await cache.get('testimonials:admin');
      if (cached) return res.json(cached);
    }

    const { status } = req.query;
    let query = 'SELECT * FROM testimonials WHERE 1=1';
    const params = [];
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);
    await cache.set('testimonials:admin', result.rows, 120); // 2 min
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Submit a review (text only)
router.post('/', reviewLimiter, async (req, res) => {
  try {
    const { name, role, text, rating } = req.body;
    if (!name || !text || !rating) {
      return res.status(400).json({ error: 'Name, text, and rating are required' });
    }

    const result = await pool.query(
      `INSERT INTO testimonials (name, role, text, rating, status, source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, role || '', text, Number(rating), 'pending', 'internal']
    );

    await cache.del('testimonials:admin');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Update status (approve/reject)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE testimonials SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await cache.del('testimonials:approved');
    await cache.del('testimonials:admin');

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Toggle featured
router.patch('/:id/feature', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE testimonials SET is_featured = NOT is_featured WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await cache.del('testimonials:approved');
    await cache.del('testimonials:admin');

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Delete testimonial
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM testimonials WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });

    await cache.del('testimonials:approved');
    await cache.del('testimonials:admin');

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Add a review manually (e.g. from Google)
router.post('/admin', authMiddleware, async (req, res) => {
  try {
    const { name, role, text, rating, status, source } = req.body;
    const result = await pool.query(
      `INSERT INTO testimonials (name, role, text, rating, status, source)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, role || '', text, Number(rating), status || 'approved', source || 'google']
    );

    await cache.del('testimonials:approved');
    await cache.del('testimonials:admin');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
