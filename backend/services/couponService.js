const pool = require('../config/db');
const { normalizeTo10Digits } = require('../utils/phone');

/**
 * Service providing unified coupon validation, public offer retrieval,
 * and redemption recording across Web and WhatsApp Booking engines.
 */

/**
 * Fetches all active, non-expired public offers.
 * If phone is provided:
 *   - Checks if phone is first-time booker (0 prior non-cancelled bookings & 0 redemptions)
 *   - If first-time booker, includes BOTH is_first_booking_only=true AND general public coupons
 *   - If existing booker, includes ONLY general public coupons (is_first_booking_only=false)
 *   - Filters out coupons already exhausted by this user (per_user_limit reached)
 * Strictly excludes private VIP coupons (is_private=true).
 */
async function getAvailableOffersForPhone({ phone, amount = 0 }) {
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

  return { offers, isFirstTime };
}

/**
 * Validates a coupon code against player's phone and slot booking amount.
 * Returns { valid: true, coupon, discount_amount, final_payable } on success,
 * or { valid: false, status, error } on failure.
 */
async function validateCouponCode({ code, phone, amount }) {
  if (!code || !String(code).trim()) {
    return { valid: false, status: 400, error: 'Please enter a coupon code' };
  }

  const phone10 = normalizeTo10Digits(phone);
  if (!phone10 || phone10.length !== 10) {
    return { valid: false, status: 400, error: 'Valid 10-digit mobile number required to apply coupon' };
  }

  const bookingAmount = Number(amount);
  if (isNaN(bookingAmount) || bookingAmount <= 0) {
    return { valid: false, status: 400, error: 'Invalid booking amount' };
  }

  const cleanCode = String(code).trim().toUpperCase();

  // Find coupon
  const cRes = await pool.query(
    'SELECT * FROM coupons WHERE UPPER(code) = $1',
    [cleanCode]
  );

  if (cRes.rows.length === 0) {
    return { valid: false, status: 404, error: 'Invalid coupon code' };
  }

  const coupon = cRes.rows[0];

  // Check private closed-group whitelist (Stealth check: Outsiders receive exact 404 'Invalid coupon code')
  if (coupon.is_private) {
    const wlRes = await pool.query(
      'SELECT * FROM coupon_whitelist WHERE coupon_id = $1 AND phone = $2',
      [coupon.id, phone10]
    );
    if (wlRes.rows.length === 0) {
      return { valid: false, status: 404, error: 'Invalid coupon code' };
    }

    const wlMember = wlRes.rows[0];
    if (wlMember.max_uses !== null && wlMember.max_uses !== undefined && wlMember.max_uses > 0) {
      if (wlMember.used_count >= wlMember.max_uses) {
        return { valid: false, status: 400, error: 'You have already reached the redemption limit for this exclusive coupon' };
      }
    }
  }

  // Check active status
  if (!coupon.is_active) {
    return { valid: false, status: 400, error: 'This coupon is no longer active' };
  }

  // Check date validity
  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return { valid: false, status: 400, error: 'This coupon offer has not started yet' };
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return { valid: false, status: 400, error: 'This coupon has expired' };
  }

  // Check global usage limit
  if (coupon.total_usage_limit && coupon.used_count >= coupon.total_usage_limit) {
    return { valid: false, status: 400, error: 'This coupon usage limit has been reached' };
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
      return { valid: false, status: 400, error: 'This welcome offer is only valid on your first turf booking' };
    }
  }

  // Check per-user redemption limit
  const userRedemptions = await pool.query(
    'SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id = $1 AND customer_phone = $2',
    [coupon.id, phone10]
  );
  const count = parseInt(userRedemptions.rows[0].count, 10);
  if (count >= (coupon.per_user_limit || 1)) {
    return { valid: false, status: 400, error: 'You have already used this coupon code the maximum allowed times' };
  }

  // Check minimum booking amount
  const minAmount = Number(coupon.min_booking_amount || 0);
  if (bookingAmount < minAmount) {
    return { valid: false, status: 400, error: `Minimum booking amount of ₹${minAmount} required to use this coupon` };
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

  return {
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      title: coupon.title,
      description: coupon.description,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value),
      is_private: Boolean(coupon.is_private),
      is_first_booking_only: Boolean(coupon.is_first_booking_only),
    },
    original_amount: bookingAmount,
    discount_amount: discount,
    final_payable: finalPayable,
  };
}

/**
 * Atomically records coupon redemption in database transaction.
 * @param {Object} dbClient - pg client or pool
 * @param {Object} params
 * @param {string} params.couponId - UUID of coupon
 * @param {string} params.bookingId - UUID of booking
 * @param {string} params.phone - 10-digit customer phone
 * @param {number} params.discountAmount - Rupee amount saved
 */
async function recordRedemptionInTransaction(dbClient, { couponId, bookingId, phone, discountAmount, finalPaidAmount = 0 }) {
  if (!couponId || !bookingId) return;
  const phone10 = normalizeTo10Digits(phone);

  // 1. Record redemption
  await dbClient.query(`
    INSERT INTO coupon_redemptions (coupon_id, booking_id, customer_phone, discount_amount, final_paid_amount)
    VALUES ($1, $2, $3, $4, $5)
  `, [couponId, bookingId, phone10, discountAmount || 0, finalPaidAmount || 0]);

  // 2. Increment coupon used_count
  await dbClient.query(`
    UPDATE coupons
    SET used_count = used_count + 1, updated_at = NOW()
    WHERE id = $1
  `, [couponId]);

  // 3. If private VIP coupon, increment whitelist member used_count
  if (phone10) {
    await dbClient.query(`
      UPDATE coupon_whitelist
      SET used_count = used_count + 1, updated_at = NOW()
      WHERE coupon_id = $1 AND phone = $2
    `, [couponId, phone10]);
  }
}

module.exports = {
  getAvailableOffersForPhone,
  validateCouponCode,
  recordRedemptionInTransaction,
};
