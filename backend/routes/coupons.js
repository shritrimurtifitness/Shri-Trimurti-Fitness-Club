const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const { normalizeTo10Digits } = require('../utils/phone');

/**
 * PUBLIC: Check if mobile number qualifies for First-Time Booking Welcome Offer
 */
router.get('/check-first-time', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.json({ eligible: false });
    }

    const phone10 = normalizeTo10Digits(phone);
    if (!phone10 || phone10.length !== 10) {
      return res.json({ eligible: false });
    }

    // 1. Check prior non-cancelled bookings for this phone number
    const priorBookings = await pool.query(`
      SELECT b.id FROM bookings b
      JOIN users u ON u.id = b.user_id
      WHERE u.phone = $1 AND b.status NOT IN ('cancelled', 'rejected')
      LIMIT 1
    `, [phone10]);

    if (priorBookings.rows.length > 0) {
      return res.json({ eligible: false });
    }

    // 2. Check coupon redemptions for this phone
    const priorRedemptions = await pool.query(
      'SELECT id FROM coupon_redemptions WHERE customer_phone = $1 LIMIT 1',
      [phone10]
    );

    if (priorRedemptions.rows.length > 0) {
      return res.json({ eligible: false });
    }

    // 3. Find active Welcome Offer
    const welcomeCoupon = await pool.query(`
      SELECT * FROM coupons
      WHERE is_first_booking_only = true
        AND is_active = true
        AND valid_from <= NOW()
        AND (valid_until IS NULL OR valid_until >= NOW())
        AND (total_usage_limit IS NULL OR used_count < total_usage_limit)
      ORDER BY discount_value DESC
      LIMIT 1
    `);

    if (welcomeCoupon.rows.length === 0) {
      return res.json({ eligible: false });
    }

    const c = welcomeCoupon.rows[0];
    return res.json({
      eligible: true,
      coupon: {
        code: c.code,
        title: c.title,
        description: c.description,
        discount_type: c.discount_type,
        discount_value: Number(c.discount_value),
        min_booking_amount: Number(c.min_booking_amount || 0),
      }
    });
  } catch (err) {
    console.error('[CHECK FIRST TIME COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to check offer eligibility' });
  }
});

/**
 * PUBLIC: Validate Promo Code against Phone & Booking Amount
 */
router.post('/validate', async (req, res) => {
  try {
    const { code, phone, amount } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Please enter a coupon code' });
    }

    const phone10 = normalizeTo10Digits(phone);
    if (!phone10 || phone10.length !== 10) {
      return res.status(400).json({ error: 'Valid 10-digit mobile number required to apply coupon' });
    }

    const bookingAmount = Number(amount);
    if (isNaN(bookingAmount) || bookingAmount <= 0) {
      return res.status(400).json({ error: 'Invalid booking amount' });
    }

    const cleanCode = code.trim().toUpperCase();

    // Find coupon
    const cRes = await pool.query(
      'SELECT * FROM coupons WHERE UPPER(code) = $1',
      [cleanCode]
    );

    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or non-existent coupon code' });
    }

    const coupon = cRes.rows[0];

    // Check active
    if (!coupon.is_active) {
      return res.status(400).json({ error: 'This coupon is no longer active' });
    }

    // Check date validity
    const now = new Date();
    if (coupon.valid_from && new Date(coupon.valid_from) > now) {
      return res.status(400).json({ error: 'This coupon offer has not started yet' });
    }
    if (coupon.valid_until && new Date(coupon.valid_until) < now) {
      return res.status(400).json({ error: 'This coupon has expired' });
    }

    // Check global usage limit
    if (coupon.total_usage_limit && coupon.used_count >= coupon.total_usage_limit) {
      return res.status(400).json({ error: 'This coupon usage limit has been reached' });
    }

    // Check first booking only condition
    if (coupon.is_first_booking_only) {
      const priorBookings = await pool.query(`
        SELECT b.id FROM bookings b
        JOIN users u ON u.id = b.user_id
        WHERE u.phone = $1 AND b.status NOT IN ('cancelled', 'rejected')
        LIMIT 1
      `, [phone10]);

      if (priorBookings.rows.length > 0) {
        return res.status(400).json({ error: 'This welcome offer is only valid on your first turf booking' });
      }
    }

    // Check per-user redemption limit
    const userRedemptions = await pool.query(
      'SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = $1 AND customer_phone = $2',
      [coupon.id, phone10]
    );
    const count = parseInt(userRedemptions.rows[0].count, 10);
    if (count >= (coupon.per_user_limit || 1)) {
      return res.status(400).json({ error: 'You have already used this coupon code the maximum allowed times' });
    }

    // Check minimum booking amount
    const minAmount = Number(coupon.min_booking_amount || 0);
    if (bookingAmount < minAmount) {
      return res.status(400).json({ error: `Minimum booking amount of ₹${minAmount} required to use this coupon` });
    }

    // Calculate discount amount
    let discount = 0;
    if (coupon.discount_type === 'flat') {
      discount = Number(coupon.discount_value);
    } else if (coupon.discount_type === 'percent') {
      discount = (bookingAmount * Number(coupon.discount_value)) / 100;
      if (coupon.max_discount && discount > Number(coupon.max_discount)) {
        discount = Number(coupon.max_discount);
      }
    }

    // Operational price floor: Ensure payable amount does not go below ₹300 minimum
    const maxAllowedDiscount = Math.max(0, bookingAmount - 300);
    discount = Math.min(discount, maxAllowedDiscount);
    discount = Math.round(discount);
    const finalPayable = Math.max(300, bookingAmount - discount);

    return res.json({
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: Number(coupon.discount_value),
      },
      original_amount: bookingAmount,
      discount_amount: discount,
      final_payable: finalPayable,
    });
  } catch (err) {
    console.error('[VALIDATE COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to validate coupon code' });
  }
});

/**
 * ADMIN: Get all coupons with redemption statistics
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
        COALESCE(COUNT(r.id), 0)::int as total_redemptions,
        COALESCE(SUM(r.discount_amount), 0)::numeric as total_discount_given
      FROM coupons c
      LEFT JOIN coupon_redemptions r ON c.id = r.coupon_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN GET COUPONS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch coupons' });
  }
});

/**
 * ADMIN: Create new coupon
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      code,
      title,
      description,
      discount_type = 'flat',
      discount_value,
      max_discount,
      min_booking_amount = 0,
      is_first_booking_only = false,
      total_usage_limit,
      per_user_limit = 1,
      valid_from,
      valid_until,
      is_active = true
    } = req.body;

    if (!code || !title || !discount_value) {
      return res.status(400).json({ error: 'Code, title, and discount value are required' });
    }

    const cleanCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

    // Check unique code
    const existing = await pool.query('SELECT id FROM coupons WHERE code = $1', [cleanCode]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: `Coupon code '${cleanCode}' already exists` });
    }

    const result = await pool.query(`
      INSERT INTO coupons (
        code, title, description, discount_type, discount_value, max_discount,
        min_booking_amount, is_first_booking_only, total_usage_limit, per_user_limit,
        valid_from, valid_until, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, NOW()), $12, $13)
      RETURNING *
    `, [
      cleanCode,
      title.trim(),
      description ? description.trim() : null,
      discount_type,
      Number(discount_value),
      max_discount ? Number(max_discount) : null,
      Number(min_booking_amount) || 0,
      Boolean(is_first_booking_only),
      total_usage_limit ? parseInt(total_usage_limit, 10) : null,
      parseInt(per_user_limit, 10) || 1,
      valid_from || null,
      valid_until || null,
      is_active !== undefined ? Boolean(is_active) : true
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN CREATE COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to create coupon: ' + err.message });
  }
});

/**
 * ADMIN: Toggle coupon status
 */
router.patch('/:id/toggle', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      UPDATE coupons
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN TOGGLE COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to toggle coupon' });
  }
});

/**
 * ADMIN: Update coupon
 */
router.patch('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      discount_type,
      discount_value,
      max_discount,
      min_booking_amount,
      is_first_booking_only,
      total_usage_limit,
      per_user_limit,
      valid_from,
      valid_until,
      is_active
    } = req.body;

    const result = await pool.query(`
      UPDATE coupons SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        discount_type = COALESCE($3, discount_type),
        discount_value = COALESCE($4, discount_value),
        max_discount = $5,
        min_booking_amount = COALESCE($6, min_booking_amount),
        is_first_booking_only = COALESCE($7, is_first_booking_only),
        total_usage_limit = $8,
        per_user_limit = COALESCE($9, per_user_limit),
        valid_from = COALESCE($10, valid_from),
        valid_until = $11,
        is_active = COALESCE($12, is_active),
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
    `, [
      title ? title.trim() : null,
      description !== undefined ? description : null,
      discount_type,
      discount_value !== undefined ? Number(discount_value) : null,
      max_discount !== undefined && max_discount !== '' ? Number(max_discount) : null,
      min_booking_amount !== undefined ? Number(min_booking_amount) : null,
      is_first_booking_only !== undefined ? Boolean(is_first_booking_only) : null,
      total_usage_limit !== undefined && total_usage_limit !== '' ? parseInt(total_usage_limit, 10) : null,
      per_user_limit !== undefined ? parseInt(per_user_limit, 10) : null,
      valid_from || null,
      valid_until || null,
      is_active !== undefined ? Boolean(is_active) : null,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN UPDATE COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
});

/**
 * ADMIN: Delete coupon
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM coupons WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }
    res.json({ success: true, message: 'Coupon deleted successfully' });
  } catch (err) {
    console.error('[ADMIN DELETE COUPON ERROR]', err);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
});

/**
 * ADMIN: Get redemptions for a specific coupon
 */
router.get('/:id/redemptions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT r.*, u.name as customer_name
      FROM coupon_redemptions r
      LEFT JOIN users u ON u.phone = r.customer_phone
      WHERE r.coupon_id = $1
      ORDER BY r.redeemed_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN GET COUPON REDEMPTIONS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch coupon redemptions' });
  }
});

module.exports = router;
