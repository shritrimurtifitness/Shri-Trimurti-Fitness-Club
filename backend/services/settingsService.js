const pool = require('../config/db');
const cache = require('../config/cache');

const DEFAULT_SETTINGS = {
  address: 'Near Yashwant Bank, Kuditre Factory , Koparde',
  phone: '+91 9595153006',
  email: 'shritrimurtifitness@gmail.com',
  working_hours: 'Mon–Sun: 6:00 AM – 12:00 AM',
  google_maps_url: 'https://maps.app.goo.gl/XCxniFWMMtnfw2MJA',
  upi_id: 'harshvardhanp@slc',
  upi_qr_url: 'https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png',
  google_rating: 4.6,
  google_reviews_count: 150,
};

/**
 * Returns the live arena settings (address, phone, Google Maps, UPI)
 * Cached in Redis for maximum performance with automatic fallback to PostgreSQL.
 */
async function getLiveSettings() {
  try {
    const cached = await cache.get('site:settings');
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed && parsed.address) {
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
        };
      }
    }
  } catch (err) {
    // Ignore cache error, fallback to DB
  }

  try {
    const result = await pool.query('SELECT * FROM site_settings WHERE id = 1');
    if (result.rows.length > 0) {
      const dbRow = result.rows[0];
      const settings = {
        ...DEFAULT_SETTINGS,
        ...dbRow,
        address: dbRow.address || DEFAULT_SETTINGS.address,
        google_maps_url: dbRow.google_maps_url || DEFAULT_SETTINGS.google_maps_url,
        phone: dbRow.phone || DEFAULT_SETTINGS.phone,
        email: dbRow.email || DEFAULT_SETTINGS.email,
        working_hours: dbRow.working_hours || DEFAULT_SETTINGS.working_hours,
      };
      await cache.set('site:settings', JSON.stringify(settings), 3600).catch(() => {});
      return settings;
    }
  } catch (dbErr) {
    console.error('[SETTINGS SERVICE ERROR] Failed to fetch settings from DB:', dbErr.message);
  }

  return DEFAULT_SETTINGS;
}

module.exports = {
  getLiveSettings,
  DEFAULT_SETTINGS,
};
