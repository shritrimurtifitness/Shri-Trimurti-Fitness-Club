const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { sendTextMessage } = require('../services/whatsapp');

// Fast UUID regex to prevent invalid SQL casting errors
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// In-memory cache for gate settings (refreshed every 60 seconds)
let cachedSettings = null;
let lastSettingsFetch = 0;

async function getGateSettings() {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsFetch < 60000)) {
    return cachedSettings;
  }

  try {
    const res = await pool.query(
      'SELECT gate_secret_key, gate_early_arrival_minutes, gate_unlock_duration_seconds FROM site_settings WHERE id = 1 LIMIT 1'
    );
    if (res.rows.length > 0) {
      cachedSettings = {
        secretKey: res.rows[0].gate_secret_key || process.env.GATE_SECRET_KEY || 'trimurti_gate_secret_2026',
        earlyArrivalMinutes: parseInt(res.rows[0].gate_early_arrival_minutes, 10) || 15,
        unlockDurationSeconds: parseInt(res.rows[0].gate_unlock_duration_seconds, 10) || 10,
      };
    } else {
      cachedSettings = {
        secretKey: process.env.GATE_SECRET_KEY || 'trimurti_gate_secret_2026',
        earlyArrivalMinutes: 15,
        unlockDurationSeconds: 10,
      };
    }
  } catch (err) {
    cachedSettings = {
      secretKey: process.env.GATE_SECRET_KEY || 'trimurti_gate_secret_2026',
      earlyArrivalMinutes: 15,
      unlockDurationSeconds: 10,
    };
  }
  lastSettingsFetch = now;
  return cachedSettings;
}

// In-memory sliding-window rate limiter for gate device (max 60 scans/min per gate)
const scanAttempts = new Map();
function isRateLimited(gateId = 'main_gate') {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const history = scanAttempts.get(gateId) || [];
  const validHistory = history.filter(ts => now - ts < windowMs);
  
  if (validHistory.length >= 60) {
    return true;
  }
  validHistory.push(now);
  scanAttempts.set(gateId, validHistory);
  return false;
}

// Helper: Format 24-hr time string (HH:mm:ss or HH:mm) to 12-hr AM/PM format (e.g. "06:00 PM")
function formatTo12Hour(timeStr) {
  if (!timeStr) return '';
  const str = String(timeStr);
  const parts = str.split(':');
  let hour = parseInt(parts[0], 10);
  const minute = parts[1] || '00';
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; // 0 becomes 12
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
}

// Helper: Normalize PostgreSQL time string to HH:mm
function normalizeTime(t) {
  const str = String(t);
  const parts = str.split(':');
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
}

// Helper: Record Gate Access Log
async function recordGateLog(bookingId, qrToken, customerName, turfName, status, reason, gateId = 'main_gate') {
  try {
    await pool.query(
      `INSERT INTO gate_access_logs (booking_id, qr_token, customer_name, turf_name, status, reason, gate_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [bookingId || null, qrToken || null, customerName || 'Unknown', turfName || 'N/A', status, reason, gateId]
    );
  } catch (err) {
    console.error('[GATE AUDIT LOG ERROR]', err.message);
  }
}

// -------------------------------------------------------------
// POST /api/gate/scan
// Primary endpoint called by ESP32 / Kiosk Scanner
// -------------------------------------------------------------
router.post('/scan', async (req, res) => {
  const gateId = req.headers['x-gate-id'] || 'main_gate';

  if (isRateLimited(gateId)) {
    return res.status(429).json({
      granted: false,
      status: 'RATE_LIMITED',
      line1: '! ACCESS DENIED !',
      line2: 'TOO MANY SCANS',
      line3: 'Please wait a moment',
      line4: 'and try again'
    });
  }

  try {
    const settings = await getGateSettings();

    // 1. Verify Hardware Secret Key
    const providedKey = req.headers['x-gate-key'] || req.query.key;
    if (!providedKey || providedKey !== settings.secretKey) {
      console.warn(`[GATE SECURITY WARNING] Unauthorized scan attempt at gate ${gateId}`);
      return res.status(401).json({
        error: 'Unauthorized gate device: Invalid or missing X-Gate-Key'
      });
    }

    const { qrToken, token } = req.body;
    const rawToken = (qrToken || token || '').trim();

    // 2. Validate Token Format
    if (!rawToken || !UUID_REGEX.test(rawToken)) {
      await recordGateLog(null, rawToken, null, null, 'denied', 'INVALID_FORMAT', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'INVALID_FORMAT',
        line1: '! ACCESS DENIED !',
        line2: 'INVALID PASS FORMAT',
        line3: 'Scan official QR',
        line4: 'or contact desk'
      });
    }

    // 3. Query Booking and Turf Information
    const query = `
      SELECT 
        b.id, b.status, b.payment_status, b.paid_amount, b.remaining_amount, b.checked_in_at,
        to_char(s.date, 'YYYY-MM-DD') as date_str, s.date, s.start_time, s.end_time, s.price as total_amount, s.table_number,
        u.name as customer_name, u.phone,
        t.id as turf_id, t.facility_type, t.name as facility_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      WHERE b.qr_token = $1
    `;
    const result = await pool.query(query, [rawToken]);

    if (result.rows.length === 0) {
      await recordGateLog(null, rawToken, null, null, 'denied', 'NOT_FOUND', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'NOT_FOUND',
        line1: '! ACCESS DENIED !',
        line2: 'BOOKING NOT FOUND',
        line3: 'Check WhatsApp Pass',
        line4: 'or contact desk'
      });
    }

    const b = result.rows[0];

    // 4. Check Booking Cancellation
    if (b.status === 'cancelled' || b.status === 'rejected') {
      await recordGateLog(b.id, rawToken, b.customer_name, b.facility_name, 'denied', 'BOOKING_CANCELLED', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'BOOKING_CANCELLED',
        line1: '! ACCESS DENIED !',
        line2: 'BOOKING CANCELLED',
        line3: 'Contact arena desk',
        line4: 'to rebook slot'
      });
    }

    // 5. Check Payment Status
    const isPaymentConfirmed = (b.status === 'confirmed') && 
      (b.payment_status === 'paid' || b.payment_status === 'completed');

    if (!isPaymentConfirmed) {
      await recordGateLog(b.id, rawToken, b.customer_name, b.facility_name, 'denied', 'PAYMENT_PENDING', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'PAYMENT_PENDING',
        line1: '! ACCESS DENIED !',
        line2: 'PAYMENT PENDING',
        line3: 'Pay on WhatsApp',
        line4: 'to activate pass'
      });
    }

    // 6. Time Window Calculation (Arena timezone: UTC+05:30)
    const now = new Date();
    const datePart = b.date_str || (b.date instanceof Date ? b.date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) : String(b.date).split('T')[0]);
    const startTimeStr = normalizeTime(b.start_time);
    const endTimeStr = normalizeTime(b.end_time);

    const slotStart = new Date(`${datePart}T${startTimeStr}:00+05:30`);
    const slotEnd = new Date(`${datePart}T${endTimeStr}:00+05:30`);
    
    // Apply Early Arrival Window
    const earlyArrivalMs = settings.earlyArrivalMinutes * 60 * 1000;
    const earliestAllowed = new Date(slotStart.getTime() - earlyArrivalMs);

    const formattedStart = formatTo12Hour(b.start_time);
    const formattedEnd = formatTo12Hour(b.end_time);
    const openTime = new Date(earliestAllowed.getTime());
    const formattedOpen = openTime.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Case: Too Early
    if (now < earliestAllowed) {
      const minutesRemaining = Math.ceil((earliestAllowed - now) / 60000);
      await recordGateLog(b.id, rawToken, b.customer_name, b.facility_name, 'denied', 'TOO_EARLY', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'TOO_EARLY',
        minutesRemaining,
        slotTime: `${formattedStart} - ${formattedEnd}`,
        line1: '! ACCESS DENIED !',
        line2: 'TOO EARLY TO ENTER',
        line3: `Slot: ${formattedStart}`,
        line4: `Opens at: ${formattedOpen}`
      });
    }

    // Case: Expired
    if (now > slotEnd) {
      await recordGateLog(b.id, rawToken, b.customer_name, b.facility_name, 'denied', 'EXPIRED', gateId);
      return res.json({
        granted: false,
        status: 'DENIED',
        reason: 'EXPIRED',
        slotTime: `${formattedStart} - ${formattedEnd}`,
        line1: '! ACCESS DENIED !',
        line2: 'PASS EXPIRED',
        line3: `Ended at: ${formattedEnd}`,
        line4: 'Please book again'
      });
    }

    // 7. ACCESS GRANTED (Within active entry window)
    const isReEntry = Boolean(b.checked_in_at);

    if (!isReEntry) {
      // First check-in: mark timestamp in database
      await pool.query(
        "UPDATE bookings SET checked_in_at = NOW() WHERE id = $1 AND checked_in_at IS NULL",
        [b.id]
      );

      // Realtime UI updates via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.emit('booking_checked_in', {
          bookingId: b.id,
          customerName: b.customer_name,
          turfName: b.facility_name,
          slotTime: `${formattedStart} - ${formattedEnd}`,
          timestamp: new Date()
        });
        io.emit('booking_updated');
      }

      // Asynchronous WhatsApp confirmation message (non-blocking)
      if (b.phone) {
        setImmediate(async () => {
          try {
            await sendTextMessage(
              b.phone,
              `🏟️ *Welcome to Shri Trimurti Sports Arena!* 🏏⚽\n\nYour Gate Pass has been verified and entry is unlocked.\n\n📍 *Facility:* ${b.facility_name}\n⏰ *Slot:* ${formattedStart} - ${formattedEnd}\n\nHave a fantastic game! Need bibs, balls, or energy drinks? Feel free to ask our arena desk.`
            );
          } catch (whatsappErr) {
            console.error('[GATE WHATSAPP NOTIFICATION ERROR]', whatsappErr.message);
          }
        });
      }
    }

    // Record audit log
    await recordGateLog(
      b.id,
      rawToken,
      b.customer_name,
      b.facility_name,
      isReEntry ? 're_entry' : 'granted',
      isReEntry ? 'RE_ENTRY_SUCCESS' : 'INITIAL_CHECKIN_SUCCESS',
      gateId
    );

    // Broadcast gate event to admin live monitors
    const io = req.app.get('io');
    if (io) {
      io.emit('gate_scan_event', {
        status: isReEntry ? 're_entry' : 'granted',
        customerName: b.customer_name,
        turfName: b.facility_name,
        slotTime: `${formattedStart} - ${formattedEnd}`,
        gateId,
        timestamp: new Date()
      });
    }

    // Format text for 128x64 OLED display (max ~18-20 characters per line)
    const displayName = b.customer_name.length > 18 
      ? b.customer_name.substring(0, 18) 
      : b.customer_name;
    const shortFacility = b.facility_name.length > 10 
      ? b.facility_name.substring(0, 10) 
      : b.facility_name;

    return res.json({
      granted: true,
      status: isReEntry ? 'RE_ENTRY' : 'GRANTED',
      unlockDurationSeconds: settings.unlockDurationSeconds,
      customerName: b.customer_name,
      turfName: b.facility_name,
      slotTime: `${formattedStart} - ${formattedEnd}`,
      isReEntry,
      line1: isReEntry ? 'RE-ENTRY GRANTED' : 'ACCESS GRANTED',
      line2: displayName,
      line3: `${shortFacility} ${formattedStart}`,
      line4: `GATE OPEN (${settings.unlockDurationSeconds}s)`
    });

  } catch (err) {
    console.error('[GATE SCAN ERROR]', err);
    return res.status(500).json({
      granted: false,
      status: 'SERVER_ERROR',
      error: 'Gate verification failed: ' + err.message,
      line1: '! SYSTEM ERROR !',
      line2: 'INTERNAL ERROR',
      line3: 'Please contact desk',
      line4: 'for manual entry'
    });
  }
});

// -------------------------------------------------------------
// GET /api/gate/ping
// Heartbeat & connection test for gate hardware
// -------------------------------------------------------------
router.get('/ping', async (req, res) => {
  const settings = await getGateSettings();
  const providedKey = req.headers['x-gate-key'] || req.query.key;
  
  if (!providedKey || providedKey !== settings.secretKey) {
    return res.status(401).json({ error: 'Unauthorized gate device: Invalid X-Gate-Key' });
  }

  res.json({
    status: 'ok',
    arena: 'Shri Trimurti Sports Arena',
    serverTime: new Date().toISOString(),
    gateOnline: true,
    earlyArrivalMinutes: settings.earlyArrivalMinutes,
    unlockDurationSeconds: settings.unlockDurationSeconds
  });
});

// -------------------------------------------------------------
// POST /api/gate/manual-unlock
// Staff / Admin remote gate buzz-in
// -------------------------------------------------------------
router.post('/manual-unlock', authMiddleware, async (req, res) => {
  try {
    const { durationSeconds = 10, reason = 'Staff Remote Override', gateId = 'main_gate' } = req.body;
    const userName = req.user.name || req.user.phone || 'Staff';

    await recordGateLog(null, null, userName, 'Manual Override', 'manual_override', reason, gateId);

    const io = req.app.get('io');
    if (io) {
      io.emit('gate_manual_unlock', {
        durationSeconds,
        triggeredBy: userName,
        reason,
        gateId,
        timestamp: new Date()
      });
      io.emit('gate_scan_event', {
        status: 'manual_override',
        customerName: userName,
        turfName: 'Manual Override',
        gateId,
        timestamp: new Date()
      });
    }

    res.json({
      success: true,
      message: `Gate ${gateId} unlocked remotely for ${durationSeconds} seconds by ${userName}.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to trigger remote unlock: ' + err.message });
  }
});

// -------------------------------------------------------------
// GET /api/gate/logs
// Staff / Admin query of recent gate activity
// -------------------------------------------------------------
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const result = await pool.query(
      `SELECT * FROM gate_access_logs ORDER BY scanned_at DESC LIMIT $1`,
      [limit]
    );
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve gate logs: ' + err.message });
  }
});

// -------------------------------------------------------------
// GET /api/gate/config & PUT /api/gate/config
// Staff / Admin get and update gate timing and settings
// -------------------------------------------------------------
router.get('/config', authMiddleware, async (req, res) => {
  try {
    const settings = await getGateSettings();
    res.json({ success: true, config: settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch gate config: ' + err.message });
  }
});

router.put('/config', authMiddleware, async (req, res) => {
  try {
    const { earlyArrivalMinutes, unlockDurationSeconds, secretKey } = req.body;
    
    await pool.query(
      `UPDATE site_settings 
       SET gate_early_arrival_minutes = COALESCE($1, gate_early_arrival_minutes),
           gate_unlock_duration_seconds = COALESCE($2, gate_unlock_duration_seconds),
           gate_secret_key = COALESCE($3, gate_secret_key)
       WHERE id = 1`,
      [earlyArrivalMinutes, unlockDurationSeconds, secretKey]
    );

    // Invalidate cache immediately
    cachedSettings = null;
    lastSettingsFetch = 0;

    const updated = await getGateSettings();
    res.json({ success: true, message: 'Gate configuration updated', config: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update gate config: ' + err.message });
  }
});

module.exports = router;
