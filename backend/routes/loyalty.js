const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const authMiddleware = require('../middleware/auth');
const loyaltyService = require('../services/loyaltyService');
const { normalizeTo10Digits } = require('../utils/phone');

/**
 * GET /api/loyalty/status/:phone
 * Public / customer query to get live wallet, cycle progress, and milestone status
 */
router.get('/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;
    const status = await loyaltyService.getWalletStatus(phone);
    if (!status) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    res.json(status);
  } catch (err) {
    console.error('[LOYALTY STATUS ERROR]', err);
    res.status(500).json({ error: 'Server error fetching loyalty status' });
  }
});

/**
 * POST /api/loyalty/preview
 * Previews redemption amount and discount for a proposed booking
 */
router.post('/preview', async (req, res) => {
  try {
    const { phone, slotPrice } = req.body;
    if (!phone || slotPrice === undefined) {
      return res.status(400).json({ error: 'Phone and slotPrice required' });
    }
    const preview = await loyaltyService.previewRedemption({ phone, slotPrice: Number(slotPrice) });
    res.json(preview);
  } catch (err) {
    console.error('[LOYALTY PREVIEW ERROR]', err);
    res.status(500).json({ error: 'Server error previewing redemption' });
  }
});

/**
 * GET /api/loyalty/history/:phone
 * Retrieves transaction audit ledger for customer
 */
router.get('/history/:phone', async (req, res) => {
  try {
    const phone = normalizeTo10Digits(req.params.phone);
    const result = await pool.query(`
      SELECT lt.*, b.slot_id, s.date as match_date, t.name as turf_name
      FROM loyalty_transactions lt
      JOIN user_loyalty_wallets w ON lt.wallet_id = w.id
      LEFT JOIN bookings b ON lt.booking_id = b.id
      LEFT JOIN slots s ON b.slot_id = s.id
      LEFT JOIN turfs t ON s.turf_id = t.id
      WHERE w.phone = $1
      ORDER BY lt.created_at DESC
      LIMIT 50
    `, [phone]);

    res.json(result.rows);
  } catch (err) {
    console.error('[LOYALTY HISTORY ERROR]', err);
    res.status(500).json({ error: 'Server error fetching loyalty history' });
  }
});

/**
 * GET /api/loyalty/admin/overview
 * Admin overview stats
 */
router.get('/admin/overview', authMiddleware, async (req, res) => {
  try {
    const settings = await loyaltyService.getLoyaltySettings();

    const statsRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_wallets,
        COALESCE(SUM(vault_balance), 0)::numeric as total_coins_in_vaults,
        COALESCE(SUM(spendable_balance), 0)::numeric as total_spendable_coins,
        COALESCE(SUM(lifetime_spent), 0)::numeric as total_coins_redeemed,
        COUNT(CASE WHEN completed_milestones > 0 THEN 1 END)::int as milestone_achievers,
        COUNT(CASE WHEN vault_balance > 0 OR spendable_balance > 0 THEN 1 END)::int as active_members
      FROM user_loyalty_wallets
    `);

    res.json({
      settings,
      stats: statsRes.rows[0],
    });
  } catch (err) {
    console.error('[LOYALTY ADMIN OVERVIEW ERROR]', err);
    res.status(500).json({ error: 'Server error fetching loyalty overview' });
  }
});

/**
 * GET /api/loyalty/admin/wallets
 * Admin search & list wallets
 */
router.get('/admin/wallets', authMiddleware, async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    let query = `
      SELECT w.*, u.name as customer_name, u.email as customer_email
      FROM user_loyalty_wallets w
      LEFT JOIN users u ON w.user_id = u.id
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` WHERE w.phone LIKE $1 OR LOWER(u.name) LIKE LOWER($1)`;
    }

    query += ` ORDER BY w.updated_at DESC LIMIT 100`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('[LOYALTY ADMIN WALLETS ERROR]', err);
    res.status(500).json({ error: 'Server error fetching loyalty wallets' });
  }
});

/**
 * POST /api/loyalty/admin/adjust
 * Admin bonus grant or deduction
 */
router.post('/admin/adjust', authMiddleware, async (req, res) => {
  try {
    const { phone, coins, type, reason } = req.body;
    if (!phone || !coins || !type) {
      return res.status(400).json({ error: 'Phone, coins, and type required' });
    }

    const result = await loyaltyService.adminManualAdjustment({
      phone,
      coins: Number(coins),
      type,
      reason,
      adminId: req.user?.id,
    });

    res.json(result);
  } catch (err) {
    console.error('[LOYALTY ADMIN ADJUST ERROR]', err);
    res.status(500).json({ error: err.message || 'Server error adjusting loyalty balance' });
  }
});

module.exports = router;
