const pool = require('../config/db');
const cache = require('../config/cache');
const {
  sendTextMessage,
  sendImageMessage,
  sendInteractiveButtons,
  sendInteractiveList,
} = require('./whatsapp');
const adminBookingService = require('./adminBookingService');

// In-memory session tracking for WhatsApp booking flow
// Key: phone number -> { state, slotId, turfId, turfName, date, timeStr, price, userName, createdAt }
const userBookingSessions = new Map();
const SESSION_TTL_MS = 20 * 60 * 1000; // 20 minutes reservation hold

function getBookingSession(phone) {
  const session = userBookingSessions.get(phone);
  if (!session) return null;
  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    userBookingSessions.delete(phone);
    return null;
  }
  return session;
}

function setBookingSession(phone, data) {
  userBookingSessions.set(phone, {
    ...data,
    createdAt: Date.now(),
  });
}

function clearBookingSession(phone) {
  userBookingSessions.delete(phone);
}

// In-memory session tracking for post-match feedback comments
// Key: phone number -> { bookingId, createdAt }
const userFeedbackSessions = new Map();
const FEEDBACK_TTL_MS = 60 * 60 * 1000; // 1 hour comment response window

/**
 * Returns today's date formatted as YYYY-MM-DD in Asia/Kolkata timezone
 */
function getTodayString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/**
 * Formats 24h time string (e.g. "18:00:00") into 12h time (e.g. "6:00 PM")
 */
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hour = parseInt(h, 10);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${m} ${meridiem}`;
}

/**
 * Queries Neon DB for available slots today for a given facility type ('cricket' | 'football')
 */
async function getTodayAvailableSlots(facilityType = 'cricket') {
  try {
    const today = getTodayString();
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

    // 1. Check if arena or turf is closed today
    const closureCheck = await pool.query(
      'SELECT reason FROM arena_closures WHERE date = $1',
      [today]
    );
    if (closureCheck.rows.length > 0) {
      return {
        isClosed: true,
        reason: closureCheck.rows[0].reason || 'Arena closed for maintenance',
        slots: [],
      };
    }

    // 2. Fetch turf info
    const turfRes = await pool.query(
      `SELECT id, name, facility_type, physical_resource_id FROM turfs WHERE facility_type ILIKE $1 AND is_active = true LIMIT 1`,
      [`%${facilityType}%`]
    );

    if (turfRes.rows.length === 0) {
      return { isClosed: false, slots: [], facilityName: 'Turf' };
    }

    const turf = turfRes.rows[0];

    // 3. Ensure slots are generated for today
    try {
      await pool.query('SELECT generate_daily_slots($1, $2)', [today, turf.id]);
    } catch {
      // Ignore if function not available or slots already populated
    }

    // 4. Query vacant slots for today that have not passed current time
    // Accounts for shared physical resources (e.g. Cricket & Football sharing the same turf)
    const query = `
      SELECT s.id, s.start_time, s.end_time, s.price, s.date
      FROM slots s
      JOIN turfs t ON s.turf_id = t.id
      WHERE s.turf_id = $1
        AND s.date = $2
        AND s.is_available = true
        AND s.end_time > $3
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          JOIN slots s_other ON b.slot_id = s_other.id
          JOIN turfs t_other ON s_other.turf_id = t_other.id
          WHERE b.status NOT IN ('cancelled', 'rejected')
            AND s_other.date = s.date
            AND s_other.start_time = s.start_time
            AND (
              s_other.id = s.id
              OR (t.physical_resource_id IS NOT NULL AND t.physical_resource_id = t_other.physical_resource_id)
            )
        )
      ORDER BY s.start_time ASC
      LIMIT 10
    `;

    const slotsRes = await pool.query(query, [turf.id, today, nowIST]);

    const formattedSlots = slotsRes.rows.map((row) => {
      const price = parseInt(row.price, 10) || 800;
      const timeLabel = `${formatTime12h(row.start_time)} - ${formatTime12h(row.end_time)}`;
      return {
        id: row.id,
        start_time: row.start_time,
        end_time: row.end_time,
        price,
        timeLabel,
        label: `${timeLabel} (₹${price})`,
      };
    });

    return {
      isClosed: false,
      turfId: turf.id,
      facilityName: turf.name || (facilityType === 'football' ? 'Football Turf' : 'Cricket Turf'),
      slots: formattedSlots,
    };
  } catch (err) {
    console.error('Error fetching today available slots for bot:', err.message);
    return { isClosed: false, slots: [], error: true };
  }
}

/**
 * Initiates the Slot Booking & UPI QR Payment flow
 */
async function initiateSlotBooking({ from, slotId, userName = '' }) {
  try {
    const slotRes = await pool.query(`
      SELECT s.id, s.turf_id, s.date, s.start_time, s.end_time, s.price, s.is_available,
             t.name as turf_name, t.facility_type, t.physical_resource_id
      FROM slots s
      JOIN turfs t ON s.turf_id = t.id
      WHERE s.id = $1
    `, [slotId]);

    if (slotRes.rows.length === 0) {
      return sendTextMessage({
        to: from,
        text: '⚠️ Selected slot could not be found. Please check available slots again.',
      });
    }

    const slot = slotRes.rows[0];

    // Ensure slot is not in the past
    const todayIST = getTodayString();
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    const slotDateStr = typeof slot.date === 'string'
      ? slot.date.substring(0, 10)
      : new Date(slot.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    if (slotDateStr < todayIST || (slotDateStr === todayIST && slot.start_time <= nowIST)) {
      return sendTextMessage({
        to: from,
        text: `⚠️ Slot ${formatTime12h(slot.start_time)} on ${slotDateStr} has already passed. Please choose an upcoming slot!`,
      });
    }

    // Ensure slot doesn't conflict with existing booking
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
      return sendInteractiveButtons({
        to: from,
        headerText: 'Slot Already Reserved',
        bodyText: `⚠️ The ${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)} slot was just booked by another player.\n\nWould you like to check remaining slots?`,
        buttons: [
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
          { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
          { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
        ],
      });
    }

    const price = Number(slot.price) || 800;
    const turfName = slot.turf_name || (slot.facility_type === 'football' ? 'Football Turf' : 'Cricket Turf');
    const timeStr = `${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)}`;

    // Save active session
    setBookingSession(from, {
      state: 'AWAITING_PAYMENT',
      slotId: slot.id,
      turfId: slot.turf_id,
      turfName,
      date: slotDateStr,
      timeStr,
      price,
      userName: userName || '',
    });

    const upiId = process.env.UPI_ID || 'harshvardhanp@slc';
    const qrUrl = process.env.UPI_QR_URL
      ? (process.env.UPI_QR_URL.startsWith('http') ? process.env.UPI_QR_URL : `https://shritrimurtifitnessclub.in${process.env.UPI_QR_URL}`)
      : 'https://shritrimurtifitnessclub.in/upi-qr.png';
    const upiPayLink = `upi://pay?pa=${upiId}&pn=Shri%20Trimurti%20Sports%20Arena&am=${price}&cu=INR&tn=TRM-${slotDateStr.replace(/-/g, '')}`;

    // 1. Send the UPI QR code image
    await sendImageMessage({
      to: from,
      imageUrl: qrUrl,
      caption: `📲 Scan to Pay ₹${price} for ${turfName}\n⏰ Slot: ${timeStr} (${slotDateStr})`,
    });

    // 2. Send detailed payment instructions & cancel button
    const paymentInstructions =
`📋 *RESERVATION SUMMARY (HELD FOR 15 MINS)*
🏟️ *Turf:* ${turfName}
📅 *Date:* ${slotDateStr}
⏰ *Time:* ${timeStr}
💰 *Payable Amount:* *₹${price}*

💳 *HOW TO PAY VIA UPI (0% FEE):*
1. Scan the QR code image above with Google Pay, PhonePe, or Paytm.
2. Or transfer directly to UPI ID:
👉 *${upiId}*
3. Mobile 1-Tap UPI Link:
👉 ${upiPayLink}

📝 *NEXT STEP TO CONFIRM:*
After completing the payment, reply directly with your *12-digit UPI Reference / UTR Number* (e.g. \`431289012345\`) or upload your payment screenshot!

_Tap Cancel below if you change your mind._`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Payment Details',
      bodyText: paymentInstructions,
      buttons: [
        { id: 'BTN_CANCEL_BOOKING', title: '❌ Cancel Booking' },
        { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
      ],
    });
  } catch (err) {
    console.error('[INITIATE BOOKING ERROR]', err);
    return sendTextMessage({
      to: from,
      text: '⚠️ Something went wrong while reserving the slot. Please try again or call +91 9595153006.',
    });
  }
}

/**
 * Handles UTR Number submission and creates the pending booking in Neon DB
 */
async function handleUtrSubmission({ from, utr, session, io, userName = '' }) {
  try {
    const cleanUtr = String(utr).trim();

    if (cleanUtr.length < 6) {
      return sendTextMessage({
        to: from,
        text: '⚠️ Please enter a valid 12-digit UPI Reference / UTR Number (found on your payment receipt in GPay, PhonePe, or Paytm).',
      });
    }

    // Check duplicate UTR
    const dupRes = await pool.query(
      "SELECT id FROM bookings WHERE utr_number = $1 AND status NOT IN ('cancelled', 'rejected')",
      [cleanUtr]
    );
    if (dupRes.rows.length > 0) {
      return sendInteractiveButtons({
        to: from,
        headerText: 'Duplicate UTR Number',
        bodyText: `⚠️ The UPI Reference (*${cleanUtr}*) has already been submitted for another booking.\n\nPlease check your receipt or contact our desk if this is an error.`,
        buttons: [
          { id: 'BTN_STAFF', title: '👤 Call Staff' },
          { id: 'BTN_CANCEL_BOOKING', title: '❌ Cancel' },
        ],
      });
    }

    // Double-check slot is still free
    const conflictRes = await pool.query(`
      SELECT b.id FROM bookings b
      JOIN slots sc ON b.slot_id = sc.id
      JOIN turfs tc ON sc.turf_id = tc.id
      WHERE b.status NOT IN ('cancelled', 'rejected')
      AND sc.id = $1
    `, [session.slotId]);

    if (conflictRes.rows.length > 0) {
      clearBookingSession(from);
      return sendInteractiveButtons({
        to: from,
        headerText: 'Slot Conflict',
        bodyText: `⚠️ Apologies! This slot was booked right before your UTR was received.\n\nPlease contact our arena manager to assign you another slot or issue an immediate refund.`,
        buttons: [
          { id: 'BTN_STAFF', title: '👤 Call Manager' },
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Other Slots' },
        ],
      });
    }

    // Find or create user
    const customerPhone = String(from).replace(/\D/g, '');
    let userRes = await pool.query('SELECT id, name FROM users WHERE phone = $1', [customerPhone]);
    let userId;
    if (userRes.rows.length === 0) {
      const newUser = await pool.query(
        'INSERT INTO users (name, phone, role) VALUES ($1, $2, $3) RETURNING id',
        [session.userName || userName || 'WhatsApp Player', customerPhone, 'user']
      );
      userId = newUser.rows[0].id;
    } else {
      userId = userRes.rows[0].id;
    }

    // Insert booking into Neon DB with status = 'pending_verification'
    const bookingRes = await pool.query(`
      INSERT INTO bookings (
        user_id, slot_id, status, payment_status, paid_amount, remaining_amount,
        is_manual, payment_mode, utr_number
      ) VALUES ($1, $2, 'pending_verification', 'pending', $3, 0, false, 'upi_qr', $4)
      RETURNING *
    `, [userId, session.slotId, session.price, cleanUtr]);

    const createdBooking = bookingRes.rows[0];
    const bookingIdCode = createdBooking.id.substring(0, 8).toUpperCase();

    // Clear session
    clearBookingSession(from);

    // Invalidate caches & notify connected admin clients
    await cache.delPattern('bookings:*');
    await cache.delPattern('slots:*');
    await cache.del('admin:stats');

    if (io) {
      io.emit('booking_updated');
    }

    // Notify Admin's personal WhatsApp in real-time
    adminBookingService.notifyAdminNewBooking({
      bookingId: bookingRes.rows[0].id,
      io,
    }).catch(err => console.error('[NOTIFY ADMIN ON BOT BOOKING ERROR]', err));

    const successMsg =
`🎉 *BOOKING REQUEST SUBMITTED!*

📋 *Booking ID:* #${bookingIdCode}
🏟️ *Facility:* ${session.turfName}
📅 *Date:* ${session.date}
⏰ *Time:* ${session.timeStr}
💰 *Amount Paid:* ₹${session.price}
💳 *UTR Reference:* ${cleanUtr}

⏳ *Status:* *Pending Admin Verification*
Our turf manager has received your booking and is verifying the payment in our bank account.

🎟️ *What happens next?*
Once verified, you will automatically receive your official *Digital Entry Pass* with check-in instructions right here on WhatsApp!

📍 *Turf Location:* Kudire Factory, Sangrul Fata, Koparde
📞 *Helpdesk:* +91 9595153006`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Shri Trimurti Fitness Club',
      bodyText: successMsg,
      buttons: [
        { id: 'BTN_LOCATION', title: '📍 Directions' },
        { id: 'BTN_STAFF', title: '👤 Contact Desk' },
      ],
    });
  } catch (err) {
    console.error('[HANDLE UTR SUBMISSION ERROR]', err);
    return sendTextMessage({
      to: from,
      text: '⚠️ Error submitting your UPI payment. Please contact our desk directly at +91 9595153006.',
    });
  }
}

/**
 * Main intent router for incoming WhatsApp messages
 * @param {Object} args
 * @param {string} args.from - Customer WhatsApp phone number
 * @param {string} [args.text] - Plain text content
 * @param {string} [args.buttonPayload] - ID of clicked interactive button
 * @param {string} [args.userName] - WhatsApp profile name
 * @param {Object} [args.io] - Socket.IO instance
 */
async function handleIncomingMessage({ from, text = '', buttonPayload = '', userName = '', io = null }) {
  const normalizedText = (text || '').trim().toLowerCase();
  const payload = buttonPayload || '';

  // ----------------------------------------------------
  // Post-Match Feedback: 5-Star Rating Click
  // ----------------------------------------------------
  if (payload.startsWith('BTN_FEEDBACK_5STAR_')) {
    const bookingId = payload.replace('BTN_FEEDBACK_5STAR_', '').trim();
    try {
      await pool.query(
        `UPDATE bookings SET feedback_rating = 5 WHERE id = $1`,
        [bookingId]
      );
    } catch (dbErr) {
      console.error('[FEEDBACK 5-STAR ERROR]', dbErr.message);
    }

    let reviewUrl = process.env.GOOGLE_REVIEW_URL;
    if (!reviewUrl) {
      try {
        const sRes = await pool.query('SELECT google_maps_url FROM site_settings LIMIT 1');
        if (sRes.rows.length > 0 && sRes.rows[0].google_maps_url) {
          reviewUrl = sRes.rows[0].google_maps_url;
        }
      } catch {}
    }
    if (!reviewUrl) {
      reviewUrl = 'https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde';
    }

    const reviewMsg =
`Thank you so much! 🙌 We're thrilled your squad enjoyed the session!

Could you please take 15 seconds to tap below and leave us a quick 5-star review on Google? It really helps other local teams find our arena:

⭐⭐⭐⭐⭐
👉 ${reviewUrl}

Looking forward to hosting your squad again soon! 🏏⚽🔥`;

    return sendTextMessage({
      to: from,
      text: reviewMsg,
    });
  }

  // ----------------------------------------------------
  // Post-Match Feedback: Suggest Improvement Click
  // ----------------------------------------------------
  if (payload.startsWith('BTN_FEEDBACK_IMPROVE_')) {
    const bookingId = payload.replace('BTN_FEEDBACK_IMPROVE_', '').trim();
    try {
      await pool.query(
        `UPDATE bookings SET feedback_rating = 3 WHERE id = $1`,
        [bookingId]
      );
    } catch (dbErr) {
      console.error('[FEEDBACK IMPROVE ERROR]', dbErr.message);
    }

    userFeedbackSessions.set(from, { bookingId, createdAt: Date.now() });

    const improveMsg =
`Thank you for letting us know! 🙏

Our management team is dedicated to keeping the pitch, lighting, and facilities in championship condition.

Please reply directly with your thoughts, suggestions, or anything we can improve!

Our turf manager is also reachable directly at 📞 +91 9595153006.`;

    return sendTextMessage({
      to: from,
      text: improveMsg,
    });
  }

  // ----------------------------------------------------
  // Post-Match Feedback: Capture Typed User Feedback Comment
  // ----------------------------------------------------
  const feedbackSession = userFeedbackSessions.get(from);
  if (feedbackSession && !payload && text.trim().length > 1) {
    if (Date.now() - feedbackSession.createdAt < FEEDBACK_TTL_MS) {
      const comment = text.trim();
      try {
        await pool.query(
          `UPDATE bookings SET feedback_comment = $1 WHERE id = $2`,
          [comment, feedbackSession.bookingId]
        );
        if (io) {
          io.emit('feedback_received', { bookingId: feedbackSession.bookingId, comment });
        }
      } catch (err) {
        console.error('[FEEDBACK COMMENT DB ERROR]', err.message);
      }
      userFeedbackSessions.delete(from);

      return sendTextMessage({
        to: from,
        text: `Thank you for sharing your valuable feedback! 🙏 Our management team has noted this down and will address it promptly. We look forward to welcoming you back! 🏏⚽`,
      });
    } else {
      userFeedbackSessions.delete(from);
    }
  }

  // ----------------------------------------------------
  // Admin In-Chat Action: Approve or Reject Booking
  // ----------------------------------------------------
  if (payload.startsWith('BTN_ADMIN_APPROVE_') || payload.startsWith('BTN_ADMIN_REJECT_')) {
    const isApprove = payload.startsWith('BTN_ADMIN_APPROVE_');
    const targetBookingId = payload.replace(isApprove ? 'BTN_ADMIN_APPROVE_' : 'BTN_ADMIN_REJECT_', '').trim();
    const cleanFrom = from.replace(/\D/g, '');

    const isAdmin = await adminBookingService.isAuthorizedAdmin(cleanFrom);
    if (!isAdmin) {
      return sendTextMessage({
        to: from,
        text: '⛔ *Unauthorized:* Only registered club administrators can approve or reject bookings from WhatsApp.',
      });
    }

    if (isApprove) {
      const result = await adminBookingService.approveBookingById({
        bookingId: targetBookingId,
        io,
        adminIdentifier: cleanFrom,
      });

      if (!result.success) {
        return sendTextMessage({
          to: from,
          text: `⚠️ Could not approve booking: ${result.message}`,
        });
      }

      return sendTextMessage({
        to: from,
        text: `✅ *Booking #${result.bookingCode} Approved!* 🏏⚽\n\nPlayer *${result.customerName}* has been issued their official Digital Entry Pass with QR code on WhatsApp!\n\n🏟️ *Turf:* ${result.turfName}\n📅 *Date:* ${result.dateStr}\n⏰ *Time:* ${result.timeStr}\n💰 *Amount:* ₹${result.amount}\n💳 *UTR:* ${result.utr || 'N/A'}`,
      });
    } else {
      const result = await adminBookingService.rejectBookingById({
        bookingId: targetBookingId,
        io,
        adminIdentifier: cleanFrom,
        reason: 'Payment could not be verified by admin',
      });

      if (!result.success) {
        return sendTextMessage({
          to: from,
          text: `⚠️ Could not reject booking: ${result.message}`,
        });
      }

      return sendTextMessage({
        to: from,
        text: `❌ *Booking #${result.bookingCode} Rejected.* The slot (${result.dateStr} at ${result.timeStr}) has been released back to available.`,
      });
    }
  }

  // ----------------------------------------------------
  // A0. Website Slot Booking OTP Verification (e.g. "VERIFY 1234" or 4-digit code)
  // ----------------------------------------------------
  const verifyMatch = normalizedText.match(/(?:verify\s*)?(\b\d{4}\b)/i);
  if (verifyMatch) {
    const candidateOtp = verifyMatch[1];
    const cleanPhone = from.replace(/\D/g, '');
    const phoneNo91 = cleanPhone.startsWith('91') && cleanPhone.length === 12 ? cleanPhone.substring(2) : cleanPhone;

    try {
      const otpRes = await pool.query(
        `SELECT id, otp_code, phone FROM otp_verifications 
         WHERE (phone = $1 OR phone = $2) 
           AND otp_code = $3 
           AND verified = false 
           AND expires_at > NOW() 
         ORDER BY id DESC LIMIT 1`,
        [cleanPhone, phoneNo91, candidateOtp]
      );

      if (otpRes.rows.length > 0) {
        await pool.query('UPDATE otp_verifications SET verified = true WHERE id = $1', [otpRes.rows[0].id]);
        await cache.set(`otp_verified:whatsapp:${cleanPhone}`, 'true', 900);
        await cache.set(`otp_verified:whatsapp:${phoneNo91}`, 'true', 900);

        if (io) {
          io.emit('otp_verified', { 
            phone: cleanPhone, 
            phoneNo91,
            channel: 'whatsapp' 
          });
        }

        return sendTextMessage({
          to: from,
          text: `✅ *Mobile Number Verified!* 🏏⚽\n\nYour mobile number has been successfully verified for *Shri Trimurti Fitness Club*.\n\nYou can now return to your browser to complete your slot booking and lock in your match!`,
        });
      }
    } catch (otpErr) {
      console.error('[WHATSAPP OTP VERIFY ERROR]', otpErr.message);
    }
  }

  // ----------------------------------------------------
  // A. Check for Active Booking Session
  // ----------------------------------------------------
  const activeSession = getBookingSession(from);

  // User explicitly wants to cancel reservation
  if (
    payload === 'BTN_CANCEL_BOOKING' ||
    ['cancel', 'abort', 'stop', 'back', 'nahi', 'no'].includes(normalizedText)
  ) {
    if (activeSession) {
      clearBookingSession(from);
      return sendInteractiveButtons({
        to: from,
        headerText: 'Reservation Cancelled',
        bodyText: `Your reservation for ${activeSession.turfName} (${activeSession.timeStr}) has been released.\n\nLet us know if you'd like to check other times!`,
        buttons: [
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
          { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
          { id: 'BTN_PRICING', title: '💰 Pricing & Rates' },
        ],
      });
    }
  }

  // User is in AWAITING_PAYMENT state and sends message
  if (activeSession && activeSession.state === 'AWAITING_PAYMENT') {
    // Check if message contains 10-18 digit numeric UTR reference
    const utrMatch = (text || '').match(/\b\d{10,18}\b/);
    if (utrMatch) {
      return handleUtrSubmission({
        from,
        utr: utrMatch[0],
        session: activeSession,
        io,
        userName,
      });
    }

    // Check if user uploaded a screenshot without typed UTR
    if (text === 'PAYMENT_SCREENSHOT_UPLOADED' || normalizedText.includes('screenshot') || normalizedText.includes('paid')) {
      return sendInteractiveButtons({
        to: from,
        headerText: 'Payment Received',
        bodyText: `📸 Thank you! We received your payment confirmation.\n\nTo ensure instant verification with our bank, please type and send the *12-digit UPI Reference / UTR Number* from your receipt (e.g. \`431289012345\`).`,
        buttons: [
          { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
          { id: 'BTN_CANCEL_BOOKING', title: '❌ Cancel' },
        ],
      });
    }

    // User sent text that doesn't look like a UTR
    return sendInteractiveButtons({
      to: from,
      headerText: 'Pending Payment',
      bodyText: `⏳ We are holding your ${activeSession.turfName} slot (${activeSession.timeStr}) for ₹${activeSession.price}.\n\nTo complete your booking, please reply with your *12-digit UPI Reference / UTR Number*.\n\nOr tap below to cancel:`,
      buttons: [
        { id: 'BTN_CANCEL_BOOKING', title: '❌ Cancel Booking' },
        { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
      ],
    });
  }

  // ----------------------------------------------------
  // B. Handle Direct Slot Selection (e.g. BOOK_SLOT_<uuid>)
  // ----------------------------------------------------
  if (payload.startsWith('BOOK_SLOT_')) {
    const slotId = payload.replace('BOOK_SLOT_', '');
    return initiateSlotBooking({ from, slotId, userName });
  }

  // ----------------------------------------------------
  // C. Handle standalone 12-digit UTR sent without active session
  // ----------------------------------------------------
  const standaloneUtrMatch = (text || '').match(/\b\d{10,18}\b/);
  if (standaloneUtrMatch && !activeSession) {
    const customerPhone = String(from).replace(/\D/g, '');
    const recentBooking = await pool.query(`
      SELECT b.id, b.status, s.start_time, s.end_time, t.name as turf_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN turfs t ON s.turf_id = t.id
      WHERE u.phone = $1 AND b.status = 'pending_verification'
      ORDER BY b.created_at DESC LIMIT 1
    `, [customerPhone]);

    if (recentBooking.rows.length > 0) {
      const b = recentBooking.rows[0];
      return sendTextMessage({
        to: from,
        text: `✅ We already have your booking (#${b.id.substring(0, 8).toUpperCase()} for ${b.turf_name}) under verification!\n\nOur arena manager is reviewing your UPI transaction. You will receive your confirmation ticket shortly.`,
      });
    }

    return sendInteractiveButtons({
      to: from,
      headerText: 'UTR Received',
      bodyText: `We received UPI Reference (*${standaloneUtrMatch[0]}*), but no active slot reservation was found.\n\nPlease pick a slot first to link your payment:`,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
        { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
        { id: 'BTN_STAFF', title: '👤 Call Staff' },
      ],
    });
  }

  // ----------------------------------------------------
  // D. Cricket Slots Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_CRICKET_SLOTS' ||
    normalizedText.includes('cricket') ||
    normalizedText.includes('box')
  ) {
    const result = await getTodayAvailableSlots('cricket');

    if (result.isClosed) {
      return sendTextMessage({
        to: from,
        text: `⚠️ *Update for Today:*\n${result.reason}\n\nYou can still book upcoming dates online:\n👉 https://shritrimurtifitnessclub.in/book?facility=cricket`,
      });
    }

    if (!result.slots || result.slots.length === 0) {
      return sendInteractiveButtons({
        to: from,
        headerText: '🏏 Cricket Turf',
        bodyText:
          'All remaining slots for tonight are currently booked or in progress!\n\nWould you like to check football or talk to the club desk?',
        buttons: [
          { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Check Football' },
          { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
        ],
      });
    }

    const slotsList = result.slots.map((s) => `• ${s.label}`).join('\n');

    // If slots are available, send interactive list so user can tap to book!
    const sections = [
      {
        title: 'Today Available Slots',
        rows: result.slots.slice(0, 10).map((s) => ({
          id: `BOOK_SLOT_${s.id}`,
          title: s.timeLabel.slice(0, 24),
          description: `₹${s.price} • Tap to Book with UPI`,
        })),
      },
    ];

    return sendInteractiveList({
      to: from,
      headerText: '🏏 Cricket Turf',
      bodyText:
`*TODAY'S AVAILABLE CRICKET SLOTS:*

${slotsList}

👉 *Tap "Select Slot to Book" below to reserve directly on WhatsApp with UPI QR code:*`,
      buttonTitle: '📅 Select Slot to Book',
      sections,
      footerText: 'Shri Trimurti Fitness Club',
    });
  }

  // ----------------------------------------------------
  // E. Football Slots Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_FOOTBALL_SLOTS' ||
    normalizedText.includes('football') ||
    normalizedText.includes('soccer')
  ) {
    const result = await getTodayAvailableSlots('football');

    if (result.isClosed) {
      return sendTextMessage({
        to: from,
        text: `⚠️ *Club Update for Today:*\n${result.reason}\n\nYou can book upcoming dates online:\n👉 https://shritrimurtifitnessclub.in/book?facility=football`,
      });
    }

    if (!result.slots || result.slots.length === 0) {
      return sendInteractiveButtons({
        to: from,
        headerText: '⚽ Football Turf',
        bodyText:
          'No more vacant football slots tonight. Would you like to check cricket turf or talk to Club management?',
        buttons: [
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Check Cricket' },
          { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
        ],
      });
    }

    const slotsList = result.slots.map((s) => `• ${s.label}`).join('\n');

    const sections = [
      {
        title: 'Today Football Slots',
        rows: result.slots.slice(0, 10).map((s) => ({
          id: `BOOK_SLOT_${s.id}`,
          title: s.timeLabel.slice(0, 24),
          description: `₹${s.price} • Tap to Book with UPI`,
        })),
      },
    ];

    return sendInteractiveList({
      to: from,
      headerText: '⚽ Football Turf',
      bodyText:
`*TODAY'S AVAILABLE FOOTBALL SLOTS:*

${slotsList}

👉 *Tap "Select Slot to Book" below to reserve directly on WhatsApp with UPI QR code:*`,
      buttonTitle: '📅 Select Slot to Book',
      sections,
      footerText: 'Shri Trimurti Fitness Club',
    });
  }

  // ----------------------------------------------------
  // F. Common User Intents (Thank you, Slot inquiries, Generic questions)
  // ----------------------------------------------------
  // F1: Thank you / Appreciation
  if (
    normalizedText.includes('thanks') ||
    normalizedText.includes('thx') ||
    normalizedText.includes('dhanyawad') ||
    normalizedText.includes('shukriya') || 
    normalizedText.includes('thank you')
  ) {
    const thanksMsg =
`You're very welcome! 🙌 We look forward to hosting your squad at *Shri Trimurti Fitness Club*! 🏏⚽

Need to check other times or book another session? Choose an option below:`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Shri Trimurti Fitness Club',
      bodyText: thanksMsg,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
        { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
        { id: 'BTN_LOCATION', title: '📍 Directions' },
      ],
    });
  }

  // F2: General Slot / Timing / Booking inquiry
  if (
    normalizedText.includes('slot') ||
    normalizedText.includes('time') ||
    normalizedText.includes('timing') ||
    normalizedText.includes('available') ||
    normalizedText.includes('book') ||
    normalizedText.includes('aaj') ||
    normalizedText.includes('kal') ||
    normalizedText.includes('tomorrow')
  ) {
    return sendInteractiveButtons({
      to: from,
      headerText: 'Check Live Slots',
      bodyText:
        'Which sport would you like to check today?\n\nTap below to view real-time vacant slots and reserve directly with our official UPI QR code:',
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
        { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
        { id: 'BTN_PRICING', title: '💰 Pricing & Rates' },
      ],
    });
  }

  // ----------------------------------------------------
  // G. Pricing & Rates Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_PRICING' ||
    normalizedText.includes('price') ||
    normalizedText.includes('rate') ||
    normalizedText.includes('cost') ||
    normalizedText.includes('charges')
  ) {
    const pricingMsg =
`💰 *OFFICIAL Fitness Club PRICING & AMENITIES*

🏏 *Cricket Turf:*
• Day Slots (6:00 AM - 6:00 PM): *₹600 / Hour*
• Floodlit Night Slots (6:00 PM - 12:00 AM): *₹800 / Hour*
• _Includes high-grade cricket bats & stumps._

⚽ *Football Turf:*
• Day Slots (6:00 AM - 6:00 PM): *₹600 / Hour*
• Floodlit Night Slots (6:00 PM - 12:00 AM): *₹800 / Hour*
• _Includes quality footballs, perimeter netting & bibs._

🚗 *Amenities:*
• Free on-site vehicle parking
• Covered player dugout & spectator lounge
• Purified drinking water & chilled energy drinks (Paid)

Ready to hit the pitch?`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Pricing & Amenities',
      bodyText: pricingMsg,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Book Cricket' },
        { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Book Football' },
        { id: 'BTN_LOCATION', title: '📍 Directions' },
      ],
    });
  }

  // ----------------------------------------------------
  // H. Location & Directions Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_LOCATION' ||
    normalizedText.includes('location') ||
    normalizedText.includes('address') ||
    normalizedText.includes('map') ||
    normalizedText.includes('directions') ||
    normalizedText.includes('where')
  ) {
    const locationMsg =
`📍 *Shri Trimurti Fitness Club LOCATION*

📌 *Address:*
Kudire Factory, Sangrul Fata, Koparde, Maharashtra 416205

⏰ *Operating Hours:*
Mon - Sun: 6:00 AM - 12:00 AM (Midnight)

🗺️ *Google Maps Directions:*
https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde

📞 *Fitness Club Phone:* +91 9595153006`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Fitness Club Location',
      bodyText: locationMsg,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Check Slots' },
        { id: 'BTN_STAFF', title: '👤 Call Staff' },
      ],
    });
  }

  // ----------------------------------------------------
  // I. Human Staff / Manager Escalation Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_STAFF' ||
    normalizedText.includes('manager') ||
    normalizedText.includes('call') ||
    normalizedText.includes('human') ||
    normalizedText.includes('contact') ||
    normalizedText.includes('tournament') ||
    normalizedText.includes('corporate')
  ) {
    const staffMsg =
`👤 *CLUB MANAGEMENT SUPPORT*

Our desk team is ready to assist you!

📞 *Direct Call:* +91 9595153006
💬 *WhatsApp:* +91 9595153006
✉️ *Email:* shritrimurtifitness@gmail.com

For corporate events, full-day tournaments, or recurring league bookings, please call the number above or let us know your preferred date and squad size right here.`;

    return sendTextMessage({
      to: from,
      text: staffMsg,
    });
  }

  // ----------------------------------------------------
  // J. Default / Welcome Greeting Menu
  // ----------------------------------------------------
  const welcomeMsg =
`Welcome to *Shri Trimurti Fitness Club*! 🏏⚽

Koparde's premier floodlit venue for Cricket & Football.

Book your turf slot directly here on WhatsApp with instant UPI payment, or check live availability below:`;

  return sendInteractiveButtons({
    to: from,
    headerText: 'Shri Trimurti Fitness Club',
    bodyText: welcomeMsg,
    buttons: [
      { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
      { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
      { id: 'BTN_PRICING', title: '💰 Pricing & Rules' },
    ],
  });
}

module.exports = {
  getTodayAvailableSlots,
  initiateSlotBooking,
  handleUtrSubmission,
  handleIncomingMessage,
};
