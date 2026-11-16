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

    // 3. Find active Welcome Offer (Public Only - never show private coupons)
    const welcomeCoupon = await pool.query(`
      SELECT * FROM coupons
      WHERE is_first_booking_only = true
        AND is_active = true
        AND (is_private IS FALSE OR is_private IS NULL)
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
 * PUBLIC: Fetch all available public offers
 * If phone is provided:
 *   - Checks if phone is first-time booker (0 prior non-cancelled bookings & 0 redemptions)
 *   - If first-time booker, includes BOTH is_first_booking_only=true AND general public coupons
 *   - If existing booker, includes ONLY general public coupons (is_first_booking_only=false)
 *   - Filters out coupons already exhausted by this user (per_user_limit reached)
 * Strictly excludes private VIP coupons (is_private=true).
 */
router.get('/public-offers', async (req, res) => {
  try {
    const { phone } = req.query;
    let isFirstTime = false;
    let phone10 = null;

    if (phone) {
      phone10 = normalizeTo10Digits(phone);
      if (phone10 && phone10.length === 10) {
        // 1. Check prior non-cancelled bookings
        const priorBookings = await pool.query(`
          SELECT b.id FROM bookings b
          JOIN users u ON u.id = b.user_id
          WHERE u.phone = $1 AND b.status NOT IN ('cancelled', 'rejected')
          LIMIT 1
        `, [phone10]);

        // 2. Check coupon redemptions
        const priorRedemptions = await pool.query(
          'SELECT id FROM coupon_redemptions WHERE customer_phone = $1 LIMIT 1',
          [phone10]
        );

        if (priorBookings.rows.length === 0 && priorRedemptions.rows.length === 0) {
          isFirstTime = true;
        }
      }
    }

    // Query active, non-private, valid public coupons
    const query = `
      SELECT 
        c.id,
        c.code,
        c.title,
        c.description,
        c.discount_type,
        c.discount_value,
        c.min_booking_amount,
        c.max_discount,
        c.is_first_booking_only,
        c.per_user_limit,
        c.total_usage_limit,
        c.used_count
      FROM coupons c
      WHERE c.is_active = true
        AND (c.is_private IS FALSE OR c.is_private IS NULL)
        AND c.valid_from <= NOW()
        AND (c.valid_until IS NULL OR c.valid_until >= NOW())
        AND (c.total_usage_limit IS NULL OR c.used_count < c.total_usage_limit)
        ${!isFirstTime ? 'AND (c.is_first_booking_only IS FALSE OR c.is_first_booking_only IS NULL)' : ''}
      ORDER BY c.is_first_booking_only DESC, c.discount_value DESC
    `;

    const result = await pool.query(query);

    let eligibleOffers = result.rows;
    if (phone10) {
      const redemptionsRes = await pool.query(
        'SELECT coupon_id, COUNT(*)::int as count FROM coupon_redemptions WHERE customer_phone = $1 GROUP BY coupon_id',
        [phone10]
      );
      const usageMap = new Map();
      redemptionsRes.rows.forEach(r => usageMap.set(r.coupon_id, r.count));

      eligibleOffers = eligibleOffers.filter(c => {
        const used = usageMap.get(c.id) || 0;
        const limit = c.per_user_limit || 1;
        return used < limit;
      });
    }

    const offers = eligibleOffers.map(c => ({
      id: c.id,
      code: c.code,
      title: c.title,
      description: c.description,
      discount_type: c.discount_type,
      discount_value: Number(c.discount_value),
      max_discount: c.max_discount ? Number(c.max_discount) : null,
      min_booking_amount: Number(c.min_booking_amount || 0),
      is_first_booking_only: Boolean(c.is_first_booking_only)
    }));

    return res.json({ offers, is_first_time: isFirstTime });
  } catch (err) {
    console.error('[GET PUBLIC OFFERS ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch public offers' });
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
      return res.status(404).json({ error: 'Invalid coupon code' });
    }

    const coupon = cRes.rows[0];

    // Check private closed-group whitelist (Stealth check: Outsiders receive exact 404 'Invalid coupon code')
    if (coupon.is_private) {
      const wlRes = await pool.query(
        'SELECT * FROM coupon_whitelist WHERE coupon_id = $1 AND phone = $2',
        [coupon.id, phone10]
      );
      if (wlRes.rows.length === 0) {
        return res.status(404).json({ error: 'Invalid coupon code' });
      }

      const wlMember = wlRes.rows[0];
      if (wlMember.max_uses !== null && wlMember.max_uses !== undefined && wlMember.max_uses > 0) {
        if (wlMember.used_count >= wlMember.max_uses) {
          return res.status(400).json({ error: 'You have already reached the redemption limit for this exclusive coupon' });
        }
      }
    }

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
        COALESCE((SELECT COUNT(*)::int FROM coupon_redemptions r WHERE r.coupon_id = c.id), 0) as total_redemptions,
        COALESCE((SELECT SUM(r.discount_amount)::numeric FROM coupon_redemptions r WHERE r.coupon_id = c.id), 0) as total_discount_given,
        COALESCE((SELECT COUNT(*)::int FROM coupon_whitelist w WHERE w.coupon_id = c.id), 0) as whitelisted_count
      FROM coupons c
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
      is_private = false,
      whitelist_members = [],
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
        min_booking_amount, is_first_booking_only, is_private, total_usage_limit, per_user_limit,
        valid_from, valid_until, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12, NOW()), $13, $14)
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
      Boolean(is_private),
      total_usage_limit ? parseInt(total_usage_limit, 10) : null,
      parseInt(per_user_limit, 10) || 1,
      valid_from || null,
      valid_until || null,
      is_active !== undefined ? Boolean(is_active) : true
    ]);

    const newCoupon = result.rows[0];

    // If private and initial whitelist members provided, insert them
    if (Boolean(is_private) && Array.isArray(whitelist_members) && whitelist_members.length > 0) {
      for (const m of whitelist_members) {
        const phone10 = normalizeTo10Digits(m.phone);
        if (phone10 && phone10.length === 10) {
          const maxUses = m.max_uses !== undefined && m.max_uses !== '' && m.max_uses !== null ? parseInt(m.max_uses, 10) : 1;
          await pool.query(`
            INSERT INTO coupon_whitelist (coupon_id, phone, member_name, max_uses)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (coupon_id, phone) DO UPDATE SET
              member_name = COALESCE(EXCLUDED.member_name, coupon_whitelist.member_name),
              max_uses = EXCLUDED.max_uses,
              updated_at = NOW()
          `, [newCoupon.id, phone10, m.member_name ? m.member_name.trim() : null, isNaN(maxUses) ? 1 : maxUses]);
        }
      }
    }

    res.status(201).json(newCoupon);
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
      is_private,
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
        is_private = COALESCE($8, is_private),
        total_usage_limit = $9,
        per_user_limit = COALESCE($10, per_user_limit),
        valid_from = COALESCE($11, valid_from),
        valid_until = $12,
        is_active = COALESCE($13, is_active),
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      title ? title.trim() : null,
      description !== undefined ? description : null,
      discount_type,
      discount_value !== undefined ? Number(discount_value) : null,
      max_discount !== undefined && max_discount !== '' ? Number(max_discount) : null,
      min_booking_amount !== undefined ? Number(min_booking_amount) : null,
      is_first_booking_only !== undefined ? Boolean(is_first_booking_only) : null,
      is_private !== undefined ? Boolean(is_private) : null,
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
 * ADMIN: Get whitelisted members for a private coupon
 */
router.get('/:id/whitelist', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, coupon_id, phone, member_name, max_uses, used_count, created_at, updated_at
      FROM coupon_whitelist
      WHERE coupon_id = $1
      ORDER BY created_at DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[ADMIN GET WHITELIST ERROR]', err);
    res.status(500).json({ error: 'Failed to fetch coupon whitelist' });
  }
});

/**
 * ADMIN: Add member(s) to coupon whitelist
 */
router.post('/:id/whitelist', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { phone, member_name, max_uses = 1, members } = req.body;

    const couponCheck = await pool.query('SELECT id, is_private FROM coupons WHERE id = $1', [id]);
    if (couponCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    // Auto-mark coupon as private if adding whitelisted members
    if (!couponCheck.rows[0].is_private) {
      await pool.query('UPDATE coupons SET is_private = true, updated_at = NOW() WHERE id = $1', [id]);
    }

    const itemsToAdd = [];
    if (Array.isArray(members) && members.length > 0) {
      itemsToAdd.push(...members);
    } else if (phone) {
      itemsToAdd.push({ phone, member_name, max_uses });
    }

    if (itemsToAdd.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one phone number' });
    }

    const inserted = [];
    for (const item of itemsToAdd) {
      const p10 = normalizeTo10Digits(item.phone);
      if (!p10 || p10.length !== 10) continue;
      const mUses = item.max_uses !== undefined && item.max_uses !== '' && item.max_uses !== null ? parseInt(item.max_uses, 10) : 1;
      const row = await pool.query(`
        INSERT INTO coupon_whitelist (coupon_id, phone, member_name, max_uses)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (coupon_id, phone) DO UPDATE SET
          member_name = COALESCE(EXCLUDED.member_name, coupon_whitelist.member_name),
          max_uses = EXCLUDED.max_uses,
          updated_at = NOW()
        RETURNING *
      `, [id, p10, item.member_name ? item.member_name.trim() : null, isNaN(mUses) ? 1 : mUses]);
      inserted.push(row.rows[0]);
    }

    res.status(201).json({ success: true, count: inserted.length, members: inserted });
  } catch (err) {
    console.error('[ADMIN ADD WHITELIST ERROR]', err);
    res.status(500).json({ error: 'Failed to add whitelisted members' });
  }
});

/**
 * ADMIN: Update a specific whitelisted member
 */
router.patch('/:id/whitelist/:phone', authMiddleware, async (req, res) => {
  try {
    const { id, phone } = req.params;
    const { member_name, max_uses } = req.body;
    const p10 = normalizeTo10Digits(phone);

    const mUses = max_uses !== undefined && max_uses !== '' && max_uses !== null ? parseInt(max_uses, 10) : null;

    const result = await pool.query(`
      UPDATE coupon_whitelist SET
        member_name = COALESCE($1, member_name),
        max_uses = COALESCE($2, max_uses),
        updated_at = NOW()
      WHERE coupon_id = $3 AND phone = $4
      RETURNING *
    `, [
      member_name !== undefined ? (member_name ? member_name.trim() : null) : null,
      mUses,
      id,
      p10
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Whitelisted member not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('[ADMIN UPDATE WHITELIST MEMBER ERROR]', err);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

/**
 * ADMIN: Remove member from whitelist
 */
router.delete('/:id/whitelist/:phone', authMiddleware, async (req, res) => {
  try {
    const { id, phone } = req.params;
    const p10 = normalizeTo10Digits(phone);
    const result = await pool.query(
      'DELETE FROM coupon_whitelist WHERE coupon_id = $1 AND phone = $2 RETURNING id',
      [id, p10]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Whitelisted member not found' });
    }

    res.json({ success: true, message: 'Member removed from whitelist' });
  } catch (err) {
    console.error('[ADMIN DELETE WHITELIST MEMBER ERROR]', err);
    res.status(500).json({ error: 'Failed to remove member from whitelist' });
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
