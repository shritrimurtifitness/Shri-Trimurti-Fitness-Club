const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const qrStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'shri-trimurti-fitness-club/upi-qr',
    allowed_formats: ['jpg', 'png', 'webp', 'jpeg'],
  },
});
const qrUpload = multer({
  storage: qrStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Helper for audit logging
async function logAction(adminId, action, details) {
  try {
    await pool.query('INSERT INTO audit_logs (admin_id, action, details) VALUES ($1, $2, $3)', [adminId, action, details]);
  } catch (err) {
    console.error('Audit log failed:', err);
  }
}

// Get public site settings (contact info)
router.get('/contact', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    if (result.rows.length === 0) {
      return res.json({ 
        address: '', phone: '', email: '', working_hours: '', 
        facebook_url: '', instagram_url: '', twitter_url: '',
        map_embed_url: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3821.6516423908665!2d74.120735!3d16.6943068!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc1adfbed242d0d%3A0x78d9a54fdca8460e!2sShri%20Trimurti%20Fitness%20Club!5e0!3m2!1sen!2sin!4v1794397156504!5m2!1sen!2sin',
        gateway_percent: 2.00, gst_percent: 18.00,
        google_rating: 4.6, google_reviews_count: 150, google_maps_url: 'https://www.google.com/search?q=Shri+Trimurti+Fitness+Club+reviews',
        show_testimonials: false,
        upi_id: 'harshvardhanp@slc',
        upi_qr_url: 'https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png'
      });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching contact settings:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin: Toggle testimonials visibility on landing page
router.patch('/toggle-testimonials', authMiddleware, async (req, res) => {
  try {
    const body = req.body || {};
    const hasExplicit = typeof body.show_testimonials === 'boolean';

    const query = hasExplicit
      ? 'UPDATE site_settings SET show_testimonials = $1, updated_at = NOW() WHERE id = 1 RETURNING *'
      : 'UPDATE site_settings SET show_testimonials = NOT COALESCE(show_testimonials, true), updated_at = NOW() WHERE id = 1 RETURNING *';

    const params = hasExplicit ? [body.show_testimonials] : [];
    const result = await pool.query(query, params);

    await cache.del('site:settings');
    await logAction(req.user.id, 'TOGGLE_TESTIMONIALS_VISIBILITY', `Set show_testimonials to ${result.rows[0]?.show_testimonials}`);

    req.app.get('io').emit('settings_updated');

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error toggling testimonials visibility:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update site settings (Admin only)
router.put('/contact', authMiddleware, async (req, res) => {
  const { 
    address, phone, email, working_hours, 
    facebook_url, instagram_url, twitter_url, map_embed_url,
    gateway_percent, gst_percent,
    google_rating, google_reviews_count, google_maps_url,
    show_testimonials,
    upi_id, upi_qr_url
  } = req.body;

  try {
    const query = `
      UPDATE site_settings 
      SET address = COALESCE($1, address), 
          phone = COALESCE($2, phone), 
          email = COALESCE($3, email), 
          working_hours = COALESCE($4, working_hours), 
          facebook_url = COALESCE($5, facebook_url), 
          instagram_url = COALESCE($6, instagram_url), 
          twitter_url = COALESCE($7, twitter_url),
          map_embed_url = COALESCE($8, map_embed_url),
          gateway_percent = COALESCE($9, gateway_percent),
          gst_percent = COALESCE($10, gst_percent),
          google_rating = COALESCE($11, google_rating),
          google_reviews_count = COALESCE($12, google_reviews_count),
          google_maps_url = COALESCE($13, google_maps_url),
          show_testimonials = COALESCE($14, show_testimonials),
          upi_id = COALESCE($15, upi_id),
          upi_qr_url = COALESCE($16, upi_qr_url),
          updated_at = NOW()
      WHERE id = 1
      RETURNING *
    `;
    const result = await pool.query(query, [
      address, phone, email, working_hours, 
      facebook_url, instagram_url, twitter_url, map_embed_url,
      gateway_percent, gst_percent,
      google_rating, google_reviews_count, google_maps_url,
      show_testimonials,
      upi_id, upi_qr_url
    ]);
    
    await cache.del('site:settings'); // Invalidate settings cache
    await logAction(req.user.id, 'UPDATE_CONTACT_SETTINGS', 'Updated website contact, UPI, and financial settings');
    req.app.get('io').emit('settings_updated');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating site settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Admin: Upload new UPI QR Code to Cloudinary and update site_settings
router.post('/upload-qr', authMiddleware, qrUpload.single('qr_image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No QR image file provided' });
    }

    const qrUrl = req.file.path; // Cloudinary secure URL

    const result = await pool.query(
      `UPDATE site_settings 
       SET upi_qr_url = $1, updated_at = NOW() 
       WHERE id = 1 
       RETURNING *`,
      [qrUrl]
    );

    await cache.del('site:settings');
    await logAction(req.user.id, 'UPLOAD_UPI_QR', `Uploaded new UPI QR code to Cloudinary: ${qrUrl}`);
    req.app.get('io').emit('settings_updated');

    res.json({
      success: true,
      message: 'UPI QR code uploaded to Cloudinary successfully!',
      secure_url: qrUrl,
      settings: result.rows[0]
    });
  } catch (err) {
    console.error('QR upload error:', err);
    res.status(500).json({ error: 'Failed to upload QR code: ' + err.message });
  }
});

// Reset Website Data (Danger Zone)
router.post('/reset-data', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Comprehensive wipe using TRUNCATE CASCADE
    // This targets the root entities and wipes everything dependent via CASCADE
    await client.query(`
      TRUNCATE 
        turfs, 
        gallery_images, 
        testimonials, 
        pricing_plans, 
        slot_templates, 
        table_sessions,
        audit_logs
      RESTART IDENTITY CASCADE
    `);

    // 2. Clean users (keep admin)
    await client.query('DELETE FROM users WHERE role != $1', ['admin']);
    
    await client.query('COMMIT');

    // 3. Invalidate complete Redis cache
    await cache.flush();

    // 4. Log the reset action (in the now empty audit_logs)
    await logAction(req.user.id, 'FACTORY_RESET', 'Complete system reset executed. All data cleared EXCEPT admin account.');
    
    res.json({ success: true, message: 'Website data has been completely reset to factory state' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset failed:', err);
    res.status(500).json({ error: 'Failed to complete factory reset' });
  } finally {
    client.release();
  }
});

// Export Database (JSON)
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const data = {};
    
    const tables = ['users', 'turfs', 'slots', 'bookings', 'payments', 'audit_logs'];
    
    for (const table of tables) {
      const result = await pool.query(`SELECT * FROM ${table}`);
      data[table] = result.rows;
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=shritrimurti_backup.json');
    res.send(JSON.stringify(data, null, 2));

    await logAction(req.user.id, 'EXPORT_DATA', 'Database exported to JSON');
  } catch (err) {
    console.error('Export failed:', err);
    res.status(500).json({ error: 'Failed to export database' });
  }
});

module.exports = router;
