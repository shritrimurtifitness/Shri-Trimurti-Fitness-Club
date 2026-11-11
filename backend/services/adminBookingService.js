const crypto = require('crypto');
const pool = require('../config/db');
const cache = require('../config/cache');
const mailer = require('../utils/mailer');
const whatsappService = require('./whatsapp');
const notificationScheduler = require('./notificationScheduler');

const DEFAULT_ADMIN_PHONE = '917083738373';

/**
 * Generates an HMAC-SHA256 token for 1-tap admin action links
 */
function generateAdminActionToken(bookingId, action) {
  const secret = process.env.JWT_SECRET || 'shri-trimurti-fitness-admin-secret';
  return crypto.createHmac('sha256', secret).update(`${bookingId}:${action}`).digest('hex');
}

/**
 * Verifies the HMAC-SHA256 token securely
 */
function verifyAdminActionToken(bookingId, action, token) {
  if (!bookingId || !action || !token) return false;
  try {
    const expected = generateAdminActionToken(bookingId, action);
    const expectedBuf = Buffer.from(expected);
    const tokenBuf = Buffer.from(String(token));
    if (expectedBuf.length !== tokenBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, tokenBuf);
  } catch {
    return false;
  }
}

/**
 * Validates if the given phone number belongs to an authorized club administrator
 */
async function isAuthorizedAdmin(phone) {
  if (!phone) return false;
  const rawPhone = String(phone).replace(/\D/g, '');
  const cleanPhone = rawPhone.length === 10 ? '91' + rawPhone : rawPhone;
  const phone10 = rawPhone.length === 12 && rawPhone.startsWith('91') ? rawPhone.substring(2) : rawPhone;

  const configuredAdmin = (process.env.ADMIN_NOTIFICATION_PHONE || DEFAULT_ADMIN_PHONE).replace(/\D/g, '');
  const configuredAdmin10 = configuredAdmin.length === 12 && configuredAdmin.startsWith('91') 
    ? configuredAdmin.substring(2) 
    : configuredAdmin;

  if (cleanPhone === configuredAdmin || phone10 === configuredAdmin10) {
    return true;
  }

  try {
    const dbAdmin = await pool.query(
      "SELECT id FROM users WHERE (phone = $1 OR phone = $2) AND role IN ('admin', 'staff')",
      [cleanPhone, phone10]
    );
    return dbAdmin.rows.length > 0;
  } catch (err) {
    console.error('[IS ADMIN CHECK ERROR]', err.message);
    return false;
  }
}

/**
 * Sends a real-time WhatsApp alert to the Admin's personal number with interactive buttons
 * and 1-tap secure approval links
 */
async function notifyAdminNewBooking({ bookingId, io }) {
  try {
    const query = `
      SELECT b.*, u.name as customer_name, u.phone as customer_phone, u.email as customer_email,
             s.date, s.start_time, s.end_time, t.name as turf_name, t.facility_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN turfs t ON s.turf_id = t.id
      WHERE b.id = $1
    `;
    const res = await pool.query(query, [bookingId]);
    if (res.rows.length === 0) return { success: false, error: 'Booking not found' };

    const b = res.rows[0];
    const adminPhone = (process.env.ADMIN_NOTIFICATION_PHONE || DEFAULT_ADMIN_PHONE).replace(/\D/g, '');
    const bookingCode = b.id.substring(0, 8).toUpperCase();
    const turfName = b.turf_name || (b.facility_type === 'football' ? 'Football Turf' : 'Cricket Turf');
    const dateStr = typeof b.date === 'string' ? b.date.substring(0, 10) : new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const timeStr = `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`;
    const amount = Number(b.paid_amount) || 800;
    const utr = b.utr_number || 'N/A';

    // Generate 1-tap HMAC approval tokens
    const approveToken = generateAdminActionToken(b.id, 'approve');
    const rejectToken = generateAdminActionToken(b.id, 'reject');
    const baseUrl = process.env.FRONTEND_URL || 'https://shritrimurtifitnessclub.in';
    const approveUrl = `${baseUrl}/api/bookings/quick-verify?id=${b.id}&action=approve&token=${approveToken}`;
    const rejectUrl = `${baseUrl}/api/bookings/quick-verify?id=${b.id}&action=reject&token=${rejectToken}`;

    const adminAlertText =
`🚨 *NEW BOOKING ALERT — PENDING APPROVAL*

📋 *Booking ID:* #${bookingCode}
🏟️ *Facility:* ${turfName}
📅 *Date:* ${dateStr}
⏰ *Time:* ${timeStr}
👤 *Player Name:* ${b.customer_name}
📞 *Player Phone:* +${b.customer_phone || 'N/A'}
💰 *Amount Due:* ₹${amount}

💳 *Submitted UTR Reference:*
👉 *${utr}*

──────────────────────
⚡ *1-TAP ACTION LINKS:*
✅ *Approve:* ${approveUrl}
❌ *Reject:* ${rejectUrl}`;

    // Attempt interactive buttons first
    let sendResult = await whatsappService.sendInteractiveButtons({
      to: adminPhone,
      headerText: 'Shri Trimurti Fitness Club',
      bodyText: adminAlertText,
      buttons: [
        { id: `BTN_ADMIN_APPROVE_${b.id}`, title: '✅ Approve Payment' },
        { id: `BTN_ADMIN_REJECT_${b.id}`, title: '❌ Reject Payment' },
      ],
    });

    // Fall back to plain text if buttons fail
    if (!sendResult.success) {
      sendResult = await whatsappService.sendTextMessage({
        to: adminPhone,
        text: adminAlertText,
      });
    }

    if (io) {
      io.emit('booking_updated');
    }

    return { success: true, bookingCode, adminPhone };
  } catch (err) {
    console.error('[NOTIFY ADMIN ERROR]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Approves a booking by ID (used by Dashboard, WhatsApp Buttons, and 1-Tap Link)
 */
async function approveBookingById({ bookingId, io, adminIdentifier = 'admin' }) {
  try {
    const query = `
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             s.date, s.start_time, s.end_time, t.name as turf_name, t.facility_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN turfs t ON s.turf_id = t.id
      WHERE b.id = $1
    `;
    const res = await pool.query(query, [bookingId]);
    if (res.rows.length === 0) {
      return { success: false, message: 'Booking not found' };
    }

    const b = res.rows[0];
    const bookingCode = b.id.substring(0, 8).toUpperCase();
    const turfName = b.turf_name || (b.facility_type === 'football' ? 'Football Turf' : 'Cricket Turf');
    const dateFormatted = typeof b.date === 'string' ? b.date.substring(0, 10) : new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const slotTime = `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`;
    const amount = Number(b.paid_amount) || 800;

    if (b.status === 'confirmed') {
      return {
        success: true,
        alreadyProcessed: true,
        bookingCode,
        customerName: b.customer_name,
        turfName,
        dateStr: dateFormatted,
        timeStr: slotTime,
        amount,
        message: `Booking #${bookingCode} has already been approved previously.`,
      };
    }

    // 1. Update Booking Status
    await pool.query(`
      UPDATE bookings 
      SET status = 'confirmed', payment_status = 'paid', remaining_amount = 0
      WHERE id = $1
    `, [b.id]);

    // 2. Insert settled payment entry
    try {
      await pool.query(`
        INSERT INTO payments (booking_id, amount, method, is_settled)
        VALUES ($1, $2, 'upi_qr', true)
      `, [b.id, amount]);
    } catch {}

    // 3. Send WhatsApp Confirmation Entry Pass to Customer
    if (b.customer_phone) {
      whatsappService.sendBookingConfirmationTicket({
        phone: b.customer_phone,
        bookingId: bookingCode,
        turfName,
        date: dateFormatted,
        slots: [slotTime],
        totalAmount: amount,
        utrNumber: b.utr_number,
      }).catch(err => console.error('[WHATSAPP CONFIRM ERROR]', err.message));
    }

    // 4. Send Confirmation Email to Customer (if email on file)
    if (b.customer_email) {
      mailer.sendBookingConfirmed({
        email: b.customer_email,
        name: b.customer_name,
        bookingId: bookingCode,
        turfName,
        date: dateFormatted,
        slots: [slotTime],
        totalAmount: amount,
      }).catch(err => console.error('[MAILER ERROR on confirm]', err.message));
    }

    // 5. Schedule Automated 2-Hour Reminder and Post-Match Review Survey
    notificationScheduler.scheduleBookingNotifications({
      id: b.id,
      customer_phone: b.customer_phone,
      customer_name: b.customer_name,
      turf_name: turfName,
      date: b.date,
      start_time: b.start_time,
      end_time: b.end_time,
      reminder_sent_at: b.reminder_sent_at,
      feedback_sent_at: b.feedback_sent_at,
    });

    // 6. Clear Redis Cache & Notify Web Sockets
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');

    if (io) {
      io.emit('booking_updated');
    }

    console.log(`[ADMIN APPROVAL] Booking #${bookingCode} approved by ${adminIdentifier}`);

    return {
      success: true,
      bookingCode,
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      turfName,
      dateStr: dateFormatted,
      timeStr: slotTime,
      amount,
      utr: b.utr_number,
      message: `Booking #${bookingCode} approved successfully! Entry pass delivered to player.`,
    };
  } catch (err) {
    console.error('[APPROVE BOOKING ERROR]', err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

/**
 * Rejects a booking by ID (used by Dashboard, WhatsApp Buttons, and 1-Tap Link)
 */
async function rejectBookingById({ bookingId, io, adminIdentifier = 'admin', reason = 'Payment could not be verified' }) {
  try {
    const query = `
      SELECT b.*, u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             s.date, s.start_time, s.end_time, t.name as turf_name, t.facility_type
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN turfs t ON s.turf_id = t.id
      WHERE b.id = $1
    `;
    const res = await pool.query(query, [bookingId]);
    if (res.rows.length === 0) {
      return { success: false, message: 'Booking not found' };
    }

    const b = res.rows[0];
    const bookingCode = b.id.substring(0, 8).toUpperCase();
    const turfName = b.turf_name || (b.facility_type === 'football' ? 'Football Turf' : 'Cricket Turf');
    const dateFormatted = typeof b.date === 'string' ? b.date.substring(0, 10) : new Date(b.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const slotTime = `${b.start_time.substring(0, 5)} - ${b.end_time.substring(0, 5)}`;

    if (b.status === 'rejected') {
      return {
        success: true,
        alreadyProcessed: true,
        bookingCode,
        message: `Booking #${bookingCode} is already marked as rejected.`,
      };
    }

    // 1. Update DB
    await pool.query(`
      UPDATE bookings 
      SET status = 'rejected', payment_status = 'failed'
      WHERE id = $1
    `, [b.id]);

    notificationScheduler.cancelBookingNotifications(b.id);

    // 2. Notify customer via WhatsApp
    if (b.customer_phone) {
      const rejectMsg =
`⚠️ *Shri Trimurti Fitness Club Update*

Hi ${b.customer_name}, we were unable to verify your UPI transfer (UTR: ${b.utr_number || 'N/A'}) for booking *#${bookingCode}* (${turfName}, ${dateFormatted} at ${slotTime}).

If you have already paid or if this was an error, please call our club desk immediately at 📞 +91 9595153006 to resolve it.`;

      whatsappService.sendTextMessage({ to: b.customer_phone, text: rejectMsg }).catch(() => {});
    }

    // 2b. Notify customer via Email if exists
    if (b.customer_email) {
      mailer.sendBookingRejected({
        email: b.customer_email,
        name: b.customer_name,
        bookingId: bookingCode,
        turfName,
        date: dateFormatted,
        reason,
      }).catch(err => console.error('[MAILER ERROR on reject]', err));
    }

    // 3. Clear Redis Cache & Notify Web Sockets
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');

    if (io) {
      io.emit('booking_updated');
    }

    console.log(`[ADMIN REJECTION] Booking #${bookingCode} rejected by ${adminIdentifier}`);

    return {
      success: true,
      bookingCode,
      customerName: b.customer_name,
      turfName,
      dateStr: dateFormatted,
      timeStr: slotTime,
      message: `Booking #${bookingCode} rejected and slot released.`,
    };
  } catch (err) {
    console.error('[REJECT BOOKING ERROR]', err);
    return { success: false, message: 'Server error: ' + err.message };
  }
}

/**
 * Renders a responsive, modern HTML page for 1-Tap browser clicks
 */
function renderAdminResultHtml({ success, alreadyProcessed, bookingCode, customerName, turfName, dateStr, timeStr, amount, utr, message }) {
  const isApproved = success && !message?.includes('rejected');
  const accentColor = isApproved ? '#10b981' : '#ef4444';
  const badgeText = isApproved ? 'CONFIRMED & ENTRY PASS DELIVERED' : 'REJECTED';
  const badgeBg = isApproved ? '#064e3b' : '#7f1d1d';
  const badgeColor = isApproved ? '#34d399' : '#f87171';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Booking Verification — Shri Trimurti Fitness Club</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #090d16; color: #f8fafc; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.25rem; }
    .card { background: #111827; border: 1px solid #1f2937; border-radius: 1.25rem; max-width: 440px; width: 100%; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); text-align: center; }
    .icon-badge { width: 4.5rem; height: 4.5rem; border-radius: 50%; background: ${badgeBg}; color: ${accentColor}; display: inline-flex; align-items: center; justify-content: center; font-size: 2.25rem; margin-bottom: 1.25rem; border: 2px solid ${accentColor}; }
    h1 { font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem; color: #ffffff; }
    .status-pill { display: inline-block; font-size: 0.7rem; font-weight: 800; letter-spacing: 0.08em; padding: 0.35rem 0.85rem; border-radius: 9999px; background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${accentColor}; margin-bottom: 1.25rem; }
    .details { background: #1a2234; border: 1px solid #28334e; border-radius: 0.85rem; padding: 1.2rem; text-align: left; margin: 1.25rem 0; font-size: 0.875rem; }
    .row { display: flex; justify-content: space-between; padding: 0.35rem 0; }
    .label { color: #94a3b8; }
    .value { font-weight: 700; color: #ffffff; }
    .utr-val { font-family: monospace; color: #fbbf24; font-weight: bold; }
    .desc { font-size: 0.8rem; color: #94a3b8; line-height: 1.5; margin-bottom: 1.5rem; }
    .btn { display: block; width: 100%; padding: 0.85rem; background: #22c55e; color: #052e16; font-weight: 800; font-size: 0.875rem; border-radius: 0.75rem; text-decoration: none; transition: background 0.2s; }
    .btn:hover { background: #16a34a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-badge">${isApproved ? '✓' : '✕'}</div>
    <h1>${isApproved ? 'Booking Payment Approved!' : 'Booking Rejected'}</h1>
    <span class="status-pill">${badgeText}</span>
    
    ${bookingCode ? `
    <div class="details">
      <div class="row"><span class="label">Booking ID:</span><span class="value">#${bookingCode}</span></div>
      <div class="row"><span class="label">Facility:</span><span class="value">${turfName || 'Turf'}</span></div>
      <div class="row"><span class="label">Date:</span><span class="value">${dateStr || ''}</span></div>
      <div class="row"><span class="label">Time:</span><span class="value">${timeStr || ''}</span></div>
      <div class="row"><span class="label">Player:</span><span class="value">${customerName || ''}</span></div>
      ${amount ? `<div class="row"><span class="label">Amount:</span><span class="value">₹${amount}</span></div>` : ''}
      ${utr ? `<div class="row"><span class="label">UTR:</span><span class="utr-val">${utr}</span></div>` : ''}
    </div>` : ''}

    <p class="desc">${message || (isApproved ? 'The player has been automatically issued their official Digital Entry Pass with QR code on WhatsApp.' : 'The slot has been released back to availability.')}</p>

    <a href="https://shritrimurtifitnessclub.in/admin/bookings" class="btn">Open Admin Dashboard</a>
  </div>
</body>
</html>`;
}

module.exports = {
  DEFAULT_ADMIN_PHONE,
  generateAdminActionToken,
  verifyAdminActionToken,
  isAuthorizedAdmin,
  notifyAdminNewBooking,
  approveBookingById,
  rejectBookingById,
  renderAdminResultHtml,
};
