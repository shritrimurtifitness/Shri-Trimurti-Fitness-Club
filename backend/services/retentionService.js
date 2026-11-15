/**
 * Smart Churn & Re-Engagement Predictor Service for SHRI TRIMURTI FITNESS CLUB
 * Deterministically identifies regular teams at risk of churn, checks live upcoming weekend slot availability,
 * and drafts hyper-personalized WhatsApp re-engagement invites with 1-tap admin dispatch.
 */

const pool = require('../config/db');
const { sendTextMessage } = require('./whatsapp');
const { normalizeTo10Digits } = require('../utils/phone');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculates the next calendar date for a given day of the week (0 = Sun, 6 = Sat).
 * If today is Thursday (4) and target is Saturday (6), returns this Saturday.
 * @param {number} targetDow - 0 to 6
 * @returns {Date}
 */
function getNextDateForDayOfWeek(targetDow) {
  const now = new Date();
  // Get current day of week in IST (+05:30)
  const istDateStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const istDate = new Date(istDateStr);
  const currentDow = istDate.getDay();

  let daysAhead = targetDow - currentDow;
  if (daysAhead <= 0) {
    daysAhead += 7; // Next week's occurrence if already passed or today
  }

  const nextDate = new Date(istDate);
  nextDate.setDate(istDate.getDate() + daysAhead);
  return nextDate;
}

/**
 * Formats 24h time "20:00:00" to "8:00 PM"
 * @param {string} timeStr
 * @returns {string}
 */
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

/**
 * Generates personalized message using Gemini 3.5 Flash, with deterministic fallback.
 * @param {Object} params
 * @returns {Promise<string>}
 */
async function generatePersonalizedMessage({
  customerName,
  totalMatches,
  turfName,
  dayName,
  targetDateFormatted,
  timeFormatted,
  isSlotOpen,
  alternateTimeFormatted,
}) {
  const fallbackGreeting = customerName && customerName !== 'WhatsApp Player' ? `Namaskar ${customerName}!` : 'Namaskar Captain!';
  
  const fallback = isSlotOpen
    ? `${fallbackGreeting} 🏏 We noticed your squad hasn't played on our ${turfName} for a couple of weekends. Your favorite ${dayName} ${timeFormatted} slot is wide open for this weekend (${targetDateFormatted}). Would you like us to hold it for your team? Reply YES to lock it in! — Shri Trimurti Fitness Club`
    : `${fallbackGreeting} 🏏 We missed your squad on our ${turfName}! Your usual ${dayName} slot was booked, but we have ${dayName} ${alternateTimeFormatted || 'another prime slot'} open for you. Would you like to reserve it for your match this weekend? — Shri Trimurti Fitness Club`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const candidateModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    const prompt = `
You are drafting a friendly, warm WhatsApp re-engagement message on behalf of the arena manager at Shri Trimurti Fitness Club (Sports Arena).
Player / Captain Name: "${customerName}"
Total Matches Played Previously: ${totalMatches}
Preferred Sport / Facility: "${turfName}"
Upcoming Match Day: "${dayName}" (${targetDateFormatted})
Slot Status: ${isSlotOpen ? `Their favorite slot (${timeFormatted}) is open` : `Their favorite slot was booked, best alternate is ${alternateTimeFormatted}`}

Instructions:
1. Greet warmly in natural Hinglish / Indian sports style ("Namaskar Captain!" or "Namaskar ${customerName}!").
2. Mention you missed their squad on the turf.
3. Inform them about the ${isSlotOpen ? `open ${timeFormatted} slot` : `alternate ${alternateTimeFormatted} slot`}.
4. Provide a clear call to action: "Reply YES to lock it in or book directly".
5. Keep it under 50 words. Do NOT include markdown bold stars inside URLs. Do NOT make up discounts or false promises. Return ONLY the plain message text.
`;

    for (const model of candidateModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 250,
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (generated && generated.length > 20) {
        return generated;
      }
    }
  } catch (err) {
    console.error('[RETENTION AI COPYWRITING ERROR]', err.message);
  }

  return fallback;
}

/**
 * Runs deterministic SQL churn analysis, checks upcoming slot availability,
 * drafts personalized messages, and optionally sends an Admin WhatsApp Digest.
 * @param {Object} [options]
 * @param {Object} [options.io] - Socket.IO instance
 * @param {boolean} [options.sendWhatsAppDigest=true]
 * @returns {Promise<{ success: boolean, count: number, atRiskPlayers: Array }>}
 */
async function runChurnAnalysis({ io = null, sendWhatsAppDigest = true } = {}) {
  console.log('[RETENTION] Running scheduled Churn Analysis...');

  // 1. Deterministic SQL: Identify regular players with no recent or future bookings and no outreach in 21 days
  const query = `
    WITH regular_players AS (
      SELECT 
        u.id as user_id,
        u.name as customer_name,
        u.phone as customer_phone,
        COUNT(b.id)::int as total_past_matches,
        MAX(s.date) as last_match_date,
        -- Preferred day of week (0=Sun, 6=Sat)
        MODE() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM s.date))::int as preferred_dow,
        -- Preferred start time
        MODE() WITHIN GROUP (ORDER BY s.start_time) as preferred_time,
        -- Preferred turf
        MODE() WITHIN GROUP (ORDER BY s.turf_id) as preferred_turf_id
      FROM users u
      JOIN bookings b ON b.user_id = u.id
      JOIN slots s ON b.slot_id = s.id
      WHERE b.status IN ('confirmed', 'completed')
        AND u.phone IS NOT NULL
        AND length(trim(u.phone)) >= 10
      GROUP BY u.id, u.name, u.phone
      HAVING COUNT(b.id) >= 2
         AND MAX(s.date) <= CURRENT_DATE - INTERVAL '10 days'
    )
    SELECT rp.*, t.name as turf_name, t.facility_type
    FROM regular_players rp
    JOIN turfs t ON t.id = rp.preferred_turf_id
    -- Exclude users with upcoming bookings
    WHERE rp.user_id NOT IN (
      SELECT b2.user_id 
      FROM bookings b2 
      JOIN slots s2 ON b2.slot_id = s2.id
      WHERE b2.status IN ('confirmed', 'pending_verification')
        AND s2.date >= CURRENT_DATE
    )
    -- Exclude users who received an outreach within the last 21 days
    AND rp.user_id NOT IN (
      SELECT col.user_id
      FROM churn_outreach_logs col
      WHERE col.created_at > NOW() - INTERVAL '21 days'
        AND col.status != 'snoozed'
    )
    ORDER BY rp.total_past_matches DESC
    LIMIT 10;
  `;

  const { rows: candidates } = await pool.query(query);
  console.log(`[RETENTION] Found ${candidates.length} at-risk regular players.`);

  if (candidates.length === 0) {
    return { success: true, count: 0, atRiskPlayers: [] };
  }

  const processedPlayers = [];

  for (const player of candidates) {
    const cleanPhone = normalizeTo10Digits(player.customer_phone);
    const prefDow = typeof player.preferred_dow === 'number' ? player.preferred_dow : 6; // default Sat
    const dayName = DAY_NAMES[prefDow];
    const targetDateObj = getNextDateForDayOfWeek(prefDow);
    const targetDateStr = targetDateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const targetDateFormatted = targetDateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    });

    const prefTimeStr = player.preferred_time || '18:00:00';
    const timeFormatted = formatTime12h(prefTimeStr);

    // 2. Check if preferred slot exists and is available on targetDate
    const slotQuery = await pool.query(`
      SELECT s.id, s.price, s.is_available
      FROM slots s
      WHERE s.date = $1
        AND s.turf_id = $2
        AND s.start_time = $3
        AND s.is_available = true
        AND NOT EXISTS (
          SELECT 1 FROM bookings b
          WHERE b.slot_id = s.id
            AND b.status NOT IN ('cancelled', 'rejected')
        )
      LIMIT 1
    `, [targetDateStr, player.preferred_turf_id, prefTimeStr]);

    let targetSlotId = null;
    let isSlotOpen = false;
    let alternateTimeFormatted = '';

    if (slotQuery.rows.length > 0) {
      targetSlotId = slotQuery.rows[0].id;
      isSlotOpen = true;
    } else {
      // Find an alternate available slot on that same day
      const altSlotQuery = await pool.query(`
        SELECT s.id, s.start_time, s.price
        FROM slots s
        WHERE s.date = $1
          AND s.turf_id = $2
          AND s.is_available = true
          AND NOT EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.slot_id = s.id
              AND b.status NOT IN ('cancelled', 'rejected')
          )
        ORDER BY ABS(EXTRACT(EPOCH FROM (s.start_time - $3::time)))
        LIMIT 1
      `, [targetDateStr, player.preferred_turf_id, prefTimeStr]);

      if (altSlotQuery.rows.length > 0) {
        targetSlotId = altSlotQuery.rows[0].id;
        alternateTimeFormatted = formatTime12h(altSlotQuery.rows[0].start_time);
      }
    }

    // 3. Generate personalized message
    const message = await generatePersonalizedMessage({
      customerName: player.customer_name,
      totalMatches: player.total_past_matches,
      turfName: player.turf_name || 'Sports Turf',
      dayName,
      targetDateFormatted,
      timeFormatted,
      isSlotOpen,
      alternateTimeFormatted,
    });

    // 4. Save to churn_outreach_logs
    const insertRes = await pool.query(`
      INSERT INTO churn_outreach_logs (
        user_id, customer_name, customer_phone, total_past_matches,
        preferred_day_of_week, preferred_time, target_date, target_slot_id,
        slot_status, generated_message, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'drafted')
      RETURNING *
    `, [
      player.user_id,
      player.customer_name,
      cleanPhone,
      player.total_past_matches,
      prefDow,
      prefTimeStr,
      targetDateStr,
      targetSlotId,
      isSlotOpen ? 'open' : (alternateTimeFormatted ? 'alternative' : 'general'),
      message,
    ]);

    processedPlayers.push({
      logId: insertRes.rows[0].id,
      userId: player.user_id,
      name: player.customer_name,
      phone: cleanPhone,
      matches: player.total_past_matches,
      turf: player.turf_name,
      day: dayName,
      targetDate: targetDateFormatted,
      time: timeFormatted,
      isSlotOpen,
      alternateTime: alternateTimeFormatted,
      message,
    });
  }

  // 5. Send compiled Admin WhatsApp Digest if enabled
  if (sendWhatsAppDigest && processedPlayers.length > 0) {
    const adminPhoneRaw = (process.env.ADMIN_PHONE || '919595153006').replace(/\D/g, '');
    const adminPhone = adminPhoneRaw.startsWith('91') ? adminPhoneRaw : `91${adminPhoneRaw}`;

    let digestText = `📊 *WEEKEND RETENTION ALERT* (${processedPlayers.length} Regular Teams Inactive)\n\n`;

    processedPlayers.forEach((p, idx) => {
      const statusIcon = p.isSlotOpen ? '🟢 *SLOT IS OPEN!*' : (p.alternateTime ? `🟡 *Alt: ${p.alternateTime}*` : '⚪ *No exact slot*');
      const encodedMsg = encodeURIComponent(p.message);
      const waLink = `https://wa.me/91${p.phone}?text=${encodedMsg}`;

      digestText += `🏏 *${idx + 1}. ${p.name}*\n`;
      digestText += `• Played: ${p.matches} matches | Phone: +91 ${p.phone}\n`;
      digestText += `• Usual: ${p.day} ${p.time} (${p.turf})\n`;
      digestText += `• Status: ${statusIcon}\n`;
      digestText += `👉 Tap to Invite: ${waLink}\n\n`;
    });

    digestText += `━━━━━━━━━━━━━━━━━━━━\n💡 Tap any invite link above to open WhatsApp with the personalized draft pre-filled!`;

    sendTextMessage({ to: adminPhone, text: digestText }).catch((err) =>
      console.error('[RETENTION ADMIN DIGEST ERROR]', err.message)
    );
  }

  if (io) {
    io.emit('retention_updated', { count: processedPlayers.length });
  }

  return {
    success: true,
    count: processedPlayers.length,
    atRiskPlayers: processedPlayers,
  };
}

/**
 * Returns recent retention outreach logs with player history and status.
 */
async function getRetentionLogs({ limit = 50, status = null } = {}) {
  let query = `
    SELECT 
      col.*,
      u.email as customer_email,
      t.name as turf_name,
      s.start_time as actual_slot_time,
      s.date as actual_slot_date
    FROM churn_outreach_logs col
    JOIN users u ON col.user_id = u.id
    LEFT JOIN slots s ON col.target_slot_id = s.id
    LEFT JOIN turfs t ON s.turf_id = t.id
  `;

  const params = [];
  if (status) {
    params.push(status);
    query += ` WHERE col.status = $1`;
  }

  params.push(limit);
  query += ` ORDER BY col.created_at DESC LIMIT $${params.length}`;

  const res = await pool.query(query, params);
  return res.rows;
}

/**
 * Snoozes a player from churn outreach for a specified number of days.
 */
async function snoozePlayerOutreach(logId, days = 14) {
  const res = await pool.query(`
    UPDATE churn_outreach_logs
    SET status = 'snoozed',
        created_at = NOW() + ($1 || ' days')::interval
    WHERE id = $2
    RETURNING *
  `, [days, logId]);
  return res.rows[0];
}

/**
 * Marks outreach as sent.
 */
async function markOutreachSent(logId) {
  const res = await pool.query(`
    UPDATE churn_outreach_logs
    SET status = 'sent', dispatched_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [logId]);
  return res.rows[0];
}

/**
 * Dispatches the outreach message directly to the customer via WhatsApp Cloud API.
 */
async function dispatchOutreachDirectly(logId) {
  const res = await pool.query('SELECT * FROM churn_outreach_logs WHERE id = $1', [logId]);
  if (res.rows.length === 0) throw new Error('Outreach log not found');

  const log = res.rows[0];
  const cleanPhone = normalizeTo10Digits(log.customer_phone);
  const to = `91${cleanPhone}`;

  await sendTextMessage({ to, text: log.generated_message });

  await pool.query(`
    UPDATE churn_outreach_logs
    SET status = 'sent', dispatched_at = NOW()
    WHERE id = $1
  `, [logId]);

  return { success: true, to, message: log.generated_message };
}

module.exports = {
  runChurnAnalysis,
  getRetentionLogs,
  snoozePlayerOutreach,
  markOutreachSent,
  dispatchOutreachDirectly,
};
