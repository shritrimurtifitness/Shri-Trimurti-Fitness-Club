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

module.exports = router;
