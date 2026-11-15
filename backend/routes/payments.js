const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../config/db');
const cache = require('../config/cache');
const { paymentLimiter } = require('../middleware/rateLimiter');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const PLATFORM_FEE_RATE = 0.0236; // Fallback default (2% + 18% GST)

const getEffectiveRate = async () => {
  try {
    const cached = await cache.get('site:settings');
    let settings;
    if (cached) {
      settings = cached;
    } else {
      const result = await pool.query('SELECT gateway_percent, gst_percent FROM site_settings WHERE id = 1');
      settings = result.rows[0] || { gateway_percent: 2.0, gst_percent: 18.0 };
      await cache.set('site:settings', settings, 3600); // Cache for 1 hour
    }
    
    const gateway = Number(settings.gateway_percent) / 100;
    const gst = Number(settings.gst_percent) / 100;
    return gateway * (1 + gst);
  } catch (err) {
    console.error('Error fetching dynamic fee settings:', err);
    return PLATFORM_FEE_RATE;
  }
};

const calculateTotal = async (amount) => {
  const rate = await getEffectiveRate();
  const fee = Math.round(amount * rate * 100) / 100;
  return { fee, total: amount + fee, rate };
};

// Create Order
router.post('/create-order', paymentLimiter, async (req, res) => {
  try {
    const { amount, booking_id } = req.body;
    
    if (!amount || !booking_id) {
      return res.status(400).json({ error: 'Amount and booking_id are required' });
    }

    const { fee, total } = await calculateTotal(amount);

    const options = {
      amount: Math.round(total * 100), // Total including fee in paise
      currency: "INR",
      receipt: booking_id,
    };

    const order = await razorpay.orders.create(options);
    
    // Update booking with the razorpay order id
    await pool.query(
      'UPDATE bookings SET razorpay_order_id = $1 WHERE id = $2',
      [order.id, booking_id]
    );

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay Order Error:', err);
    res.status(500).json({ error: 'Failed to create payment order: ' + err.message });
  }
});

// Verify Payment Signature
router.post('/verify', paymentLimiter, async (req, res) => {
  try {
    const { 
      booking_id, 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature 
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error('[PAYMENT ERROR] RAZORPAY_KEY_SECRET is missing from environment!');
      return res.status(500).json({ error: 'Payment configuration error' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Start a transaction for consistency
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Fetch booking and slot price
        const bookingResult = await client.query(
          `SELECT b.*, s.price as total_price 
           FROM bookings b 
           JOIN slots s ON s.id = b.slot_id 
           WHERE b.id = $1`, 
          [booking_id]
        );
        
        if (bookingResult.rows.length === 0) {
          throw new Error('Booking not found');
        }
        
        const booking = bookingResult.rows[0];

        // Fetch the amount paid from Razorpay
        const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
        const amountPaid = rzpOrder.amount / 100; // Convert paise to INR

        const newPaidAmount = Number(booking.paid_amount || 0) + amountPaid;
        const newRemainingAmount = Math.max(0, Number(booking.total_price) - newPaidAmount);
        const newPaymentStatus = newRemainingAmount <= 0 ? 'paid' : 'pending';

        // Update booking status and financial fields
        await client.query(
          `UPDATE bookings 
           SET status = 'confirmed', 
               payment_status = $1, 
               paid_amount = $2, 
               remaining_amount = $3 
           WHERE id = $4`,
          [newPaymentStatus, newPaidAmount, newRemainingAmount, booking_id]
        );

        // Record the payment in the payments table
        const rate = await getEffectiveRate();
        const baseAmount = Math.round((amountPaid / (1 + rate)) * 100) / 100;
        const platformFee = Math.round((amountPaid - baseAmount) * 100) / 100;

        await client.query(
          `INSERT INTO payments (booking_id, amount, platform_fee, method, razorpay_order_id, razorpay_payment_id) 
           VALUES ($1, $2, $3, 'online', $4, $5)`,
          [booking_id, baseAmount, platformFee, razorpay_order_id, razorpay_payment_id]
        );

        await client.query('COMMIT');
        
        // Invalidate caches to show updated status
        await cache.delPattern('bookings:*');
        await cache.del('admin:stats');
        await cache.del('analytics:dashboard');
        
        // Fetch the updated booking with everything (including qr_token)
        const updatedBookingResult = await client.query('SELECT * FROM bookings WHERE id = $1', [booking_id]);
        
        req.app.get('io').emit('booking_updated');
        
        res.json({ 
          success: true, 
          message: 'Payment verified and booking confirmed',
          booking: updatedBookingResult.rows[0]
        });
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    } else {
      res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Payment Verification Error:', err);
    res.status(500).json({ error: 'Verification failed: ' + err.message });
  }
});

// Tournament Registration: Create Order
router.post('/tournament/create-order', paymentLimiter, async (req, res) => {
  try {
    const { amount, registration_id } = req.body;
    
    if (!amount || !registration_id) {
      return res.status(400).json({ error: 'Amount and registration_id are required' });
    }

    const { total } = await calculateTotal(amount);

    const options = {
      amount: Math.round(total * 100), 
      currency: "INR",
      receipt: registration_id,
    };

    const order = await razorpay.orders.create(options);
    
    await pool.query(
      'UPDATE tournament_registrations SET razorpay_order_id = $1 WHERE id = $2',
      [order.id, registration_id]
    );

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Razorpay Tournament Order Error:', err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// Tournament Registration: Verify
router.post('/tournament/verify', paymentLimiter, async (req, res) => {
  try {
    const { registration_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(body).digest('hex');

    if (expectedSignature === razorpay_signature) {
      const rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
      const amountPaid = rzpOrder.amount / 100;
      const rate = await getEffectiveRate();
      const baseAmount = Math.round((amountPaid / (1 + rate)) * 100) / 100;
      const platformFee = Math.round((amountPaid - baseAmount) * 100) / 100;

      await pool.query(
        `UPDATE tournament_registrations 
         SET payment_status = 'paid', razorpay_payment_id = $1 
         WHERE id = $2`,
        [razorpay_payment_id, registration_id]
      );
      
      // Storing Tournament fee in payments for unified accounting
      await pool.query(
        `INSERT INTO payments (booking_id, amount, platform_fee, method, razorpay_order_id, razorpay_payment_id) 
         VALUES ($1, $2, $3, 'online', $4, $5)`,
        [registration_id, baseAmount, platformFee, razorpay_order_id, razorpay_payment_id]
      );
     
     await cache.delPattern('tournaments:*');
     req.app.get('io').emit('tournament_registration_success', { registration_id });
     
     res.json({ success: true, message: 'Tournament registration complete' });
    } else {
       res.status(400).json({ success: false, error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('Tournament Payment Verification Error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

const bankSmsMatchingService = require('../services/bankSmsMatchingService');

/**
 * Bank SMS Webhook Trigger
 * Called by Android phone (MacroDroid) whenever a bank credit SMS is received.
 * POST or GET /api/payments/bank-sms
 * Accepts:
 *   - Header: 'x-webhook-secret' or 'x-bank-secret'
 *   - Query: ?secret=...&sms=...
 *   - Body: { sms: "...", sender?: "..." } or raw text SMS string
 *   - User-Agent: macrodroid/...
 */
const handleBankSmsWebhook = async (req, res) => {
  try {
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const isMacroDroid = userAgent.includes('macrodroid');

    const providedSecret =
      req.headers['x-webhook-secret'] ||
      req.headers['x-bank-secret'] ||
      req.headers['x-missedcall-secret'] ||
      req.query?.secret ||
      req.body?.secret;

    const validSecrets = [
      (process.env.BANK_SMS_SECRET || '').trim(),
      (process.env.MISSED_CALL_SECRET || '').trim(),
      (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
      'trimurti_bank_secret_2026',
      'trimurti_missed_call_2026',
      'trimurti_arena_secret_2026',
    ].filter(Boolean);

    const isAuthorized = isMacroDroid || (providedSecret && validSecrets.includes(providedSecret.trim()));

    if (!isAuthorized) {
      console.warn('[BANK SMS] Unauthorized attempt. Received secret:', providedSecret, 'UA:', userAgent);
      return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
    }

    // Extract raw SMS text from all possible formats
    let rawSms =
      req.body?.sms ||
      req.body?.text ||
      req.body?.message ||
      req.query?.sms ||
      req.query?.text ||
      req.body?.rawText ||
      (typeof req.body === 'string' ? req.body : null);

    if (!rawSms && req.rawBodyText) {
      rawSms = req.rawBodyText;
    }

    const sender = req.body?.sender || req.query?.sender || req.headers['x-sms-sender'] || '';

    if (!rawSms) {
      return res.status(400).json({ error: 'Missing SMS content in request body' });
    }

    const io = req.app.get('io');
    const result = await bankSmsMatchingService.processIncomingBankSms({
      rawSms,
      sender,
      io,
    });

    return res.status(200).json({
      success: true,
      result,
    });
  } catch (err) {
    console.error('[BANK SMS WEBHOOK ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
};

router.post('/bank-sms', handleBankSmsWebhook);
router.get('/bank-sms', handleBankSmsWebhook);

// Admin: Get recent bank credits (with match status)
router.get('/bank-credits', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, 
             b.id as booking_id,
             u.name as customer_name,
             tr.team_name,
             t.name as turf_name
      FROM bank_sms_credits c
      LEFT JOIN bookings b ON c.matched_booking_id = b.id
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN slots s ON b.slot_id = s.id
      LEFT JOIN turfs t ON s.turf_id = t.id
      LEFT JOIN tournament_registrations tr ON c.matched_registration_id = tr.id
      ORDER BY c.created_at DESC
      LIMIT 50
    `);
    res.json({ success: true, credits: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
