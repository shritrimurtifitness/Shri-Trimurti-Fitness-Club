/**
 * Trimurti Coins Loyalty & Milestone Reward System Service
 *
 * Implements cycle-based locked vault and milestone unlocks:
 * - Admin sets coins awarded per slot (default: 10 coins) and milestone threshold (default: 20 slots).
 * - Bookings 1 to (target - 1) accumulate coins in a LOCKED vault (vault_balance).
 * - Upon reaching the milestone threshold (e.g. 20th booking), the entire vault unlocks into spendable_balance!
 * - The player can redeem all their unlocked loyalty points.
 * - The next cycle begins immediately (e.g. slots 21 to 40) accumulating into a new vault.
 * - Multi-channel parity: Web App & WhatsApp Bot Engine share the same unified 10-digit mobile wallet.
 */

const pool = require('../config/db');
const cache = require('../config/cache');
const { normalizeTo10Digits, toWhatsAppPhone } = require('../utils/phone');
const { sendTextMessage } = require('./whatsapp');

/**
 * Retrieves live loyalty settings from site_settings table (cached for 60s)
 */
async function getLoyaltySettings() {
  const cacheKey = 'site_settings:loyalty';
  try {
    const cached = await cache.get(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch (err) {
    // ignore cache failure
  }

  const res = await pool.query(`
    SELECT 
      COALESCE(loyalty_enabled, true) as loyalty_enabled,
      COALESCE(loyalty_coins_per_slot, 10) as loyalty_coins_per_slot,
      COALESCE(loyalty_milestone_target, 20) as loyalty_milestone_target,
      COALESCE(loyalty_coin_value_inr, 1.00) as loyalty_coin_value_inr
    FROM site_settings 
    WHERE id = 1
  `);

  const settings = res.rows.length > 0 ? res.rows[0] : {
    loyalty_enabled: true,
    loyalty_coins_per_slot: 10,
    loyalty_milestone_target: 20,
    loyalty_coin_value_inr: 1.00,
  };

  settings.loyalty_coins_per_slot = Number(settings.loyalty_coins_per_slot);
  settings.loyalty_milestone_target = Number(settings.loyalty_milestone_target);
  settings.loyalty_coin_value_inr = Number(settings.loyalty_coin_value_inr);

  try {
    await cache.set(cacheKey, JSON.stringify(settings), 60);
  } catch (err) {}

  return settings;
}

/**
 * Retrieves or creates a customer's loyalty wallet by 10-digit phone
 */
async function getOrCreateWallet(rawPhone, userId = null, client = null) {
  const phone = normalizeTo10Digits(rawPhone);
  if (!phone || phone.length < 10) return null;

  const dbClient = client || pool;

  let res = await dbClient.query(
    'SELECT * FROM user_loyalty_wallets WHERE phone = $1',
    [phone]
  );

  if (res.rows.length === 0) {
    // If userId not provided, try to find user by phone
    let targetUserId = userId;
    if (!targetUserId) {
      const uRes = await dbClient.query('SELECT id FROM users WHERE phone = $1 LIMIT 1', [phone]);
      if (uRes.rows.length > 0) targetUserId = uRes.rows[0].id;
    }

    const insertRes = await dbClient.query(`
      INSERT INTO user_loyalty_wallets (
        user_id, phone, vault_balance, spendable_balance,
        current_cycle_bookings, completed_milestones, lifetime_bookings_count,
        lifetime_earned, lifetime_spent
      ) VALUES ($1, $2, 0.00, 0.00, 0, 0, 0, 0.00, 0.00)
      ON CONFLICT (phone) DO UPDATE SET updated_at = NOW()
      RETURNING *
    `, [targetUserId, phone]);

    return insertRes.rows[0];
  }

  // Update user_id if it was null previously
  if (!res.rows[0].user_id && userId) {
    await dbClient.query(
      'UPDATE user_loyalty_wallets SET user_id = $1, updated_at = NOW() WHERE id = $2',
      [userId, res.rows[0].id]
    );
    res.rows[0].user_id = userId;
  }

  return res.rows[0];
}

/**
 * Returns complete loyalty summary & gamified milestone status for customer
 */
async function getWalletStatus(rawPhone) {
  const phone = normalizeTo10Digits(rawPhone);
  if (!phone || phone.length < 10) return null;

  const [settings, wallet] = await Promise.all([
    getLoyaltySettings(),
    getOrCreateWallet(phone),
  ]);

  if (!wallet) return null;

  const coinsPerSlot = settings.loyalty_coins_per_slot;
  const milestoneTarget = settings.loyalty_milestone_target;
  const coinValueInr = settings.loyalty_coin_value_inr;

  const vaultBalance = Number(wallet.vault_balance) || 0;
  const spendableBalance = Number(wallet.spendable_balance) || 0;
  const currentCycleBookings = Number(wallet.current_cycle_bookings) || 0;
  const completedMilestones = Number(wallet.completed_milestones) || 0;
  const lifetimeBookings = Number(wallet.lifetime_bookings_count) || 0;

  const remainingForUnlock = Math.max(0, milestoneTarget - currentCycleBookings);
  const nextMilestoneTotal = (completedMilestones + 1) * milestoneTarget;
  const progressPct = milestoneTarget > 0 
    ? Math.min(100, Math.round((currentCycleBookings / milestoneTarget) * 100))
    : 100;

  return {
    phone,
    loyalty_enabled: settings.loyalty_enabled,
    coins_per_slot: coinsPerSlot,
    milestone_target: milestoneTarget,
    coin_value_inr: coinValueInr,
    vault_balance: vaultBalance,
    spendable_balance: spendableBalance,
    spendable_inr_value: Math.round(spendableBalance * coinValueInr),
    current_cycle_bookings: currentCycleBookings,
    remaining_for_unlock: remainingForUnlock,
    completed_milestones: completedMilestones,
    next_milestone_total: nextMilestoneTotal,
    lifetime_bookings_count: lifetimeBookings,
    lifetime_earned: Number(wallet.lifetime_earned) || 0,
    lifetime_spent: Number(wallet.lifetime_spent) || 0,
    is_vault_locked: vaultBalance > 0 && currentCycleBookings < milestoneTarget,
    can_redeem: spendableBalance > 0 && settings.loyalty_enabled,
    progress_pct: progressPct,
  };
}

/**
 * Previews coin redemption for a given slot price
 */
async function previewRedemption({ phone, slotPrice }) {
  const status = await getWalletStatus(phone);
  if (!status || !status.loyalty_enabled || status.spendable_balance <= 0) {
    return {
      canRedeem: false,
      spendableCoins: 0,
      maxRedeemableCoins: 0,
      discountAmount: 0,
      finalPrice: Number(slotPrice),
      reason: !status?.loyalty_enabled ? 'Loyalty program currently inactive' : 'No spendable coins available',
    };
  }

  const coinVal = status.coin_value_inr;
  const maxPossibleDiscount = Number(slotPrice);
  const maxCoinsUsable = Math.min(
    status.spendable_balance,
    Math.floor(maxPossibleDiscount / coinVal)
  );

  const discountAmount = Math.round(maxCoinsUsable * coinVal);
  const finalPrice = Math.max(0, Number(slotPrice) - discountAmount);

  return {
    canRedeem: maxCoinsUsable > 0,
    spendableCoins: status.spendable_balance,
    maxRedeemableCoins: maxCoinsUsable,
    discountAmount,
    finalPrice,
  };
}

/**
 * Accrues coins for a completed/confirmed booking.
 * - Handles cycle accumulation (e.g. 10 coins per slot)
 * - Detects milestone hit (e.g. 20th booking) -> unlocks vault into spendable balance!
 * - Multi-channel: triggers WhatsApp celebratory alert to player if milestone unlocked.
 */
async function accrueCoinsForBooking({ bookingId, client = null, io = null }) {
  const dbClient = client || pool;

  // 1. Fetch booking details
  const bRes = await dbClient.query(`
    SELECT b.id, b.user_id, b.slot_id, b.status, b.payment_status,
           b.coins_accrued, b.paid_amount, u.phone, u.name as customer_name,
           t.name as turf_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN slots s ON b.slot_id = s.id
    JOIN turfs t ON s.turf_id = t.id
    WHERE b.id = $1
  `, [bookingId]);

  if (bRes.rows.length === 0) return { success: false, reason: 'Booking not found' };
  const booking = bRes.rows[0];

  // Idempotency check: don't award twice for the same booking
  if (booking.coins_accrued && Number(booking.coins_accrued) > 0) {
    return { success: false, reason: 'Coins already accrued for this booking' };
  }

  const settings = await getLoyaltySettings();
  if (!settings.loyalty_enabled) {
    return { success: false, reason: 'Loyalty program disabled' };
  }

  const coinsPerSlot = settings.loyalty_coins_per_slot;
  const milestoneTarget = settings.loyalty_milestone_target;
  const coinVal = settings.loyalty_coin_value_inr;
  const phone = normalizeTo10Digits(booking.phone);

  // 2. Lock or create wallet
  await getOrCreateWallet(phone, booking.user_id, dbClient);
  const walletRes = await dbClient.query(
    'SELECT * FROM user_loyalty_wallets WHERE phone = $1 FOR UPDATE',
    [phone]
  );
  const wallet = walletRes.rows[0];

  const prevVault = Number(wallet.vault_balance) || 0;
  const prevSpendable = Number(wallet.spendable_balance) || 0;
  const prevCycleBookings = Number(wallet.current_cycle_bookings) || 0;
  const newCycleBookings = prevCycleBookings + 1;
  const newLifetimeBookings = (Number(wallet.lifetime_bookings_count) || 0) + 1;
  const newLifetimeEarned = (Number(wallet.lifetime_earned) || 0) + coinsPerSlot;

  let unlockedNow = false;
  let totalUnlockedAmount = 0;
  let newVaultBalance = 0;
  let newSpendableBalance = prevSpendable;
  let newCycleBookingsFinal = newCycleBookings;
  let newCompletedMilestones = Number(wallet.completed_milestones) || 0;

  if (newCycleBookings >= milestoneTarget) {
    // ==========================================
    // MILESTONE REACHED! VAULT UNLOCKS!
    // ==========================================
    unlockedNow = true;
    totalUnlockedAmount = prevVault + coinsPerSlot;
    newVaultBalance = 0.00;
    newSpendableBalance = prevSpendable + totalUnlockedAmount;
    newCycleBookingsFinal = 0; // Reset for next cycle (e.g. slots 21 to 40)
    newCompletedMilestones += 1;

    // Update wallet
    await dbClient.query(`
      UPDATE user_loyalty_wallets
      SET vault_balance = $1,
          spendable_balance = $2,
          current_cycle_bookings = $3,
          completed_milestones = $4,
          lifetime_bookings_count = $5,
          lifetime_earned = $6,
          updated_at = NOW()
      WHERE id = $7
    `, [
      newVaultBalance,
      newSpendableBalance,
      newCycleBookingsFinal,
      newCompletedMilestones,
      newLifetimeBookings,
      newLifetimeEarned,
      wallet.id,
    ]);

    // Record milestone unlock in ledger
    await dbClient.query(`
      INSERT INTO loyalty_transactions (
        wallet_id, user_id, booking_id, type, coins, inr_value,
        channel, balance_after_spendable, balance_after_vault, cycle_number, notes
      ) VALUES ($1, $2, $3, 'vault_unlock', $4, $5, 'system', $6, $7, $8, $9)
    `, [
      wallet.id,
      booking.user_id,
      booking.id,
      totalUnlockedAmount,
      totalUnlockedAmount * coinVal,
      newSpendableBalance,
      newVaultBalance,
      newCompletedMilestones,
      `Completed milestone ${newCompletedMilestones} (${milestoneTarget} matches)! Unlocked ${totalUnlockedAmount} Trimurti Coins.`,
    ]);

    // Dispatch celebratory WhatsApp message to player
    const waPhone = toWhatsAppPhone(phone);
    if (waPhone) {
      const nextMilestoneTotal = (newCompletedMilestones + 1) * milestoneTarget;
      const celebrationMsg =
`🎉 *CONGRATULATIONS, CAPTAIN!* 🏆🏏⚽

You have officially completed your *${newCompletedMilestones * milestoneTarget}th match* at Shri Trimurti Fitness Club!

🔓 *YOUR TRIMURTI VAULT IS NOW UNLOCKED!*
🪙 *${totalUnlockedAmount} Trimurti Coins (Worth ₹${totalUnlockedAmount})* have been deposited into your spendable wallet!

💰 *Total Available Spendable Coins:* *${newSpendableBalance} TC* (₹${newSpendableBalance})

💡 *You can now redeem all your loyalty points for discounts* on your next Cricket Turf or Football Turf booking on WhatsApp or our website!

🏃 _Your next milestone cycle has begun! Next unlock at ${nextMilestoneTotal} matches._`;

      sendTextMessage({ to: waPhone, text: celebrationMsg }).catch(err => {
        console.error('[LOYALTY WHATSAPP MILESTONE ERROR]', err.message);
      });
    }
  } else {
    // ==========================================
    // NORMAL CYCLE ACCRUAL (LOCKED IN VAULT)
    // ==========================================
    newVaultBalance = prevVault + coinsPerSlot;

    await dbClient.query(`
      UPDATE user_loyalty_wallets
      SET vault_balance = $1,
          current_cycle_bookings = $2,
          lifetime_bookings_count = $3,
          lifetime_earned = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [
      newVaultBalance,
      newCycleBookingsFinal,
      newLifetimeBookings,
      newLifetimeEarned,
      wallet.id,
    ]);

    // Record vault accrual in ledger
    await dbClient.query(`
      INSERT INTO loyalty_transactions (
        wallet_id, user_id, booking_id, type, coins, inr_value,
        channel, balance_after_spendable, balance_after_vault, cycle_number, notes
      ) VALUES ($1, $2, $3, 'accrual_vault', $4, $5, 'system', $6, $7, $8, $9)
    `, [
      wallet.id,
      booking.user_id,
      booking.id,
      coinsPerSlot,
      coinsPerSlot * coinVal,
      newSpendableBalance,
      newVaultBalance,
      newCompletedMilestones + 1,
      `+${coinsPerSlot} Trimurti Coins earned into vault for match ${newCycleBookingsFinal}/${milestoneTarget}`,
    ]);
  }

  // Update booking record
  await dbClient.query(`
    UPDATE bookings
    SET coins_accrued = $1, loyalty_status = 'accrued'
    WHERE id = $2
  `, [coinsPerSlot, booking.id]);

  if (io) {
    io.emit('loyalty_updated', { phone });
  }

  return {
    success: true,
    unlockedNow,
    coinsEarned: coinsPerSlot,
    totalUnlockedAmount,
    newVaultBalance,
    newSpendableBalance,
    currentCycleBookings: newCycleBookingsFinal,
    milestoneTarget,
  };
}

/**
 * Atomically redeems spendable coins on a booking within an SQL transaction
 */
async function applyRedemptionInTransaction(client, { bookingId, phone: rawPhone, coinsToRedeem, channel = 'web' }) {
  const coins = Number(coinsToRedeem);
  if (!coins || coins <= 0) return { applied: false, reason: 'Invalid coin amount' };

  const phone = normalizeTo10Digits(rawPhone);
  const settings = await getLoyaltySettings();
  if (!settings.loyalty_enabled) {
    throw new Error('Loyalty reward program is currently inactive');
  }

  const walletRes = await client.query(
    'SELECT * FROM user_loyalty_wallets WHERE phone = $1 FOR UPDATE',
    [phone]
  );
  if (walletRes.rows.length === 0) {
    throw new Error('No loyalty wallet found for this phone number');
  }

  const wallet = walletRes.rows[0];
  const spendable = Number(wallet.spendable_balance) || 0;
  if (spendable < coins) {
    throw new Error(`Insufficient spendable Trimurti Coins (Available: ${spendable}, Requested: ${coins})`);
  }

  const coinVal = settings.loyalty_coin_value_inr;
  const discountInr = coins * coinVal;
  const newSpendable = spendable - coins;
  const newLifetimeSpent = (Number(wallet.lifetime_spent) || 0) + coins;

  // 1. Deduct from wallet
  await client.query(`
    UPDATE user_loyalty_wallets
    SET spendable_balance = $1,
        lifetime_spent = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [newSpendable, newLifetimeSpent, wallet.id]);

  // 2. Update booking
  await client.query(`
    UPDATE bookings
    SET coins_redeemed = $1,
        coins_discount_amount = $2,
        loyalty_status = 'redeemed'
    WHERE id = $3
  `, [coins, discountInr, bookingId]);

  // 3. Log audit ledger
  await client.query(`
    INSERT INTO loyalty_transactions (
      wallet_id, user_id, booking_id, type, coins, inr_value,
      channel, balance_after_spendable, balance_after_vault, cycle_number, notes
    ) VALUES ($1, $2, $3, 'redemption', $4, $5, $6, $7, $8, $9, $10)
  `, [
    wallet.id,
    wallet.user_id,
    bookingId,
    coins,
    discountInr,
    channel,
    newSpendable,
    wallet.vault_balance,
    (Number(wallet.completed_milestones) || 0) + 1,
    `Redeemed ${coins} Trimurti Coins (₹${discountInr} discount) on booking`,
  ]);

  return {
    applied: true,
    coinsRedeemed: coins,
    discountInr,
    newSpendableBalance: newSpendable,
  };
}

/**
 * Handles rollback if a booking is cancelled or rejected
 */
async function rollbackCoinsForBooking({ bookingId, client = null }) {
  const dbClient = client || pool;

  const bRes = await dbClient.query(`
    SELECT b.id, b.user_id, b.coins_redeemed, b.coins_accrued, u.phone
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    WHERE b.id = $1
  `, [bookingId]);

  if (bRes.rows.length === 0) return;
  const b = bRes.rows[0];
  const phone = normalizeTo10Digits(b.phone);

  const walletRes = await dbClient.query(
    'SELECT * FROM user_loyalty_wallets WHERE phone = $1 FOR UPDATE',
    [phone]
  );
  if (walletRes.rows.length === 0) return;
  const wallet = walletRes.rows[0];

  // 1. If coins were redeemed, refund them back to spendable_balance
  const redeemed = Number(b.coins_redeemed) || 0;
  if (redeemed > 0) {
    const restoredSpendable = (Number(wallet.spendable_balance) || 0) + redeemed;
    const restoredSpent = Math.max(0, (Number(wallet.lifetime_spent) || 0) - redeemed);

    await dbClient.query(`
      UPDATE user_loyalty_wallets
      SET spendable_balance = $1, lifetime_spent = $2, updated_at = NOW()
      WHERE id = $3
    `, [restoredSpendable, restoredSpent, wallet.id]);

    await dbClient.query(`
      INSERT INTO loyalty_transactions (
        wallet_id, user_id, booking_id, type, coins, inr_value,
        channel, balance_after_spendable, balance_after_vault, notes
      ) VALUES ($1, $2, $3, 'rollback', $4, $5, 'system', $6, $7, $8)
    `, [
      wallet.id,
      wallet.user_id,
      b.id,
      redeemed,
      redeemed,
      restoredSpendable,
      wallet.vault_balance,
      `Refunded ${redeemed} Trimurti Coins back to wallet due to cancelled/rejected booking`,
    ]);
  }

  // 2. If coins were accrued, reverse them
  const accrued = Number(b.coins_accrued) || 0;
  if (accrued > 0) {
    const newVault = Math.max(0, (Number(wallet.vault_balance) || 0) - accrued);
    const newCycleBookings = Math.max(0, (Number(wallet.current_cycle_bookings) || 0) - 1);
    const newLifetimeEarned = Math.max(0, (Number(wallet.lifetime_earned) || 0) - accrued);
    const newLifetimeBookings = Math.max(0, (Number(wallet.lifetime_bookings_count) || 0) - 1);

    await dbClient.query(`
      UPDATE user_loyalty_wallets
      SET vault_balance = $1,
          current_cycle_bookings = $2,
          lifetime_earned = $3,
          lifetime_bookings_count = $4,
          updated_at = NOW()
      WHERE id = $5
    `, [newVault, newCycleBookings, newLifetimeEarned, newLifetimeBookings, wallet.id]);

    await dbClient.query(`
      INSERT INTO loyalty_transactions (
        wallet_id, user_id, booking_id, type, coins, inr_value,
        channel, balance_after_spendable, balance_after_vault, notes
      ) VALUES ($1, $2, $3, 'rollback', $4, $5, 'system', $6, $7, $8)
    `, [
      wallet.id,
      wallet.user_id,
      b.id,
      accrued,
      accrued,
      wallet.spendable_balance,
      newVault,
      `Reversed ${accrued} accrued Trimurti Coins due to cancelled/rejected booking`,
    ]);
  }

  await dbClient.query(`
    UPDATE bookings
    SET coins_redeemed = 0, coins_discount_amount = 0, coins_accrued = 0, loyalty_status = 'rolled_back'
    WHERE id = $1
  `, [b.id]);
}

/**
 * Admin manual adjustment (gift bonus or deduction)
 */
async function adminManualAdjustment({ phone: rawPhone, coins, type, reason = '', adminId }) {
  const phone = normalizeTo10Digits(rawPhone);
  const amount = Number(coins);
  if (!amount || amount <= 0) throw new Error('Invalid coin amount');

  const wallet = await getOrCreateWallet(phone);
  const prevSpendable = Number(wallet.spendable_balance) || 0;
  const newSpendable = type === 'admin_bonus' 
    ? prevSpendable + amount 
    : Math.max(0, prevSpendable - amount);

  await pool.query(`
    UPDATE user_loyalty_wallets
    SET spendable_balance = $1,
        lifetime_earned = CASE WHEN $2 = 'admin_bonus' THEN lifetime_earned + $3 ELSE lifetime_earned END,
        updated_at = NOW()
    WHERE id = $4
  `, [newSpendable, type, amount, wallet.id]);

  await pool.query(`
    INSERT INTO loyalty_transactions (
      wallet_id, user_id, type, coins, inr_value,
      channel, balance_after_spendable, balance_after_vault, notes
    ) VALUES ($1, $2, $3, $4, $5, 'admin', $6, $7, $8)
  `, [
    wallet.id,
    wallet.user_id,
    type,
    amount,
    amount,
    newSpendable,
    wallet.vault_balance,
    `Admin ${type === 'admin_bonus' ? 'Bonus' : 'Deduction'}: ${reason || 'Staff adjustment'}`,
  ]);

  return { success: true, newSpendableBalance: newSpendable };
}

module.exports = {
  getLoyaltySettings,
  getOrCreateWallet,
  getWalletStatus,
  previewRedemption,
  accrueCoinsForBooking,
  applyRedemptionInTransaction,
  rollbackCoinsForBooking,
  adminManualAdjustment,
};
