const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const cache = require('../config/cache');
const { bookingLimiter } = require('../middleware/rateLimiter');
const mailer = require('../utils/mailer');
const whatsappService = require('../services/whatsapp');
const notificationScheduler = require('../services/notificationScheduler');
const adminBookingService = require('../services/adminBookingService');

router.post('/', bookingLimiter, async (req, res) => {
  try {
    const { name, phone, slot_id, paid_amount = 0, payment_method } = req.body;
    const is_manual = req.body.is_manual || req.body.isManual;
    if (!name || !phone || !slot_id) return res.status(400).json({ error: 'Name, phone, and slot_id required' });

    // Check availability
    const slotResult = await pool.query('SELECT * FROM slots WHERE id = $1 AND is_available = true', [slot_id]);
    if (slotResult.rows.length === 0) return res.status(400).json({ error: 'Slot not available' });

    // Ensure slot doesn't already have an active booking (considering shared physical resources)
    const activeBookingResult = await pool.query(`
      SELECT b.id FROM bookings b
      JOIN slots s_check ON b.slot_id = s_check.id
      JOIN turfs t_check ON s_check.turf_id = t_check.id
      JOIN slots s_orig ON s_orig.id = $1
      JOIN turfs t_orig ON s_orig.turf_id = t_orig.id
      WHERE b.status NOT IN ('cancelled', 'rejected')
      AND s_check.date = s_orig.date
      AND s_check.start_time = s_orig.start_time
      AND (
        s_check.id = s_orig.id 
        OR (t_orig.physical_resource_id IS NOT NULL AND t_orig.physical_resource_id = t_check.physical_resource_id)
      )
    `, [slot_id]);
    if (activeBookingResult.rows.length > 0) return res.status(400).json({ error: 'This time slot is already booked on this physical turf' });

    const slot = slotResult.rows[0];

    // Ensure slot is not in the past
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const slotDateStr = typeof slot.date === 'string'
      ? slot.date.substring(0, 10)
      : new Date(slot.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (slotDateStr < todayIST || (slotDateStr === todayIST && slot.start_time <= nowIST)) {
      return res.status(400).json({ error: 'Cannot book a time slot that has already passed' });
    }

    // Ensure slot is not blocked by a tournament
    const turfResult = await pool.query('SELECT facility_type FROM turfs WHERE id = $1', [slot.turf_id]);
    const facilityType = turfResult.rows[0].facility_type;

    const overlayTournament = await pool.query(`
      SELECT trn.id FROM tournaments trn
      JOIN turfs tf_orig ON tf_orig.id = $1
      WHERE trn.is_active = true 
      AND (
        trn.sport_type ILIKE tf_orig.facility_type
        OR EXISTS (
          SELECT 1 FROM turfs tf_shared 
          WHERE tf_shared.physical_resource_id = tf_orig.physical_resource_id
          AND tf_shared.facility_type ILIKE trn.sport_type
          AND tf_orig.physical_resource_id IS NOT NULL
        )
      )
      AND trn.start_date::DATE <= $2::DATE 
      AND trn.end_date::DATE >= $2::DATE
    `, [slot.turf_id, slot.date]);
    if (overlayTournament.rows.length > 0) return res.status(400).json({ error: 'This turf is currently reserved for a tournament event' });

    // Ensure date is not in arena_closures
    const arenaClosure = await pool.query(
      'SELECT reason FROM arena_closures WHERE date = $1 AND (turf_id IS NULL OR turf_id = $2)',
      [slot.date, slot.turf_id]
    );
    if (arenaClosure.rows.length > 0) {
      return res.status(400).json({ 
        error: `Arena is closed on this date for: ${arenaClosure.rows[0].reason}` 
      });
    }


    // Create or find user
    let userResult = await pool.query('SELECT * FROM users WHERE phone = $1', [phone]);
    let userId;
    if (userResult.rows.length === 0) {
      const newUser = await pool.query('INSERT INTO users (name, phone, role) VALUES ($1, $2, $3) RETURNING id', [name, phone, 'user']);
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
    }

    const totalAmount = slot.price || 800;
    const remainingAmount = Math.max(0, totalAmount - paid_amount);
    const paymentStatus = (paid_amount > 0 && remainingAmount === 0) ? 'paid' : 'pending';
    const bookingStatus = (paid_amount > 0 || is_manual) ? 'confirmed' : 'pending'; // Manual/Admin bookings are confirmed securely

    // Create booking
    const booking = await pool.query(
      `INSERT INTO bookings (user_id, slot_id, status, payment_status, paid_amount, remaining_amount, is_manual) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, slot_id, bookingStatus, paymentStatus, paid_amount, remainingAmount, !!is_manual]
    );

    // Create payment record ONLY if paid_amount > 0 (Manual/Admin flow)
    if (paid_amount > 0) {
      await pool.query(
        `INSERT INTO payments (booking_id, amount, method) VALUES ($1, $2, $3)`,
        [booking.rows[0].id, paid_amount, payment_method || 'cash'] 
      );
    }

    // Invalidate related caches
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');
    await cache.del('analytics:dashboard');

    if (bookingStatus === 'confirmed') {
      notificationScheduler.scheduleBookingNotifications({
        id: booking.rows[0].id,
        customer_phone: phone,
        customer_name: name,
        turf_name: 'Arena Turf',
        date: slot.date,
        start_time: slot.start_time,
        end_time: slot.end_time,
      });
    }

    req.app.get('io').emit('booking_updated');
    res.status(201).json({ booking: booking.rows[0], amount: slot.price || 800 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Calendar: fetch bookings within a date range
router.get('/calendar', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate and endDate are required' });

    const cacheKey = `bookings:calendar:${startDate}:${endDate}`;
    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    const result = await pool.query(`
      SELECT b.id, b.status, b.payment_status, b.paid_amount, b.remaining_amount,
        u.name as customer_name, u.phone,
        s.date, s.start_time, s.end_time, s.price as total_amount,
        t.facility_type, t.name as facility_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      WHERE s.date BETWEEN $1 AND $2
      ORDER BY s.date ASC, s.start_time ASC
    `, [startDate, endDate]);

    await cache.set(cacheKey, result.rows, 30);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { date, status, limit, upcoming } = req.query;
    const cacheKey = `bookings:list:${date || 'all'}:${status || 'all'}:${limit || 'none'}`;

    if (!cache.shouldBypass(req)) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    let query = `
      SELECT b.*, u.name as customer_name, u.phone,
        s.date, s.start_time, s.end_time, s.price as total_amount,
        p.amount as last_payment_amount, p.method as payment_method,
        t.facility_type, t.name as facility_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      LEFT JOIN payments p ON p.booking_id = b.id AND p.id = (SELECT id FROM payments WHERE booking_id = b.id ORDER BY created_at DESC LIMIT 1)
      WHERE 1=1
    `;
    const params = [];
    if (date) { params.push(date); query += ` AND s.date = $${params.length}`; }
    if (status) { params.push(status); query += ` AND b.status = $${params.length}`; }
    if (upcoming === 'true') {
      const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
      const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      params.push(todayIST);
      params.push(nowIST);
      query += ` AND b.status = 'confirmed' AND (s.date > $${params.length - 1} OR (s.date = $${params.length - 1} AND s.end_time > $${params.length}))`;
    }
    
    query += upcoming === 'true' ? ' ORDER BY s.date ASC, s.start_time ASC' : ' ORDER BY b.created_at DESC';

    if (limit) {
      params.push(limit);
      query += ` LIMIT $${params.length}`;
    }

    const result = await pool.query(query, params);
    await cache.set(cacheKey, result.rows, 60); // 60 sec
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:id/pay', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { payment_mode, amount } = req.body; // amount is optional, defaults to entire remaining

    const bookingResult = await client.query('SELECT b.*, s.price FROM bookings b JOIN slots s ON s.id = b.slot_id WHERE b.id = $1', [id]);
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];
    const payAmount = Number(amount) || Number(booking.remaining_amount);
    const newPaidAmount = Number(booking.paid_amount) + payAmount;
    const newRemainingAmount = Math.max(0, Number(booking.price) - newPaidAmount);
    const newPaymentStatus = newRemainingAmount === 0 ? 'paid' : 'pending';

    const updated = await client.query(
      `UPDATE bookings 
       SET payment_status = $1, paid_amount = $2, remaining_amount = $3, payment_mode = $4, status = 'confirmed'
       WHERE id = $5 RETURNING *`,
      [newPaymentStatus, newPaidAmount, newRemainingAmount, payment_mode || 'cash', id]
    );

    // Record the payment
    await client.query(
      `INSERT INTO payments (booking_id, amount, method) VALUES ($1, $2, $3)`,
      [id, payAmount, payment_mode || 'cash']
    );

    await client.query('COMMIT');

    await cache.delPattern('bookings:*');
    await cache.del('admin:stats');
    req.app.get('io').emit('booking_updated');

    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Public: Cancel a pending booking (called when user aborts Razorpay)
// Public: Get bookings by phone number (categorized)
router.get('/my-bookings/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const result = await pool.query(`
      SELECT b.id, b.status, b.payment_status, b.paid_amount, b.remaining_amount,
        s.date, s.start_time, s.end_time, s.price as total_amount, s.table_number,
        t.facility_type, t.name as facility_name, t.image_url as facility_image
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      WHERE u.phone = $1
      ORDER BY s.date DESC, s.start_time DESC
    `, [phone]);

    const bookings = result.rows;
    const now = new Date();
    
    // Categorize into active and history
    const active = [];
    const history = [];

    bookings.forEach(b => {
      // Combine date and time for comparison
      const slotEnd = new Date(b.date);
      const [hours, minutes] = b.end_time.split(':');
      slotEnd.setHours(parseInt(hours), parseInt(minutes), 0);

      if (slotEnd > now && b.status !== 'cancelled') {
        active.push(b);
      } else {
        history.push(b);
      }
    });

    res.json({ active, history });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Staff: Verify QR Token (Publicly accessible but returns limited info, Staff uses it to get ID)
router.get('/verify-qr/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Validate UUID format before querying to avoid "invalid syntax for type uuid" error
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(token)) {
      return res.status(400).json({ error: 'Invalid or Malformed QR Token' });
    }

    const result = await pool.query(`
      SELECT b.id, b.status, b.payment_status, b.paid_amount, b.remaining_amount, b.checked_in_at,
        s.date, s.start_time, s.end_time, s.price as total_amount, s.table_number,
        u.name as customer_name, u.phone,
        t.facility_type, t.name as facility_name
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      WHERE b.qr_token = $1
    `, [token]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Invalid QR Token' });
    
    const b = result.rows[0];
    const now = new Date();
    
    // Convert b.date and times to absolute UTC timestamps using Arena (+05:30) offset
    const datePart = b.date instanceof Date ? b.date.toISOString().split('T')[0] : b.date;
    
    // PostgreSQL TIME values may come as "HH:mm:ss" or "HH:mm" — normalize to HH:mm
    const normalizeTime = (t) => {
      const str = String(t);
      const parts = str.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    };
    
    const startTimeStr = normalizeTime(b.start_time);
    const endTimeStr = normalizeTime(b.end_time);
    
    const slotStart = new Date(`${datePart}T${startTimeStr}:00+05:30`);
    const slotEnd = new Date(`${datePart}T${endTimeStr}:00+05:30`);

    console.log(`[QR Debug] now=${now.toISOString()}, slotStart=${slotStart.toISOString()}, slotEnd=${slotEnd.toISOString()}, rawStart=${b.start_time}, rawEnd=${b.end_time}`);

    const isExpired = now > slotEnd;
    const isFuture = now < slotStart;
    const isActive = now >= slotStart && now <= slotEnd;

    res.json({ 
      booking: b, 
      timing: { isExpired, isFuture, isActive },
      canCheckIn: isActive && !b.checked_in_at && b.status !== 'cancelled'
    });
  } catch (err) {
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// Staff: Mark as Checked-In
router.patch('/:id/check-in', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE bookings SET checked_in_at = NOW() WHERE id = $1 AND checked_in_at IS NULL RETURNING *",
      [id]
    );
    if (result.rows.length === 0) return res.status(400).json({ error: 'Already checked in or booking not found' });
    
    req.app.get('io').emit('booking_updated');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Check-in failed' });
  }
});

// Analytics: Get Live Presence
router.get('/live-presence', authMiddleware, async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

    const result = await pool.query(`
      SELECT b.id, b.checked_in_at, u.phone as customer_phone, u.name as customer_name, t.name as facility_name,
             s.start_time, s.end_time, s.table_number
      FROM bookings b
      JOIN users u ON u.id = b.user_id
      JOIN slots s ON s.id = b.slot_id
      JOIN turfs t ON t.id = s.turf_id
      WHERE s.date = $1
      AND b.status NOT IN ('cancelled', 'rejected')
      AND t.is_active = true
      ORDER BY s.start_time
    `, [today]);

    const allBookings = result.rows;
    const finalPresences = [];
    const processedKeys = new Set();

    for (const b of allBookings) {
      const isCurrentlyInside = b.checked_in_at !== null && b.end_time > nowIST;
      const isExpectedToday = b.checked_in_at === null && b.end_time >= nowIST;

      if (isCurrentlyInside || isExpectedToday) {
        const traceKey = `${b.customer_phone}-${b.facility_name}-${b.table_number}`;
        if (processedKeys.has(traceKey)) continue;

        let tracingEndTime = b.end_time;
        let nextSegment = allBookings.find(next => next.start_time === tracingEndTime && next.customer_phone === b.customer_phone && next.facility_name === b.facility_name);
        while (nextSegment) {
          tracingEndTime = nextSegment.end_time;
          nextSegment = allBookings.find(next => next.start_time === tracingEndTime && next.customer_phone === b.customer_phone && next.facility_name === b.facility_name);
        }

        finalPresences.push({
          ...b,
          end_time: tracingEndTime
        });
        processedKeys.add(traceKey);
      }
    }

    res.json(finalPresences);
  } catch (err) {
    res.status(500).json({ error: 'Presence fetch failed' });
  }
});

// Staff: Extend a booking by one slot (if available)
router.post('/:id/extend', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;

    // 1. Get original booking and slot details
    const orig = await client.query(`
      SELECT b.*, s.date, s.end_time, s.turf_id, s.table_number, u.name, u.phone
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      JOIN users u ON u.id = b.user_id
      WHERE b.id = $1
    `, [id]);

    if (orig.rows.length === 0) return res.status(404).json({ error: 'Original booking not found' });
    const bOrig = orig.rows[0];

    // 2. Find the next slot (same date, same turf, start_time = current end_time)
    const nextSlot = await client.query(`
      SELECT * FROM slots 
      WHERE turf_id = $1 
      AND date = $2 
      AND start_time = $3 
      AND is_available = true
      LIMIT 1
    `, [bOrig.turf_id, bOrig.date, bOrig.end_time]);

    if (nextSlot.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No consecutive slots available for extension' });
    }

    const sNext = nextSlot.rows[0];

    // 3. Create the extension booking
    const newBooking = await client.query(
      `INSERT INTO bookings (user_id, slot_id, status, payment_status, paid_amount, remaining_amount, extension_from_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [bOrig.user_id, sNext.id, 'confirmed', 'pending', 0, sNext.price, id]
    );

    await client.query('COMMIT');
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    req.app.get('io').emit('booking_updated');

    res.json({ message: 'Booking extended successfully', booking: newBooking.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Extension failed: ' + err.message });
  } finally {
    client.release();
  }
});

router.patch('/:id/cancel-pending', async (req, res) => {
  try {
    const { id } = req.params;
    // Delete booking entirely if it was pending
    const result = await pool.query(
      `DELETE FROM bookings WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Booking cannot be cancelled (not found or already processed)' });
    }

    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    req.app.get('io').emit('booking_updated');
    
    res.json({ success: true, message: 'Pending booking cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/bookings/:id/cancel - Admin cancels a booking (confirmed or pending)
router.patch('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    // Update status to 'cancelled' and payment_status to 'refunded' if it was paid
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', 
           payment_status = CASE WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Invalidate caches
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');
    await cache.del('analytics:dashboard');

    notificationScheduler.cancelBookingNotifications(id);

    // Broadcast websocket event
    req.app.get('io').emit('booking_updated');

    res.json({ success: true, message: 'Booking cancelled successfully', booking: result.rows[0] });
  } catch (err) {
    console.error('[CANCEL BOOKING ERROR]', err);
    res.status(500).json({ error: 'Server error during cancellation' });
  }
});

// POST /api/bookings/cleanup - Triggered by external cron job to clean up pending ghost bookings
router.post('/cleanup', async (req, res) => {
  try {
    const receivedSecret = req.headers['x-cron-secret'];
    const systemSecret = process.env.CRON_SECRET || 'super-secret-cron-key-12345';

    if (receivedSecret !== systemSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(`
      DELETE FROM bookings 
      WHERE status = 'pending' 
      AND created_at < NOW() - INTERVAL '2 minutes'
      RETURNING id
    `);

    if (result.rowCount > 0) {
      console.log(`[CLEANUP CRON] Deleted ${result.rowCount} aged pending bookings.`);
      await cache.delPattern('slots:*');
      await cache.delPattern('bookings:*');
      req.app.get('io').emit('booking_updated');
    }

    res.json({ 
      success: true, 
      message: `Cleaned up ${result.rowCount} ghost bookings.` 
    });
  } catch (err) {
    console.error('[CLEANUP CRON ERROR]', err);
    res.status(500).json({ error: 'Server error during cleanup' });
  }
});

// ==========================================
// ==========================================
// DUAL-CHANNEL OTP (WHATSAPP & EMAIL) & STATIC UPI QR WORKFLOW
// ==========================================

// 1. Send OTP to customer's WhatsApp or Email
router.post('/send-otp', bookingLimiter, async (req, res) => {
  try {
    const { email, phone, name, channel = 'whatsapp' } = req.body;
    
    // Generate 4-digit code
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // WhatsApp verification
    if (channel === 'whatsapp' || (!email && phone)) {
      const rawPhone = String(phone || '').replace(/\D/g, '');
      const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
      const phone10 = rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.substring(2) : rawPhone;

      if (phone10.length !== 10) {
        return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
      }

      await pool.query(
        'DELETE FROM otp_verifications WHERE (phone = $1 OR phone = $2) AND verified = false',
        [cleanPhone, phone10]
      );
      await pool.query(
        'INSERT INTO otp_verifications (phone, otp_code, expires_at, channel) VALUES ($1, $2, $3, $4)',
        [cleanPhone, otp, expiresAt, 'whatsapp']
      );

      await cache.set(`otp:whatsapp:${cleanPhone}`, otp, 300);
      await cache.set(`otp:whatsapp:${phone10}`, otp, 300);

      // Attempt to send WhatsApp notification
      const waText = `🏏 *Shri Trimurti Fitness Club*\n\nYour slot verification code is: *${otp}*\n\nValid for 5 minutes. Enter this code on our website or reply with *VERIFY ${otp}* to confirm your booking!`;
      await whatsappService.sendTextMessage({ to: cleanPhone, text: waText }).catch(() => {});

      return res.json({
        success: true,
        channel: 'whatsapp',
        message: 'Verification code generated! Tap the WhatsApp button to verify in 1 tap, or enter the 4-digit code.',
        phone: phone10,
        verificationLink: `https://wa.me/919595153006?text=${encodeURIComponent(`VERIFY ${otp}`)}`,
      });
    }

    // Email verification
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    await pool.query('DELETE FROM otp_verifications WHERE email = $1 AND verified = false', [cleanEmail]);
    await pool.query(
      'INSERT INTO otp_verifications (email, otp_code, expires_at, channel) VALUES ($1, $2, $3, $4)',
      [cleanEmail, otp, expiresAt, 'email']
    );

    await cache.set(`otp:${cleanEmail}`, otp, 300);

    const mailRes = await mailer.sendBookingOTP({ email: cleanEmail, name, otp });

    res.json({
      success: true,
      channel: 'email',
      message: 'Verification code sent to your email',
      provider: mailRes?.provider || 'default',
    });
  } catch (err) {
    console.error('[SEND OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to send OTP: ' + err.message });
  }
});

// 2. Verify OTP (via WhatsApp or Email)
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, phone, otp, channel } = req.body;
    if (!otp) {
      return res.status(400).json({ error: 'OTP code is required' });
    }

    const cleanOtp = otp.toString().trim();
    const cleanEmail = email ? email.toLowerCase().trim() : null;
    const rawPhone = phone ? String(phone).replace(/\D/g, '') : null;
    const cleanPhone = rawPhone && rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    const phone10 = rawPhone && rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.substring(2) : rawPhone;

    // Verify WhatsApp Phone
    if (channel === 'whatsapp' || (cleanPhone && !cleanEmail)) {
      const result = await pool.query(
        `SELECT id, expires_at, phone FROM otp_verifications 
         WHERE (phone = $1 OR phone = $2) 
           AND otp_code = $3 
           AND verified = false 
           AND expires_at > NOW() 
         ORDER BY id DESC LIMIT 1`,
        [cleanPhone, phone10, cleanOtp]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new code.' });
      }

      await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [result.rows[0].id]);
      await cache.set(`otp_verified:whatsapp:${cleanPhone}`, 'true', 900);
      if (phone10) await cache.set(`otp_verified:whatsapp:${phone10}`, 'true', 900);

      const io = req.app.get('io');
      if (io) {
        io.emit('otp_verified', { phone: cleanPhone, phone10, channel: 'whatsapp' });
      }

      return res.json({ success: true, channel: 'whatsapp', message: 'Mobile number verified successfully!' });
    }

    // Verify Email
    if (cleanEmail) {
      const result = await pool.query(
        `SELECT id, expires_at FROM otp_verifications 
         WHERE email = $1 
           AND otp_code = $2 
           AND verified = false 
           AND expires_at > NOW() 
         ORDER BY id DESC LIMIT 1`,
        [cleanEmail, cleanOtp]
      );

      if (result.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new code.' });
      }

      await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [result.rows[0].id]);
      await cache.set(`otp_verified:${cleanEmail}`, 'true', 900);

      const io = req.app.get('io');
      if (io) {
        io.emit('otp_verified', { email: cleanEmail, channel: 'email' });
      }

      return res.json({ success: true, channel: 'email', message: 'Email verified successfully!' });
    }

    return res.status(400).json({ error: 'Either email or mobile number is required to verify' });
  } catch (err) {
    console.error('[VERIFY OTP ERROR]', err);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
});

// 3. Submit Booking with UPI UTR (0% Gateway Fee)
router.post('/submit-upi', bookingLimiter, async (req, res) => {
  try {
    const { name, phone, email, slot_id, slot_ids, utr_number } = req.body;

    if (!name || (!phone && !email) || (!slot_id && (!slot_ids || slot_ids.length === 0)) || !utr_number) {
      return res.status(400).json({ error: 'Name, contact info (mobile number or email), slots, and UPI Ref ID are required' });
    }

    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const rawPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
    const phone10 = rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.substring(2) : rawPhone;
    const cleanUtr = utr_number.trim();

    if (cleanUtr.length < 6) {
      return res.status(400).json({ error: 'Please enter a valid 12-digit UPI Ref ID' });
    }

    // Check duplicate UTR
    const duplicateUtr = await pool.query(
      "SELECT id FROM bookings WHERE utr_number = $1 AND status NOT IN ('cancelled', 'rejected')",
      [cleanUtr]
    );
    if (duplicateUtr.rows.length > 0) {
      return res.status(400).json({ error: 'This UPI Ref ID has already been submitted for another booking' });
    }

    // Check OTP verification: Either Email OR WhatsApp Phone must be verified
    let isVerified = false;

    if (cleanEmail) {
      const emailRecord = await pool.query(
        "SELECT id FROM otp_verifications WHERE email = $1 AND verified = true AND created_at > NOW() - INTERVAL '30 minutes'",
        [cleanEmail]
      );
      const cachedEmail = await cache.get(`otp_verified:${cleanEmail}`);
      if (emailRecord.rows.length > 0 || cachedEmail) {
        isVerified = true;
      }
    }

    if (!isVerified && rawPhone) {
      const phoneRecord = await pool.query(
        "SELECT id FROM otp_verifications WHERE (phone = $1 OR phone = $2) AND verified = true AND created_at > NOW() - INTERVAL '30 minutes'",
        [cleanPhone, phone10]
      );
      const cachedPhone = (await cache.get(`otp_verified:whatsapp:${cleanPhone}`)) || (await cache.get(`otp_verified:whatsapp:${phone10}`));
      if (phoneRecord.rows.length > 0 || cachedPhone) {
        isVerified = true;
      }
    }

    if (!isVerified) {
      return res.status(400).json({ error: 'Please verify your mobile number (WhatsApp OTP) or email before submitting your booking' });
    }

    const targetSlotIds = slot_ids && slot_ids.length > 0 ? slot_ids : [slot_id];

    // Check slots
    const slotsQuery = await pool.query(
      'SELECT s.*, t.facility_type, t.name as turf_name, t.physical_resource_id FROM slots s JOIN turfs t ON s.turf_id = t.id WHERE s.id = ANY($1)',
      [targetSlotIds]
    );

    if (slotsQuery.rows.length !== targetSlotIds.length) {
      return res.status(400).json({ error: 'One or more selected slots could not be found' });
    }

    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

    for (const slot of slotsQuery.rows) {
      const slotDateStr = typeof slot.date === 'string'
        ? slot.date.substring(0, 10)
        : new Date(slot.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

      if (slotDateStr < todayIST || (slotDateStr === todayIST && slot.start_time <= nowIST)) {
        return res.status(400).json({ error: `Slot ${slot.start_time} on ${slotDateStr} has already passed` });
      }

      const conflict = await pool.query(`
        SELECT b.id FROM bookings b
        JOIN slots sc ON b.slot_id = sc.id
        JOIN turfs tc ON sc.turf_id = tc.id
        WHERE b.status NOT IN ('cancelled', 'rejected')
        AND sc.date = $1
        AND sc.start_time = $2
        AND (sc.id = $3 OR (tc.physical_resource_id IS NOT NULL AND tc.physical_resource_id = $4))
      `, [slot.date, slot.start_time, slot.id, slot.physical_resource_id]);

      if (conflict.rows.length > 0) {
        return res.status(400).json({ error: `Slot ${slot.start_time} - ${slot.end_time} is already booked` });
      }
    }

    // Create or find user
    let userResult;
    if (phone10) {
      userResult = await pool.query('SELECT * FROM users WHERE phone = $1 OR phone = $2', [phone10, cleanPhone]);
    } else if (cleanEmail) {
      userResult = await pool.query('SELECT * FROM users WHERE email = $1', [cleanEmail]);
    }

    let userId;
    if (!userResult || userResult.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (name, phone, email, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [name, phone10 || cleanPhone || null, cleanEmail || null, 'user']
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userResult.rows[0].id;
      if (cleanEmail && !userResult.rows[0].email) {
        await pool.query('UPDATE users SET email = $1 WHERE id = $2', [cleanEmail, userId]);
      }
      if (phone10 && !userResult.rows[0].phone) {
        await pool.query('UPDATE users SET phone = $1 WHERE id = $2', [phone10, userId]);
      }
    }

    const createdBookings = [];
    let grandTotal = 0;
    const slotTimes = [];
    const firstSlot = slotsQuery.rows[0];

    for (const slot of slotsQuery.rows) {
      const price = Number(slot.price) || 800;
      grandTotal += price;
      slotTimes.push(`${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`);

      const bookingRes = await pool.query(`
        INSERT INTO bookings (
          user_id, slot_id, status, payment_status, paid_amount, remaining_amount, 
          is_manual, payment_mode, utr_number
        ) VALUES ($1, $2, 'pending_verification', 'pending', $3, 0, false, 'upi_qr', $4)
        RETURNING *
      `, [userId, slot.id, price, cleanUtr]);

      createdBookings.push(bookingRes.rows[0]);
    }

    // Send email alert to customer
    const turfName = firstSlot.turf_name || firstSlot.facility_type || 'Sports Turf';
    const dateFormatted = typeof firstSlot.date === 'string' ? firstSlot.date.substring(0, 10) : new Date(firstSlot.date).toISOString().split('T')[0];

    if (cleanEmail) {
      mailer.sendBookingReceived({
        email: cleanEmail,
        name,
        bookingId: createdBookings[0].id.substring(0, 8).toUpperCase(),
        turfName,
        date: dateFormatted,
        slots: slotTimes,
        totalAmount: grandTotal,
        utrNumber: cleanUtr,
      }).catch(err => console.error('[MAILER ERROR on booking received]', err));
    }

    if (cleanPhone) {
      const waReceipt = `📋 *BOOKING SUBMITTED!* 🏏⚽\n\n*Booking ID:* #${createdBookings[0].id.substring(0, 8).toUpperCase()}\n*Turf:* ${turfName}\n*Date:* ${dateFormatted}\n*Slots:* ${slotTimes.join(', ')}\n*Amount Paid:* ₹${grandTotal}\n*UPI Ref ID:* ${cleanUtr}\n\n⏳ *Status:* Pending Admin Verification\nOur turf manager is verifying the payment in our bank account. Once verified, your official entry pass will be issued!`;
      whatsappService.sendTextMessage({ to: cleanPhone, text: waReceipt }).catch(() => {});
    }

    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');

    req.app.get('io').emit('booking_updated');

    // Notify Admin's personal WhatsApp in real-time
    adminBookingService.notifyAdminNewBooking({
      bookingId: createdBookings[0].id,
      io: req.app.get('io'),
    }).catch(err => console.error('[NOTIFY ADMIN ON WEB BOOKING ERROR]', err));

    res.status(201).json({
      success: true,
      message: 'Booking submitted successfully! Awaiting arena payment verification.',
      bookings: createdBookings,
      totalAmount: grandTotal,
      bookingId: createdBookings[0].id.substring(0, 8).toUpperCase(),
    });
  } catch (err) {
    console.error('[SUBMIT UPI BOOKING ERROR]', err);
    res.status(500).json({ error: 'Server error while submitting booking: ' + err.message });
  }
});

// 3.5. 1-Tap Secure Admin Action Link (handles both full URL and compact micro short link)
async function handleQuickVerify(req, res) {
  try {
    let action = req.query.action || req.params.action;
    let id = req.query.id || req.params.code;
    let token = req.query.token || req.params.token;

    if (!action || !id || !token) {
      return res.status(400).send(adminBookingService.renderAdminResultHtml({
        success: false,
        message: 'Missing verification parameters.',
      }));
    }

    const rawAction = String(action).toLowerCase();
    if (rawAction === 'a' || rawAction === 'approve') {
      action = 'approve';
    } else if (rawAction === 'r' || rawAction === 'reject') {
      action = 'reject';
    } else {
      return res.status(400).send(adminBookingService.renderAdminResultHtml({
        success: false,
        message: 'Invalid action requested.',
      }));
    }

    let bookingId = id;
    // If id is a short code (e.g. 8 chars), find the full UUID in database
    if (id.length < 32) {
      const bRes = await pool.query(
        `SELECT id FROM bookings WHERE id::text ILIKE $1 LIMIT 1`,
        [`${id.toLowerCase()}%`]
      );
      if (bRes.rows.length === 0) {
        return res.status(404).send(adminBookingService.renderAdminResultHtml({
          success: false,
          message: `Booking #${id.toUpperCase()} not found or already verified.`,
        }));
      }
      bookingId = bRes.rows[0].id;
    }

    const isValid = adminBookingService.verifyAdminActionToken(bookingId, action, token);
    if (!isValid) {
      return res.status(403).send(adminBookingService.renderAdminResultHtml({
        success: false,
        message: 'This approval link is invalid or has expired.',
      }));
    }

    if (action === 'approve') {
      const result = await adminBookingService.approveBookingById({
        bookingId,
        io: req.app.get('io'),
        adminIdentifier: '1-tap-whatsapp-link',
      });
      return res.send(adminBookingService.renderAdminResultHtml(result));
    } else if (action === 'reject') {
      const result = await adminBookingService.rejectBookingById({
        bookingId,
        io: req.app.get('io'),
        adminIdentifier: '1-tap-whatsapp-link',
      });
      return res.send(adminBookingService.renderAdminResultHtml(result));
    }
  } catch (err) {
    console.error('[QUICK VERIFY ERROR]', err);
    res.status(500).send(adminBookingService.renderAdminResultHtml({
      success: false,
      message: 'Server error: ' + err.message,
    }));
  }
}

router.get('/quick-verify', handleQuickVerify);
router.get('/v/:action/:code/:token', handleQuickVerify);
router.handleQuickVerify = handleQuickVerify;

// 4. Admin verify UPI payment (Approve or Reject from Dashboard)
router.post('/:id/verify-upi', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Action must be approve or reject' });
    }

    const io = req.app.get('io');
    const adminIdentifier = req.user ? `${req.user.name || req.user.email} (Dashboard)` : 'admin';

    if (action === 'approve') {
      const result = await adminBookingService.approveBookingById({
        bookingId: id,
        io,
        adminIdentifier,
      });
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      return res.json({ success: true, message: result.message, booking: result });
    } else {
      const result = await adminBookingService.rejectBookingById({
        bookingId: id,
        io,
        adminIdentifier,
        reason,
      });
      if (!result.success) {
        return res.status(400).json({ error: result.message });
      }
      return res.json({ success: true, message: result.message });
    }
  } catch (err) {
    console.error('[VERIFY UPI ROUTE ERROR]', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
