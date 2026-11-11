// ============================================
// TURFZONE BACKEND - Node.js + Express + PostgreSQL
// ============================================
// This is a SEPARATE backend project.
// Deploy to Render, Railway, or any Node.js host.
//
// Setup Instructions:
// 1. Create a new folder: mkdir turfzone-backend && cd turfzone-backend
// 2. npm init -y
// 3. npm install express cors dotenv jsonwebtoken bcryptjs pg
// 4. Copy this file as server.js
// 5. Create .env with the variables below
// 6. node server.js
//
// .env example:
// PORT=5000
// DATABASE_URL=postgresql://user:pass@host:5432/turfzone
// JWT_SECRET=your-super-secret-jwt-key
// RAZORPAY_KEY_ID=rzp_test_xxxxx
// RAZORPAY_KEY_SECRET=xxxxx
// FRONTEND_URL=http://localhost:5173
// ============================================

const express = require('express');
const cors = require('cors');
const http = require('http');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const { Server } = require('socket.io');
const { globalLimiter } = require('./middleware/rateLimiter');
const pool = require('./config/db');
const { client: redisClient } = require('./config/redis');
require('dotenv').config();

// Require Routes
const authRoutes = require('./routes/auth');
const slotsRoutes = require('./routes/slots');
const bookingsRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const paymentsRoutes = require('./routes/payments');
const facilitiesRoutes = require('./routes/facilities');
const templatesRoutes = require('./routes/templates');
const sessionsRoutes = require('./routes/sessions');
const analyticsRoutes = require('./routes/analytics');
const pricingRoutes = require('./routes/pricing');
const galleryRoutes = require('./routes/gallery');
const testimonialsRoutes = require('./routes/testimonials');
const settingsRoutes = require('./routes/settings');
const tournamentsRoutes = require('./routes/tournaments');
const staffRoutes = require('./routes/staff');
const expenseRoutes = require('./routes/expenses');
const whatsappRoutes = require('./routes/whatsapp');

const app = express();
const server = http.createServer(app);
const corsOriginChecker = (origin, callback) => {
  if (!origin) return callback(null, true);
  if (
    process.env.NODE_ENV !== 'production' ||
    origin === process.env.FRONTEND_URL ||
    /^http:\/\/localhost(:\d+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
    /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin)
  ) {
    return callback(null, true);
  }
  return callback(null, true);
};

const io = new Server(server, { cors: { origin: corsOriginChecker, credentials: true } });
app.set('io', io);

const PORT = process.env.PORT || 5000;

// Security & Performance Middleware
app.set('trust proxy', 1); // Trust first proxy (Render/Railway)
app.use(helmet()); // Basic security headers
app.use(compression()); // Gzip compression
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev')); // Logging
app.use(cors({ origin: corsOriginChecker, credentials: true }));
app.use(express.json({ limit: '10kb' })); // Payload limit
// Root & Health check endpoints (placed before rate limiter for uptime monitors & Render probes)
// Lightweight service check: does NOT touch the database so Neon serverless can sleep when idle
const handleHealthCheck = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'backend',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString()
  });
};

app.get('/', (req, res) => {
  res.json({
    name: 'SHRI TRIMURTI FITNESS CLUB API',
    status: 'online',
    version: '1.0.0',
    uptime: `${Math.floor(process.uptime())}s`,
    health: '/health'
  });
});

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

app.use('/api', globalLimiter); // Global rate limiter

// Connect Routes
app.use('/api/auth', authRoutes);
app.use('/api/slots', slotsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/closures', require('./routes/closures'));
app.use('/api/payments', paymentsRoutes);
app.use('/api/facilities', facilitiesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/testimonials', testimonialsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tournaments', tournamentsRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err.stack);
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message 
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

server.listen(PORT, async () => {
  console.log(`SHRI TRIMURTI FITNESS CLUB API running on port ${PORT}`);
  // One-time staff migration
  try {
    await pool.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
    await pool.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'staff'))`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS allowed_tabs TEXT[] DEFAULT '{}'`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10, 2) DEFAULT 0.00`);
    await pool.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT false`);
    await pool.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS is_manual BOOLEAN DEFAULT false`);
    
    // Site settings expansion
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin_hash TEXT`);
    await pool.query(`ALTER TABLE gallery_images ADD COLUMN IF NOT EXISTS resource_type TEXT DEFAULT 'image'`);
    await pool.query(`ALTER TABLE testimonials ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'internal'`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_rating NUMERIC(2,1) DEFAULT 4.6`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_reviews_count INTEGER DEFAULT 150`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS google_maps_url TEXT DEFAULT 'https://www.google.com/search?q=Shri+Trimurti+Sports+Arena+reviews'`);
    await pool.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS show_testimonials BOOLEAN DEFAULT false`);
    
    // Shared Resource Management & Facility Status
    await pool.query(`ALTER TABLE turfs ADD COLUMN IF NOT EXISTS physical_resource_id INTEGER`);
    await pool.query(`ALTER TABLE turfs ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`);
    
    // Auto-map existing Cricket and Football to shared resource ID 1 if they exist
    await pool.query(`
      UPDATE turfs 
      SET physical_resource_id = 1 
      WHERE (facility_type ILIKE '%cricket%' OR facility_type ILIKE '%football%')
      AND (physical_resource_id IS NULL OR physical_resource_id != 1)
    `);
    
    // Password Resets Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Arena Closures Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS arena_closures (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL UNIQUE,
        reason TEXT,
        turf_id UUID REFERENCES turfs(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Re-define generate_daily_slots to support safe table count reduction
    await pool.query(`
      CREATE OR REPLACE FUNCTION generate_daily_slots(target_date DATE, target_turf_id UUID)
      RETURNS void AS $$
      DECLARE
        hour_val INT;
        table_idx INT;
        t_count INT;
        p_wday_d DECIMAL;
        p_wday_n DECIMAL;
        p_wend_d DECIMAL;
        p_wend_n DECIMAL;
        is_weekend BOOLEAN;
        o_hour INT;
        c_hour INT;
        is_closed BOOLEAN;
      BEGIN
        -- Check if arena is closed for this date
        SELECT EXISTS (
          SELECT 1 FROM arena_closures 
          WHERE date = target_date 
          AND (turf_id IS NULL OR turf_id = target_turf_id)
        ) INTO is_closed;

        IF is_closed THEN
          RETURN;
        END IF;

        SELECT 
          weekday_day_price, weekday_night_price, 
          weekend_day_price, weekend_night_price, 
          COALESCE(table_count, 1),
          opening_hour, closing_hour
        INTO 
          p_wday_d, p_wday_n, 
          p_wend_d, p_wend_n, 
          t_count,
          o_hour, c_hour
        FROM turfs WHERE id = target_turf_id;

        is_weekend := EXTRACT(DOW FROM target_date) IN (0, 6);

        -- 1. DELETE redundant slots IF they have no bookings
        DELETE FROM slots 
        WHERE turf_id = target_turf_id 
        AND date = target_date
        AND table_number > t_count
        AND id NOT IN (SELECT slot_id FROM bookings WHERE status != 'cancelled');

        -- 2. CREATE/Update current slots within the operational hours
        FOR hour_val IN o_hour..c_hour-1 LOOP
          FOR table_idx IN 1..t_count LOOP
            INSERT INTO slots (turf_id, date, start_time, end_time, price, table_number)
            VALUES (
              target_turf_id, 
              target_date, 
              make_time(hour_val, 0, 0), 
              make_time(hour_val + 1, 0, 0), 
              CASE 
                WHEN is_weekend THEN (CASE WHEN hour_val >= 18 THEN p_wend_n ELSE p_wend_d END)
                ELSE (CASE WHEN hour_val >= 18 THEN p_wday_n ELSE p_wday_d END)
              END,
              table_idx
            )
            ON CONFLICT DO NOTHING;
          END LOOP;
        END LOOP;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Ensure at least one setting row exists
    await pool.query(`INSERT INTO site_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
    

    console.log('[MIGRATION] Schema ready');

    // Initialize in-memory Matchday Reminder & Review Collector scheduler (0 periodic DB polling)
    const notificationScheduler = require('./services/notificationScheduler');
    notificationScheduler.initScheduler();
  } catch (err) {
    console.error('[MIGRATION] Staff schema error (non-fatal):', err.message);
  }
});

// Graceful Shutdown
const shutdown = async (signal) => {
  console.log(`\n[${signal}] Shutting down gracefully...`);
  
  // Set a safety timeout for forced exit
  const forceExit = setTimeout(() => {
    console.warn('[SHUTDOWN] Forced exit after timeout.');
    process.exit(1);
  }, 3000);

  try {
    // Stop accepting new connections
    server.close(() => {
      console.log('[HTTP] Server stopped.');
    });

    // Close DB & Redis
    if (pool) {
      await pool.end();
      console.log('[POSTGRES] Pool ended.');
    }
    if (redisClient) {
      await redisClient.quit();
      console.log('[REDIS] Client quit.');
    }

    clearTimeout(forceExit);
    console.log('[SHUTDOWN] Clean exit.');
    process.exit(0);
  } catch (err) {
    console.error('[SHUTDOWN ERROR]', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
