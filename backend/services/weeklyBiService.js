/**
 * Automated Weekly Turf Business Intelligence Service for SHRI TRIMURTI FITNESS CLUB
 * Computes deterministic 7-day financial aggregations, peak vs dead-zone slot occupancy,
 * feedback sentiment, and generates an executive WhatsApp summary for the owner.
 */

const pool = require('../config/db');
const { sendTextMessage } = require('./whatsapp');

/**
 * Returns the date range for the most recently completed week (Mon - Sun).
 * @param {boolean} [trailing7Days=false] - If true, uses trailing 7 days ending yesterday
 * @returns {{ start: string, end: string, prevStart: string, prevEnd: string, formattedPeriod: string }}
 */
function getWeekDateRange(trailing7Days = false) {
  const now = new Date();
  const istStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const today = new Date(istStr);

  if (trailing7Days) {
    const end = new Date(today);
    end.setDate(today.getDate() - 1);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);

    const prevEnd = new Date(start);
    prevEnd.setDate(start.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevEnd.getDate() - 6);

    return {
      start: start.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      end: end.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      prevStart: prevStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      prevEnd: prevEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
      formattedPeriod: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    };
  }

  // Full calendar week: Previous Monday to Sunday
  const dayOfWeek = today.getDay(); // 0 = Sun, 1 = Mon, ...
  const daysSinceLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - daysSinceLastSunday);

  const lastMonday = new Date(lastSunday);
  lastMonday.setDate(lastSunday.getDate() - 6);

  const prevPrevSunday = new Date(lastMonday);
  prevPrevSunday.setDate(lastMonday.getDate() - 1);
  const prevPrevMonday = new Date(prevPrevSunday);
  prevPrevMonday.setDate(prevPrevSunday.getDate() - 6);

  return {
    start: lastMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    end: lastSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    prevStart: prevPrevMonday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    prevEnd: prevPrevSunday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }),
    formattedPeriod: `${lastMonday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${lastSunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  };
}

/**
 * Computes deterministic SQL aggregation metrics for the specified week.
 * @param {string} start - 'YYYY-MM-DD'
 * @param {string} end - 'YYYY-MM-DD'
 * @param {string} prevStart - 'YYYY-MM-DD'
 * @param {string} prevEnd - 'YYYY-MM-DD'
 * @returns {Promise<Object>}
 */
async function computeWeeklyMetrics(start, end, prevStart, prevEnd) {
  // 1. Current Week Revenue & Sport Split
  const currentRevRes = await pool.query(`
    SELECT 
      COALESCE(SUM(b.paid_amount), 0)::numeric AS total_revenue,
      COALESCE(SUM(CASE WHEN lower(coalesce(t.name, t.facility_type, '')) LIKE '%cricket%' THEN b.paid_amount ELSE 0 END), 0)::numeric AS cricket_revenue,
      COALESCE(SUM(CASE WHEN lower(coalesce(t.name, t.facility_type, '')) LIKE '%football%' THEN b.paid_amount ELSE 0 END), 0)::numeric AS football_revenue,
      COALESCE(SUM(CASE WHEN b.payment_mode = 'cash' THEN b.paid_amount ELSE 0 END), 0)::numeric AS cash_revenue,
      COALESCE(SUM(CASE WHEN b.payment_mode != 'cash' THEN b.paid_amount ELSE 0 END), 0)::numeric AS upi_revenue,
      COUNT(b.id)::int AS total_matches,
      COUNT(DISTINCT b.user_id)::int AS unique_teams
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    LEFT JOIN turfs t ON s.turf_id = t.id
    WHERE b.status IN ('confirmed', 'completed')
      AND s.date >= $1 AND s.date <= $2
  `, [start, end]);

  const currentStats = currentRevRes.rows[0];
  const totalRevenue = parseFloat(currentStats.total_revenue) || 0;
  const cricketRevenue = parseFloat(currentStats.cricket_revenue) || 0;
  const footballRevenue = parseFloat(currentStats.football_revenue) || 0;
  const cashRevenue = parseFloat(currentStats.cash_revenue) || 0;
  const upiRevenue = parseFloat(currentStats.upi_revenue) || 0;
  const totalMatches = currentStats.total_matches || 0;
  const uniqueTeams = currentStats.unique_teams || 0;

  // 2. Previous Week Revenue (for Growth %)
  const prevRevRes = await pool.query(`
    SELECT COALESCE(SUM(b.paid_amount), 0)::numeric AS prev_revenue
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('confirmed', 'completed')
      AND s.date >= $1 AND s.date <= $2
  `, [prevStart, prevEnd]);

  const previousRevenue = parseFloat(prevRevRes.rows[0]?.prev_revenue) || 0;
  let growthPercentage = 0;
  if (previousRevenue > 0) {
    growthPercentage = Math.round(((totalRevenue - previousRevenue) / previousRevenue) * 100);
  } else if (totalRevenue > 0) {
    growthPercentage = 100;
  }

  // 3. Best Revenue Day
  const bestDayRes = await pool.query(`
    SELECT TO_CHAR(s.date, 'FMDay') AS day_name, SUM(b.paid_amount)::numeric AS day_revenue
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('confirmed', 'completed')
      AND s.date >= $1 AND s.date <= $2
    GROUP BY s.date
    ORDER BY day_revenue DESC
    LIMIT 1
  `, [start, end]);

  const bestDay = bestDayRes.rows[0]?.day_name ? bestDayRes.rows[0].day_name.trim() : 'Weekend';
  const bestDayRevenue = parseFloat(bestDayRes.rows[0]?.day_revenue) || 0;

  // 4. Peak Occupancy (Fri - Sun 17:00 - 23:00)
  const peakSlotsRes = await pool.query(`
    SELECT 
      COUNT(s.id)::int AS total_peak_slots,
      COUNT(b.id)::int AS booked_peak_slots
    FROM slots s
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('confirmed', 'completed')
    WHERE s.date >= $1 AND s.date <= $2
      AND EXTRACT(DOW FROM s.date) IN (0, 5, 6)
      AND s.start_time >= '17:00:00' AND s.start_time < '23:00:00'
  `, [start, end]);

  const totalPeak = peakSlotsRes.rows[0]?.total_peak_slots || 0;
  const bookedPeak = peakSlotsRes.rows[0]?.booked_peak_slots || 0;
  const peakOccupancyPct = totalPeak > 0 ? Math.round((bookedPeak / totalPeak) * 100) : 0;

  // 5. Dead-Zone Afternoon Occupancy (Mon - Fri 12:00 - 16:00)
  const afternoonSlotsRes = await pool.query(`
    SELECT 
      COUNT(s.id)::int AS total_afternoon_slots,
      COUNT(b.id)::int AS booked_afternoon_slots
    FROM slots s
    LEFT JOIN bookings b ON b.slot_id = s.id AND b.status IN ('confirmed', 'completed')
    WHERE s.date >= $1 AND s.date <= $2
      AND EXTRACT(DOW FROM s.date) BETWEEN 1 AND 5
      AND s.start_time >= '12:00:00' AND s.start_time < '16:00:00'
  `, [start, end]);

  const totalAfternoon = afternoonSlotsRes.rows[0]?.total_afternoon_slots || 0;
  const bookedAfternoon = afternoonSlotsRes.rows[0]?.booked_afternoon_slots || 0;
  const deadZoneOccupancyPct = totalAfternoon > 0 ? Math.round((bookedAfternoon / totalAfternoon) * 100) : 0;
  const unbookedAfternoonSlots = Math.max(0, totalAfternoon - bookedAfternoon);

  // 6. Star Team of the Week
  const starTeamRes = await pool.query(`
    SELECT u.name, u.phone, COUNT(b.id)::int AS match_count, SUM(b.paid_amount)::numeric AS total_spent
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('confirmed', 'completed')
      AND s.date >= $1 AND s.date <= $2
    GROUP BY u.id, u.name, u.phone
    ORDER BY match_count DESC, total_spent DESC
    LIMIT 1
  `, [start, end]);

  const starTeamName = starTeamRes.rows[0]?.name || 'N/A';
  const starTeamMatches = starTeamRes.rows[0]?.match_count || 0;

  // 7. New First-Time Teams
  const newTeamsRes = await pool.query(`
    SELECT COUNT(DISTINCT b.user_id)::int AS new_teams_count
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE b.status IN ('confirmed', 'completed')
      AND s.date >= $1 AND s.date <= $2
      AND NOT EXISTS (
        SELECT 1 FROM bookings b_old
        JOIN slots s_old ON b_old.slot_id = s_old.id
        WHERE b_old.user_id = b.user_id
          AND b_old.status IN ('confirmed', 'completed')
          AND s_old.date < $1
      )
  `, [start, end]);

  const newTeamsCount = newTeamsRes.rows[0]?.new_teams_count || 0;

  // 8. Customer Ratings & Comments
  const ratingsRes = await pool.query(`
    SELECT 
      COALESCE(AVG(feedback_rating), 5.0)::numeric(3, 1) AS avg_rating,
      COUNT(feedback_rating)::int AS total_ratings
    FROM bookings b
    JOIN slots s ON b.slot_id = s.id
    WHERE s.date >= $1 AND s.date <= $2
      AND feedback_rating IS NOT NULL
  `, [start, end]);

  const averageRating = parseFloat(ratingsRes.rows[0]?.avg_rating) || 5.0;
  const totalRatings = ratingsRes.rows[0]?.total_ratings || 0;

  const commentsRes = await pool.query(`
    SELECT b.feedback_rating, b.feedback_comment, u.name AS customer_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN slots s ON b.slot_id = s.id
    WHERE s.date >= $1 AND s.date <= $2
      AND b.feedback_comment IS NOT NULL
      AND length(trim(b.feedback_comment)) > 3
    ORDER BY b.created_at DESC
    LIMIT 6
  `, [start, end]);

  const feedbackComments = commentsRes.rows.map(r => `• ${r.customer_name}: "${r.feedback_comment}" (${r.feedback_rating}★)`);

  return {
    totalRevenue,
    previousRevenue,
    growthPercentage,
    cricketRevenue,
    footballRevenue,
    cashRevenue,
    upiRevenue,
    totalMatches,
    uniqueTeams,
    bestDay,
    bestDayRevenue,
    peakOccupancyPct,
    deadZoneOccupancyPct,
    unbookedAfternoonSlots,
    starTeamName,
    starTeamMatches,
    newTeamsCount,
    averageRating,
    totalRatings,
    feedbackComments,
  };
}

/**
 * Builds deterministic fallback summary when AI API is unavailable.
 */
function buildDeterministicSummary(period, metrics) {
  const growthSign = metrics.growthPercentage >= 0 ? '+' : '';
  const growthIcon = metrics.growthPercentage >= 0 ? '🟢' : '🔻';
  const upiPct = metrics.totalRevenue > 0 ? Math.round((metrics.upiRevenue / metrics.totalRevenue) * 100) : 100;
  const cashPct = 100 - upiPct;

  const cricketPct = metrics.totalRevenue > 0 ? Math.round((metrics.cricketRevenue / metrics.totalRevenue) * 100) : 0;
  const footballPct = metrics.totalRevenue > 0 ? Math.round((metrics.footballRevenue / metrics.totalRevenue) * 100) : 0;

  let feedbackSection = `• Average Rating: *${metrics.averageRating} / 5.0* ⭐ (${metrics.totalRatings} reviews)\n• Player sentiment remains high across weekend matches.`;
  if (metrics.feedbackComments.length > 0) {
    feedbackSection += `\n• Notes: ${metrics.feedbackComments.slice(0, 2).join('; ')}`;
  }

  return `📊 *SHRI TRIMURTI ARENA — WEEKLY EXECUTIVE SUMMARY*
🗓️ *Period: ${period}*

💰 *1. REVENUE PERFORMANCE:*
• Total Revenue: *₹${metrics.totalRevenue.toLocaleString('en-IN')}* (${growthIcon} *${growthSign}${metrics.growthPercentage}%* vs last week)
• Cricket Turf: *₹${metrics.cricketRevenue.toLocaleString('en-IN')}* (${cricketPct}%)
• Football Turf: *₹${metrics.footballRevenue.toLocaleString('en-IN')}* (${footballPct}%)
• Best Day: *${metrics.bestDay} (₹${metrics.bestDayRevenue.toLocaleString('en-IN')})*
• Payment Modes: ${upiPct}% UPI | ${cashPct}% Cash

⚡ *2. UNTAPPED SLOT OPPORTUNITY:*
• Evening & Weekend Occupancy: *${metrics.peakOccupancyPct}%* (Prime Hours)
• Weekday Afternoon (12 PM – 4 PM) Occupancy: *${metrics.deadZoneOccupancyPct}%*
• 💡 *Opportunity:* ${metrics.unbookedAfternoonSlots} afternoon slots went unbooked. A ₹400 afternoon student or corporate pass could capture extra revenue.

🚨 *3. GROUND SENTIMENT & MAINTENANCE:*
${feedbackSection}

👥 *4. SQUAD ACTIVITY:*
• ${metrics.totalMatches} total matches played | ${metrics.uniqueTeams} unique teams
• ${metrics.newTeamsCount} brand new squads joined this week
• Star Team: *${metrics.starTeamName} (${metrics.starTeamMatches} matches)*

━━━━━━━━━━━━━━━━━━━━
Have a productive week, Boss! 🏏⚽`;
}

/**
 * Synthesizes summary using Gemini 3.5 Flash, falling back to deterministic template.
 */
async function synthesizeExecutiveSummary(period, metrics) {
  const fallback = buildDeterministicSummary(period, metrics);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const prompt = `
You are the Executive Chief of Staff for the owner of Shri Trimurti Fitness Club (Sports Arena).
Generate a concise, professional, and visually engaging Monday morning executive summary for WhatsApp.

Mathematical Facts from Database (Do NOT modify, round differently, or invent numbers):
- Period: ${period}
- Total Revenue: ₹${metrics.totalRevenue.toLocaleString('en-IN')}
- Previous Week Revenue: ₹${metrics.previousRevenue.toLocaleString('en-IN')}
- Growth Percentage: ${metrics.growthPercentage >= 0 ? '+' : ''}${metrics.growthPercentage}%
- Cricket Turf Revenue: ₹${metrics.cricketRevenue.toLocaleString('en-IN')}
- Football Turf Revenue: ₹${metrics.footballRevenue.toLocaleString('en-IN')}
- Peak Revenue Day: ${metrics.bestDay} (₹${metrics.bestDayRevenue.toLocaleString('en-IN')})
- Cash Revenue: ₹${metrics.cashRevenue.toLocaleString('en-IN')}, UPI Revenue: ₹${metrics.upiRevenue.toLocaleString('en-IN')}
- Peak Slot Occupancy (Fri-Sun evening): ${metrics.peakOccupancyPct}%
- Weekday Afternoon Occupancy (12-4 PM): ${metrics.deadZoneOccupancyPct}%
- Unbooked Afternoon Slots: ${metrics.unbookedAfternoonSlots}
- Total Matches: ${metrics.totalMatches}, Unique Teams: ${metrics.uniqueTeams}
- New Squads: ${metrics.newTeamsCount}
- Star Team: ${metrics.starTeamName} (${metrics.starTeamMatches} matches)
- Average Customer Rating: ${metrics.averageRating} / 5.0 (${metrics.totalRatings} reviews)
- Player Feedback Comments:
${metrics.feedbackComments.length > 0 ? metrics.feedbackComments.join('\n') : 'No written complaints this week; smooth operations.'}

Formatting Rules:
1. Use "Cricket Turf" (NEVER Box Cricket) and "Football Turf".
2. Follow this structure:
   📊 *SHRI TRIMURTI ARENA — WEEKLY EXECUTIVE SUMMARY*
   🗓️ *Period: ${period}*
   💰 *1. REVENUE PERFORMANCE*
   ⚡ *2. UNTAPPED SLOT OPPORTUNITY*
   🚨 *3. GROUND SENTIMENT & MAINTENANCE*
   👥 *4. SQUAD ACTIVITY*
3. For maintenance, highlight any complaints about water, lights, turf net, or pitch from player comments.
4. For untapped opportunity, craft 1 actionable, realistic business idea for the unbooked afternoon slots.
5. Keep it under 220 words. Output ONLY the plain WhatsApp text.
`;

    const candidateModels = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    for (const model of candidateModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 2000,
            },
          }),
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (rawText && rawText.length > 100 && rawText.includes('REVENUE PERFORMANCE') && rawText.includes('UNTAPPED SLOT OPPORTUNITY')) {
        return rawText;
      }
    }
  } catch (err) {
    console.error('[WEEKLY BI AI SYNTHESIS ERROR]', err.message);
  }

  return fallback;
}

/**
 * Runs the weekly BI report, stores it in the database, and dispatches to Admin WhatsApp.
 * @param {Object} [options]
 * @param {boolean} [options.dispatchWhatsApp=true]
 * @param {boolean} [options.trailing7Days=false]
 * @param {Object} [options.io=null]
 * @returns {Promise<Object>}
 */
async function generateWeeklyExecutiveSummary({ dispatchWhatsApp = true, trailing7Days = false, io = null } = {}) {
  console.log('[WEEKLY BI] Generating Weekly Executive Summary...');

  const dateRange = getWeekDateRange(trailing7Days);
  const metrics = await computeWeeklyMetrics(dateRange.start, dateRange.end, dateRange.prevStart, dateRange.prevEnd);

  const summaryText = await synthesizeExecutiveSummary(dateRange.formattedPeriod, metrics);

  // Save to database
  const insertRes = await pool.query(`
    INSERT INTO weekly_executive_summaries (
      period_start, period_end, total_revenue, previous_revenue,
      growth_percentage, cricket_revenue, football_revenue,
      matches_count, unique_teams_count, peak_occupancy_pct,
      dead_zone_occupancy_pct, unbooked_afternoon_slots,
      average_rating, star_team_name, star_team_matches,
      raw_data_json, generated_summary_text, dispatched_to_admin
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING *
  `, [
    dateRange.start,
    dateRange.end,
    metrics.totalRevenue,
    metrics.previousRevenue,
    metrics.growthPercentage,
    metrics.cricketRevenue,
    metrics.footballRevenue,
    metrics.totalMatches,
    metrics.uniqueTeams,
    metrics.peakOccupancyPct,
    metrics.deadZoneOccupancyPct,
    metrics.unbookedAfternoonSlots,
    metrics.averageRating,
    metrics.starTeamName,
    metrics.starTeamMatches,
    JSON.stringify(metrics),
    summaryText,
    dispatchWhatsApp,
  ]);

  const savedRecord = insertRes.rows[0];

  // Dispatch to Admin WhatsApp if enabled
  if (dispatchWhatsApp) {
    const adminPhoneRaw = (process.env.ADMIN_PHONE || '919595153006').replace(/\D/g, '');
    const adminPhone = adminPhoneRaw.startsWith('91') ? adminPhoneRaw : `91${adminPhoneRaw}`;

    sendTextMessage({ to: adminPhone, text: summaryText }).catch((err) =>
      console.error('[WEEKLY BI ADMIN WHATSAPP DISPATCH ERROR]', err.message)
    );
  }

  if (io) {
    io.emit('weekly_summary_generated', { id: savedRecord.id, period: dateRange.formattedPeriod });
  }

  return {
    success: true,
    summaryId: savedRecord.id,
    period: dateRange.formattedPeriod,
    metrics,
    summaryText,
  };
}

/**
 * Returns past weekly executive summaries.
 * @param {number} [limit=12]
 */
async function getWeeklySummariesHistory(limit = 12) {
  const res = await pool.query(`
    SELECT *
    FROM weekly_executive_summaries
    ORDER BY period_start DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return res.rows;
}

module.exports = {
  generateWeeklyExecutiveSummary,
  getWeeklySummariesHistory,
  getWeekDateRange,
  computeWeeklyMetrics,
};
