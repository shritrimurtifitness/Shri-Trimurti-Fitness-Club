/**
 * Bank SMS Two-Way Matching Service for SHRI TRIMURTI FITNESS CLUB
 * Automatically matches Bank SMS credits with pending slot bookings and tournament registrations.
 *
 * Handles both arrival orders:
 * 1. Customer submits first -> Bank SMS arrives second (Auto-approved via SMS trigger)
 * 2. Bank SMS arrives first -> Customer submits second (Auto-approved on the spot during submission)
 */

const pool = require('../config/db');
const { parseBankSms } = require('./bankSmsParser');
const adminBookingService = require('./adminBookingService');
const { sendTextMessage } = require('./whatsapp');
const { getAdminNotificationPhones } = require('../utils/phone');

/**
 * Normalizes phone numbers for admin WhatsApp dispatch (supports multiple admins)
 */
function getAdminPhones() {
  return getAdminNotificationPhones();
}
function getAdminPhone() {
  return getAdminPhones()[0];
}

/**
 * Processes an incoming bank SMS received by the venue phone.
 * @param {Object} params
 * @param {string} params.rawSms - Raw SMS text body
 * @param {string} [params.sender] - SMS Sender ID (e.g. VK-SBIINB)
 * @param {Object} [params.io] - Socket.IO instance
 * @returns {Promise<{ success: boolean, matched: boolean, type?: string, id?: string, utr?: string, reason?: string }>}
 */
async function processIncomingBankSms({ rawSms, sender = '', io = null }) {
  if (!rawSms || typeof rawSms !== 'string') {
    return { success: false, matched: false, reason: 'Empty SMS content' };
  }

  // 1. Parse SMS using Hybrid Regex-First Engine
  const parsed = await parseBankSms(rawSms, sender);
  if (!parsed.success || !parsed.isCredit || !parsed.amount || !parsed.utr) {
    console.log(`[BANK SMS] Ignored non-credit or unparseable SMS from ${sender}: "${rawSms.substring(0, 60)}..."`);
    return { success: false, matched: false, reason: 'Not an actionable UPI credit SMS' };
  }

  const { amount, utr, last4, bank } = parsed;
  console.log(`[BANK SMS] Detected valid credit: ₹${amount} | UTR: ${utr} (${bank})`);

  // 2. Check if UTR was already processed
  const existingRes = await pool.query(
    'SELECT id, is_used, matched_booking_id, matched_registration_id FROM bank_sms_credits WHERE utr_number = $1',
    [utr]
  );

  if (existingRes.rows.length > 0 && existingRes.rows[0].is_used) {
    console.log(`[BANK SMS] UTR ${utr} was already used to confirm a booking previously.`);
    return { success: true, matched: true, duplicate: true, utr };
  }

  // 3. Store credit in bank_sms_credits ledger
  const upsertRes = await pool.query(
    `INSERT INTO bank_sms_credits (amount, utr_number, last4, raw_sms, sender)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (utr_number) DO UPDATE SET raw_sms = EXCLUDED.raw_sms
     RETURNING id, is_used`,
    [amount, utr, last4, rawSms, sender]
  );
  const creditRecordId = upsertRes.rows[0]?.id;

  // 4. Case A: Check for pending slot bookings (Customer submitted first)
  const bookingMatchRes = await pool.query(
    `SELECT b.id, b.user_id, b.slot_id, b.paid_amount, b.utr_number,
            u.name as customer_name, u.phone as customer_phone,
            t.name as turf_name, s.date, s.start_time, s.end_time
     FROM bookings b
     JOIN users u ON b.user_id = u.id
     JOIN slots s ON b.slot_id = s.id
     JOIN turfs t ON s.turf_id = t.id
     WHERE b.status = 'pending_verification'
       AND b.paid_amount = $1
       AND (b.utr_number = $2 OR $3 LIKE '%' || b.utr_number)
     ORDER BY b.created_at DESC
     LIMIT 1`,
    [amount, last4, utr]
  );

  if (bookingMatchRes.rows.length > 0) {
    const booking = bookingMatchRes.rows[0];
    const bookingCode = booking.id.substring(0, 8).toUpperCase();
    console.log(`[BANK SMS MATCH] Found pending booking #${bookingCode} for ₹${amount}. Auto-approving...`);

    // Auto-approve the booking
    const approveResult = await adminBookingService.approveBookingById({
      bookingId: booking.id,
      io,
      adminIdentifier: 'system_bank_sms',
    });

    if (approveResult.success) {
      // Mark credit as used
      await pool.query(
        'UPDATE bank_sms_credits SET is_used = TRUE, matched_booking_id = $1 WHERE id = $2',
        [booking.id, creditRecordId]
      );

      // Send confirmation alert to Admin personal WhatsApp(s)
      const adminPhones = getAdminPhones();
      const dateStr = typeof booking.date === 'string' ? booking.date.substring(0, 10) : new Date(booking.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const timeStr = `${booking.start_time.substring(0, 5)} - ${booking.end_time.substring(0, 5)}`;

      const adminAlert =
`⚡ *AUTO-APPROVED BY BANK SMS* 🏦

📋 *Booking ID:* #${bookingCode}
🏟️ *Facility:* ${booking.turf_name}
📅 *Date:* ${dateStr}
⏰ *Time:* ${timeStr}
👤 *Player:* ${booking.customer_name} (+91 ${booking.customer_phone})
💰 *Amount:* ₹${amount} (${bank})
💳 *Bank UTR:* ${utr} (Matched ending in *${last4}*)

✅ Player Gate Entry Pass QR code has been issued automatically. No action needed!`;

      for (const adminPhone of getAdminPhones()) {
        sendTextMessage({ to: adminPhone, text: adminAlert }).catch((err) =>
          console.error(`[BANK SMS ADMIN ALERT ERROR to ${adminPhone}]`, err.message)
        );
      }

      return {
        success: true,
        matched: true,
        type: 'slot_booking',
        id: booking.id,
        bookingCode,
        utr,
        amount,
      };
    }
  }

  // 5. Case B: Check for pending tournament registrations (Customer submitted first)
  const trnMatchRes = await pool.query(
    `SELECT tr.id, tr.tournament_id, tr.team_name, tr.captain_name, tr.phone as captain_phone, tr.utr_number,
            t.name as tournament_name, t.entry_fee
     FROM tournament_registrations tr
     JOIN tournaments t ON t.id = tr.tournament_id
     WHERE tr.payment_status = 'pending_verification'
       AND t.entry_fee = $1
       AND (tr.utr_number = $2 OR $3 LIKE '%' || tr.utr_number)
     ORDER BY tr.created_at DESC
     LIMIT 1`,
    [amount, last4, utr]
  );

  if (trnMatchRes.rows.length > 0) {
    const trn = trnMatchRes.rows[0];
    const regCode = trn.id.substring(0, 8).toUpperCase();
    console.log(`[BANK SMS MATCH] Found pending tournament team "${trn.team_name}" for ₹${amount}. Auto-approving...`);

    const approveResult = await adminBookingService.processTournamentRegistrationAction({
      registrationId: trn.id,
      action: 'approve',
      io,
      adminIdentifier: 'system_bank_sms',
    });

    if (approveResult.success) {
      await pool.query(
        'UPDATE bank_sms_credits SET is_used = TRUE, matched_registration_id = $1 WHERE id = $2',
        [trn.id, creditRecordId]
      );

      const adminPhones = getAdminPhones();
      const adminAlert =
`⚡ *TOURNAMENT REGISTRATION AUTO-APPROVED* 🏆🏦

🏆 *Tournament:* ${trn.tournament_name}
🏏 *Team Name:* ${trn.team_name}
👤 *Captain:* ${trn.captain_name} (+91 ${trn.captain_phone})
💰 *Entry Fee:* ₹${amount} (${bank})
💳 *Bank UTR:* ${utr} (Matched ending in *${last4}*)

✅ Team Confirmation Pass issued automatically to Captain!`;

      for (const adminPhone of getAdminPhones()) {
        sendTextMessage({ to: adminPhone, text: adminAlert }).catch((err) =>
          console.error(`[BANK SMS TRN ADMIN ALERT ERROR to ${adminPhone}]`, err.message)
        );
      }

      return {
        success: true,
        matched: true,
        type: 'tournament_registration',
        id: trn.id,
        regCode,
        utr,
        amount,
      };
    }
  }

  // 6. Case C: No pending booking found yet -> Held in bank_sms_credits for 30 minutes
  console.log(`[BANK SMS] Credit ₹${amount} (UTR: ${utr}) stored in ledger. Holding for customer submission...`);
  return {
    success: true,
    matched: false,
    heldForCustomerSubmission: true,
    utr,
    last4,
    amount,
    bank,
  };
}

/**
 * Checks if an unused bank credit exists for a submitted UTR / amount.
 * Called during customer booking submission (Web or WhatsApp) to allow ON-THE-SPOT approval.
 * @param {Object} params
 * @param {number} params.amount - Required booking price in ₹
 * @param {string} params.utr - Customer-entered UTR (full or last 4 digits)
 * @returns {Promise<{ matched: boolean, credit?: Object }>}
 */
async function checkCachedBankCreditForUtr({ amount, utr }) {
  if (!amount || !utr) return { matched: false };

  const cleanUtr = String(utr).trim();
  const digits = cleanUtr.replace(/\D/g, '');
  const last4 = digits.length >= 4 ? digits.slice(-4) : digits;

  try {
    const res = await pool.query(
      `SELECT id, utr_number, last4, amount, sender, created_at
       FROM bank_sms_credits
       WHERE amount = $1
         AND (utr_number = $2 OR last4 = $3 OR utr_number LIKE '%' || $3)
         AND is_used = FALSE
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [amount, cleanUtr, last4]
    );

    if (res.rows.length > 0) {
      return {
        matched: true,
        credit: res.rows[0],
      };
    }
  } catch (err) {
    console.error('[CHECK CACHED BANK CREDIT ERROR]', err.message);
  }

  return { matched: false };
}

/**
 * Marks a cached bank credit as used by a confirmed booking.
 * @param {string} creditId
 * @param {string} bookingId
 */
async function claimCachedCreditForBooking(creditId, bookingId) {
  try {
    await pool.query(
      'UPDATE bank_sms_credits SET is_used = TRUE, matched_booking_id = $1 WHERE id = $2',
      [bookingId, creditId]
    );
  } catch (err) {
    console.error('[CLAIM CACHED CREDIT ERROR]', err.message);
  }
}

/**
 * Marks a cached bank credit as used by a confirmed tournament registration.
 * @param {string} creditId
 * @param {string} registrationId
 */
async function claimCachedCreditForTournament(creditId, registrationId) {
  try {
    await pool.query(
      'UPDATE bank_sms_credits SET is_used = TRUE, matched_registration_id = $1 WHERE id = $2',
      [registrationId, creditId]
    );
  } catch (err) {
    console.error('[CLAIM CACHED CREDIT TRN ERROR]', err.message);
  }
}

module.exports = {
  processIncomingBankSms,
  checkCachedBankCreditForUtr,
  claimCachedCreditForBooking,
  claimCachedCreditForTournament,
};
