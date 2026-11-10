const pool = require('../config/db');
const { sendInteractiveButtons, sendTextMessage } = require('./whatsapp');

// In-memory timer registries to avoid continuous polling of Neon DB
// Map<bookingId, NodeJS.Timeout>
const reminderTimers = new Map();
const feedbackTimers = new Map();
let midnightTimer = null;

/**
 * Formats standard 24h time ("19:00:00") into 12h format ("7:00 PM")
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
 * Parses date and time strings into millisecond epoch in Asia/Kolkata timezone (+05:30)
 */
function parseIST(dateVal, timeStr) {
  const d = typeof dateVal === 'string'
    ? dateVal.substring(0, 10)
    : new Date(dateVal).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const t = (timeStr || '00:00:00').substring(0, 8);
  const formattedTime = t.length === 5 ? `${t}:00` : t;
  const isoStr = `${d}T${formattedTime}+05:30`;
  return new Date(isoStr).getTime();
}

/**
 * Formats phone number into standard international format for WhatsApp (e.g. 917083738373)
 */
function formatPhone(phone) {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) cleaned = '91' + cleaned;
  return cleaned;
}

/**
 * Schedules Matchday Reminder (2 hours prior) & Feedback Survey (1 hour after match)
 * Uses in-memory precision timers (0 recurring DB queries)
 */
function scheduleBookingNotifications(booking) {
  if (!booking || !booking.id) return;

  const phone = formatPhone(booking.customer_phone || booking.phone);
  if (!phone) return;

  const bookingId = booking.id;
  const customerName = booking.customer_name || booking.name || 'Captain';
  const turfName = booking.turf_name || booking.facility_name || 'Box Cricket Turf';
  const dateStr = typeof booking.date === 'string'
    ? booking.date.substring(0, 10)
    : new Date(booking.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const startTime = booking.start_time;
  const endTime = booking.end_time;

  // Clear existing timers if re-scheduling
  cancelBookingNotifications(bookingId);

  const now = Date.now();
  const matchStartEpoch = parseIST(dateStr, startTime);
  const matchEndEpoch = parseIST(dateStr, endTime);

  // -------------------------------------------------------------------
  // 1. MATCHDAY REMINDER (2 Hours Prior to Match Kickoff)
  // -------------------------------------------------------------------
  if (!booking.reminder_sent_at) {
    const targetReminderEpoch = matchStartEpoch - (2 * 60 * 60 * 1000); // 2 hours prior
    const delay = targetReminderEpoch - now;

    const executeReminder = async () => {
      try {
        reminderTimers.delete(bookingId);

        // Double check status before sending
        const checkRes = await pool.query(
          `SELECT status, reminder_sent_at FROM bookings WHERE id = $1`,
          [bookingId]
        );
        if (checkRes.rows.length === 0 || checkRes.rows[0].status !== 'confirmed' || checkRes.rows[0].reminder_sent_at) {
          return;
        }

        const slotTimeLabel = `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
        const reminderMsg =
`🏏 *MATCH REMINDER — SHRI TRIMURTI FITNESS CLUB*

Hi *${customerName}*! Your match session is coming up in 2 hours! 🔥

🏟️ *Facility:* ${turfName}
📅 *Date:* Today (${dateStr})
⏰ *Slot Time:* ${slotTimeLabel}
📍 *Location:* Kudire Factory, Sangrul Fata, Koparde

💡 *Dugout Ready:*
High-grade cricket bats, tennis balls, and stumps are all set up for your squad.

See you on the pitch! 🏆`;

        await sendInteractiveButtons({
          to: phone,
          headerText: '🏏 Matchday Reminder',
          bodyText: reminderMsg,
          footerText: 'Shri Trimurti Sports Arena',
          buttons: [
            { id: 'BTN_LOCATION', title: '📍 Directions' },
            { id: 'BTN_STAFF', title: '📞 Call Arena' },
          ],
        });

        await pool.query(
          `UPDATE bookings SET reminder_sent_at = NOW() WHERE id = $1`,
          [bookingId]
        );

        console.log(`[NOTIFICATION] Matchday reminder sent to ${phone} for booking ${bookingId}`);
      } catch (err) {
        console.error(`[NOTIFICATION ERROR] Reminder failed for booking ${bookingId}:`, err.message);
      }
    };

    if (delay > 0) {
      // Future timer within Node's 24.8 day max limit
      if (delay < 2147483647) {
        const timerId = setTimeout(executeReminder, delay);
        reminderTimers.set(bookingId, timerId);
        console.log(`[SCHEDULER] Match reminder set for booking ${bookingId} in ${Math.round(delay / 60000)} mins`);
      }
    } else if (now < matchStartEpoch - (5 * 60 * 1000)) {
      // Booking was confirmed within 2 hours of match kickoff: fire shortly (e.g. 5 sec delay)
      const timerId = setTimeout(executeReminder, 5000);
      reminderTimers.set(bookingId, timerId);
    } else {
      // Match already in progress or completed
      pool.query(`UPDATE bookings SET reminder_sent_at = NOW() WHERE id = $1`, [bookingId]).catch(() => {});
    }
  }

  // -------------------------------------------------------------------
  // 2. VIRAL GOOGLE REVIEW COLLECTOR (1 Hour After Match Ends)
  // -------------------------------------------------------------------
  if (!booking.feedback_sent_at) {
    const targetFeedbackEpoch = matchEndEpoch + (1 * 60 * 60 * 1000); // 1 hour after match
    const delay = targetFeedbackEpoch - now;

    const executeFeedback = async () => {
      try {
        feedbackTimers.delete(bookingId);

        // Double check status before sending
        const checkRes = await pool.query(
          `SELECT status, feedback_sent_at FROM bookings WHERE id = $1`,
          [bookingId]
        );
        if (checkRes.rows.length === 0 || checkRes.rows[0].status !== 'confirmed' || checkRes.rows[0].feedback_sent_at) {
          return;
        }

        const surveyMsg =
`Hope your squad had a blast today at *Shri Trimurti Fitness Club*! 🏆🔥

How was your pitch condition and match experience?`;

        await sendInteractiveButtons({
          to: phone,
          headerText: '🏆 Matchday Experience',
          bodyText: surveyMsg,
          footerText: 'Shri Trimurti Sports Arena',
          buttons: [
            { id: `BTN_FEEDBACK_5STAR_${bookingId}`, title: '⭐ Loved it!' },
            { id: `BTN_FEEDBACK_IMPROVE_${bookingId}`, title: '💬 Give Feedback' },
          ],
        });

        await pool.query(
          `UPDATE bookings SET feedback_sent_at = NOW() WHERE id = $1`,
          [bookingId]
        );

        console.log(`[NOTIFICATION] Feedback survey sent to ${phone} for booking ${bookingId}`);
      } catch (err) {
        console.error(`[NOTIFICATION ERROR] Feedback survey failed for booking ${bookingId}:`, err.message);
      }
    };

    if (delay > 0) {
      if (delay < 2147483647) {
        const timerId = setTimeout(executeFeedback, delay);
        feedbackTimers.set(bookingId, timerId);
        console.log(`[SCHEDULER] Feedback survey set for booking ${bookingId} in ${Math.round(delay / 60000)} mins`);
      }
    } else if (now - matchEndEpoch < 6 * 60 * 60 * 1000) {
      // Match ended within the last 6 hours: fire shortly
      const timerId = setTimeout(executeFeedback, 8000);
      feedbackTimers.set(bookingId, timerId);
    } else {
      // Match ended more than 6 hours ago: skip survey
      pool.query(`UPDATE bookings SET feedback_sent_at = NOW() WHERE id = $1`, [bookingId]).catch(() => {});
    }
  }
}

/**
 * Cancels any pending in-memory timers for a cancelled/rejected booking
 */
function cancelBookingNotifications(bookingId) {
  if (reminderTimers.has(bookingId)) {
    clearTimeout(reminderTimers.get(bookingId));
    reminderTimers.delete(bookingId);
  }
  if (feedbackTimers.has(bookingId)) {
    clearTimeout(feedbackTimers.get(bookingId));
    feedbackTimers.delete(bookingId);
  }
}

/**
 * Initializes scheduler on server boot:
 * Runs 1 single startup query to hydrate pending timers for active bookings.
 * Schedules a daily midnight timer to re-hydrate the upcoming day.
 * ZERO periodic polling against Neon DB!
 */
async function initScheduler() {
  try {
    console.log('[SCHEDULER] Hydrating active bookings from database (single startup query)...');

    const result = await pool.query(`
      SELECT b.id, b.status, b.reminder_sent_at, b.feedback_sent_at,
             COALESCE(u.name, 'Player') as customer_name,
             COALESCE(u.phone, '') as customer_phone,
             s.date, s.start_time, s.end_time,
             COALESCE(t.name, t.facility_type, 'Arena Turf') as turf_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      JOIN turfs t ON s.turf_id = t.id
      WHERE b.status = 'confirmed'
        AND s.date >= CURRENT_DATE
        AND (b.reminder_sent_at IS NULL OR b.feedback_sent_at IS NULL)
      ORDER BY s.date ASC, s.start_time ASC
    `);

    let scheduledCount = 0;
    for (const row of result.rows) {
      scheduleBookingNotifications(row);
      scheduledCount++;
    }

    console.log(`[SCHEDULER] Successfully initialized ${scheduledCount} active booking notification timers.`);

    // Schedule midnight re-hydration (runs once per day at 00:01 AM IST)
    scheduleMidnightRefresh();
  } catch (err) {
    console.error('[SCHEDULER INIT ERROR]', err.message);
  }
}

/**
 * Calculates ms until 00:01 AM IST tonight and schedules next hydration
 */
function scheduleMidnightRefresh() {
  if (midnightTimer) clearTimeout(midnightTimer);

  const now = new Date();
  const istDateString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [year, month, day] = istDateString.split('-').map(Number);

  // Tomorrow 00:01 AM IST
  const tomorrowMidnightIST = new Date(Date.UTC(year, month - 1, day + 1, 0 - 5, 31, 0, 0)); // 00:01 IST = 18:31 UTC previous day
  let msUntilMidnight = tomorrowMidnightIST.getTime() - Date.now();

  if (msUntilMidnight <= 0) {
    msUntilMidnight = 24 * 60 * 60 * 1000;
  }

  midnightTimer = setTimeout(() => {
    console.log('[SCHEDULER] Midnight IST reached: refreshing daily booking timers...');
    initScheduler();
  }, msUntilMidnight);
}

module.exports = {
  scheduleBookingNotifications,
  cancelBookingNotifications,
  initScheduler,
};
