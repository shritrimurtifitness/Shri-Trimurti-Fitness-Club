const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');

const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'shri-trimurti-sports-arena/facilities',
    allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
  },
});
const upload = multer({ storage: storage });

// Admin: Upload Facility Image
router.post('/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    res.json({ secure_url: req.file.path });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed: ' + err.message });
  }
});

async function invalidateFacilitiesCache() {
  try {
    await cache.del('facilities:all');
    await cache.del('facilities:active');
    await cache.del('facilities:all_admin');
    await cache.delPattern('facilities:tables:*');
  } catch (err) {
    console.warn('[CACHE] Error invalidating facilities cache:', err.message);
  }
}

// Admin: Update facility image
router.patch('/:id/image', authMiddleware, async (req, res) => {
  try {
    const { image_url } = req.body;
    if (!image_url) return res.status(400).json({ error: 'image_url required' });
    const result = await pool.query('UPDATE turfs SET image_url = $1 WHERE id = $2 RETURNING *', [image_url, req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    await invalidateFacilitiesCache();
    req.app.get('io').emit('facility_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Toggle or set facility active status
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const hasExplicitStatus = typeof body.is_active === 'boolean';

    const query = hasExplicitStatus
      ? 'UPDATE turfs SET is_active = $1 WHERE id = $2 RETURNING *'
      : 'UPDATE turfs SET is_active = NOT COALESCE(is_active, true) WHERE id = $1 RETURNING *';

    const params = hasExplicitStatus ? [body.is_active, id] : [id];
    const result = await pool.query(query, params);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');

    req.app.get('io').emit('facility_updated');
    req.app.get('io').emit('slot_updated');
    req.app.get('io').emit('booking_updated');

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Public: Get all active facilities (or all if ?all=true for admin)
router.get('/', async (req, res) => {
  try {
    const showAll = req.query.all === 'true';
    const cacheKey = showAll ? 'facilities:all_admin' : 'facilities:active';

    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const query = showAll
      ? 'SELECT * FROM turfs ORDER BY created_at ASC'
      : 'SELECT * FROM turfs WHERE is_active = true ORDER BY created_at ASC';

    const result = await pool.query(query);
    await cache.set(cacheKey, result.rows, 300); // 5 min
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public: Get live table status for snooker/pool (user booking page)
router.get('/tables-status/:facility_type', async (req, res) => {
  try {
    const { facility_type } = req.params;
    const cacheKey = `facilities:tables:${facility_type}`;

    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const { rows: facilities } = await pool.query(
      'SELECT id, name, facility_type, weekday_day_price, table_count FROM turfs WHERE facility_type = $1 AND is_active = true',
      [facility_type]
    );
    const facilityIds = facilities.map(f => f.id);
    let runningSessions = [];
    if (facilityIds.length > 0) {
      const { rows } = await pool.query(
        `SELECT turf_id, name FROM table_sessions WHERE status = 'running' AND turf_id = ANY($1)`,
        [facilityIds]
      );
      runningSessions = rows;
    }
    const result = facilities.map(f => {
      const count = f.table_count || 1;
      const tables = [];
      for (let i = 1; i <= count; i++) {
        const tableName = `${f.name} #${i}`;
        const isOccupied = runningSessions.some(s => s.name === tableName && s.turf_id === f.id);
        tables.push({
          number: i,
          name: tableName,
          status: isOccupied ? 'occupied' : 'available',
        });
      }
      return {
        id: f.id,
        name: f.name,
        facility_type: f.facility_type,
        hourly_rate: f.weekday_day_price,
        table_count: count,
        tables,
      };
    });
    await cache.set(cacheKey, result, 30); // 30 sec - real-time data
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Add a new facility
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { 
      facility_type, description, location, 
      weekday_day_price, weekday_night_price, 
      weekend_day_price, weekend_night_price, 
      table_count, opening_hour, closing_hour,
      min_booking_amount, pricing_model
    } = req.body;
    if (!facility_type) return res.status(400).json({ error: 'facility_type required' });

    const generatedName = facility_type.charAt(0).toUpperCase() + facility_type.slice(1);

    const result = await pool.query(
      `INSERT INTO turfs (name, facility_type, description, location, weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price, table_count, opening_hour, closing_hour, min_booking_amount, pricing_model) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [
        generatedName, facility_type, description, location || 'Dynamic Arena', 
        weekday_day_price || 800, weekday_night_price || 1000, 
        weekend_day_price || 1000, weekend_night_price || 1200, 
        table_count || 1, opening_hour || 8, closing_hour || 23,
        min_booking_amount || 0, pricing_model || 'slot'
      ]
    );

    const t = result.rows[0];

    // IMMEDIATELY initialize weekly master templates for the new facility based on the custom hours
    const insertValues = [];
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6;
      for (let hour = Number(t.opening_hour); hour < Number(t.closing_hour); hour++) {
        let price = isWeekend ? t.weekend_day_price : t.weekday_day_price;
        if (hour >= 18) price = isWeekend ? t.weekend_night_price : t.weekday_night_price;
        insertValues.push(`('${t.id}', ${day}, '${String(hour).padStart(2, '0')}:00:00', '${String(hour+1).padStart(2, '0')}:00:00', ${price})`);
      }
    }
    
    if (insertValues.length > 0) {
      await pool.query(`INSERT INTO slot_templates (turf_id, day_of_week, start_time, end_time, price) VALUES ${insertValues.join(',')} ON CONFLICT DO NOTHING`);
    }

    // Invalidate caches
    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');
    await cache.delPattern('templates:*');

    req.app.get('io').emit('facility_updated');
    req.app.get('io').emit('template_updated');
    req.app.get('io').emit('slot_updated');
    res.status(201).json(t);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Update table count with Safety Lock
router.patch('/:id/tables', authMiddleware, async (req, res) => {
  try {
    const { table_count } = req.body;
    const { id } = req.params;
    if (!table_count || table_count < 1) return res.status(400).json({ error: 'table_count must be at least 1' });

    // SAFETY LOCK: Check if there are any active future bookings on tables that would be removed
    const conflictRes = await pool.query(`
      SELECT b.id, s.date, s.start_time, s.table_number
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE s.turf_id = $1 
      AND s.table_number > $2 
      AND s.date >= CURRENT_DATE 
      AND b.status != 'cancelled'
    `, [id, table_count]);

    if (conflictRes.rows.length > 0) {
      const first = conflictRes.rows[0];
      return res.status(400).json({ 
        error: `Cannot reduce tables to ${table_count}. Table #${first.table_number} already has an active booking on ${first.date.toLocaleDateString()}.` 
      });
    }

    const result = await pool.query('UPDATE turfs SET table_count = $1 WHERE id = $2 RETURNING *', [table_count, id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    // Invalidate caches
    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');

    req.app.get('io').emit('facility_updated');
    req.app.get('io').emit('slot_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Update opening/closing hours
router.patch('/:id/hours', authMiddleware, async (req, res) => {
  try {
    const { opening_hour, closing_hour } = req.body;
    if (opening_hour == null || closing_hour == null) return res.status(400).json({ error: 'opening_hour and closing_hour required' });
    if (opening_hour < 0 || closing_hour > 24 || opening_hour >= closing_hour) return res.status(400).json({ error: 'Invalid hours range' });

    const turfRes = await pool.query('UPDATE turfs SET opening_hour = $1, closing_hour = $2 WHERE id = $3 RETURNING *', [opening_hour, closing_hour, req.params.id]);
    const t = turfRes.rows[0];

    // Delete unbooked slots that now fall outside the new range
    await pool.query(`
      DELETE FROM slots 
      WHERE turf_id = $1 
      AND id NOT IN (SELECT slot_id FROM bookings WHERE status != 'cancelled')
      AND (EXTRACT(HOUR FROM start_time) < $2 OR EXTRACT(HOUR FROM start_time) >= $3)
    `, [req.params.id, opening_hour, closing_hour]);

    // Also delete out-of-bounds weekly templates
    await pool.query(`
      DELETE FROM slot_templates 
      WHERE turf_id = $1 
      AND (EXTRACT(HOUR FROM start_time) < $2 OR EXTRACT(HOUR FROM start_time) >= $3)
    `, [req.params.id, opening_hour, closing_hour]);

    // Backfill any newly expanded hours into the slot_templates (respecting existing customizations)
    const insertValues = [];
    for (let day = 0; day <= 6; day++) {
      const isWeekend = day === 0 || day === 6;
      for (let hour = Number(opening_hour); hour < Number(closing_hour); hour++) {
        let price = isWeekend ? t.weekend_day_price : t.weekday_day_price;
        if (hour >= 18) price = isWeekend ? t.weekend_night_price : t.weekday_night_price;
        insertValues.push(`('${req.params.id}', ${day}, '${String(hour).padStart(2, '0')}:00:00', '${String(hour+1).padStart(2, '0')}:00:00', ${price})`);
      }
    }
    
    if (insertValues.length > 0) {
      await pool.query(`INSERT INTO slot_templates (turf_id, day_of_week, start_time, end_time, price) VALUES ${insertValues.join(',')} ON CONFLICT DO NOTHING`);
    }

    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');
    await cache.delPattern('templates:*');

    req.app.get('io').emit('facility_updated');
    req.app.get('io').emit('slot_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update specific facility pricing and retroactively sweep slots
router.patch('/:id/pricing', authMiddleware, async (req, res) => {
  try {
    const { 
      weekday_day_price, weekday_night_price, 
      weekend_day_price, weekend_night_price,
      min_booking_amount
    } = req.body;
    
    await pool.query(
      'UPDATE turfs SET weekday_day_price=$1, weekday_night_price=$2, weekend_day_price=$3, weekend_night_price=$4, min_booking_amount=$5 WHERE id=$6',
      [weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price, min_booking_amount || 0, req.params.id]
    );

    // Retroactively update all slots belonging to this turf that ARE NOT yet booked!
    await pool.query(`
      UPDATE slots 
      SET price = CASE 
        WHEN EXTRACT(DOW FROM date) IN (0, 6) THEN 
          CASE WHEN EXTRACT(HOUR FROM start_time) >= 18 THEN $4::numeric ELSE $3::numeric END
        ELSE 
          CASE WHEN EXTRACT(HOUR FROM start_time) >= 18 THEN $2::numeric ELSE $1::numeric END
      END
      WHERE turf_id = $5 
      AND id NOT IN (SELECT slot_id FROM bookings)
    `, [weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price, req.params.id]);

    // Apply to templates
    await pool.query(`
      UPDATE slot_templates 
      SET price = CASE 
        WHEN day_of_week IN (0, 6) THEN 
          CASE WHEN EXTRACT(HOUR FROM start_time) >= 18 THEN $4::numeric ELSE $3::numeric END
        ELSE 
          CASE WHEN EXTRACT(HOUR FROM start_time) >= 18 THEN $2::numeric ELSE $1::numeric END
      END
      WHERE turf_id = $5
    `, [weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price, req.params.id]);

    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');
    await cache.delPattern('templates:*');

    req.app.get('io').emit('facility_updated');
    req.app.get('io').emit('slot_updated');
    req.app.get('io').emit('template_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Edit facility details (name, description, location)
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { name, description, location } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (location !== undefined) { fields.push(`location = $${idx++}`); values.push(location); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE turfs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Facility not found' });

    await invalidateFacilitiesCache();

    req.app.get('io').emit('facility_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Admin: Delete a facility
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM turfs WHERE id = $1', [req.params.id]);

    await invalidateFacilitiesCache();
    await cache.delPattern('slots:*');
    await cache.delPattern('templates:*');

    req.app.get('io').emit('facility_updated');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
