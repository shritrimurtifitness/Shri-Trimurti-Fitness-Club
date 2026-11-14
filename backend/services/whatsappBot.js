const pool = require('../config/db');
const cache = require('../config/cache');
const { normalizeTo10Digits } = require('../utils/phone');
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
 * Returns YYYY-MM-DD for a given offset from today in Asia/Kolkata timezone
 */
function getISTDate(offsetDays = 0) {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  now.setDate(now.getDate() + offsetDays);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats YYYY-MM-DD into a human-friendly label (e.g. "Wed, 11 Nov")
 */
function formatDisplayDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = String(dateStr).substring(0, 10).split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  return dateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

/**
 * Fetches dynamic UPI configuration from database / Redis cache (Cloudinary QR)
 */
async function getLiveUpiSettings() {
  const fallbackQr = 'https://res.cloudinary.com/dvie6djfw/image/upload/v1794394762/shri-trimurti-fitness-club/upi-qr/active_upi_qr.png';
  const fallbackUpi = process.env.UPI_ID || 'harshvardhanp@slc';

  try {
    const cached = await cache.get('site:settings');
    if (cached) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      if (parsed?.upi_qr_url) {
        return {
          upi_id: parsed.upi_id || fallbackUpi,
          upi_qr_url: parsed.upi_qr_url.startsWith('http') ? parsed.upi_qr_url : fallbackQr,
        };
      }
    }
  } catch (err) {
    // ignore cache failure
  }

  try {
    const res = await pool.query('SELECT upi_id, upi_qr_url FROM site_settings WHERE id = 1');
    if (res.rows.length > 0) {
      const dbQr = res.rows[0].upi_qr_url;
      const dbUpi = res.rows[0].upi_id;
      return {
        upi_id: dbUpi || fallbackUpi,
        upi_qr_url: (dbQr && dbQr.startsWith('http')) ? dbQr : fallbackQr,
      };
    }
  } catch (dbErr) {
    console.error('Error fetching dynamic UPI settings from DB:', dbErr);
  }

  return {
    upi_id: fallbackUpi,
    upi_qr_url: fallbackQr,
  };
}

/**
 * Detects whether the user's message mentions a specific upcoming date/day (e.g. tomorrow, kal, friday)
 */
function parseNaturalDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (t.includes('tomorrow') || t.includes('kal') || t.includes('udya')) {
    return getISTDate(1);
  }
  if (t.includes('today') || t.includes('aaj')) {
    return getISTDate(0);
  }
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  for (let i = 0; i < days.length; i++) {
    if (t.includes(days[i])) {
      const currentDay = now.getDay();
      let diff = i - currentDay;
      if (diff <= 0) diff += 7;
      return getISTDate(diff);
    }
  }
  return null;
}

/**
 * Detects whether the user's message mentions a specific session / time band
 * Returns 'morning' | 'afternoon' | 'night' | null
 */
function parseTimeBand(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (
    t.includes('morning') ||
    t.includes('sakal') ||
    t.includes('subah') ||
    t.includes('early')
  ) {
    return 'morning';
  }
  if (
    t.includes('afternoon') ||
    t.includes('dupari') ||
    t.includes('dophar') ||
    t.includes('noon')
  ) {
    return 'afternoon';
  }
  if (
    t.includes('night') ||
    t.includes('evening') ||
    t.includes('floodlight') ||
    t.includes('floodlit') ||
    t.includes('ratri') ||
    t.includes('rat') ||
    t.includes('shaam') ||
    t.includes('sandhyakal')
  ) {
    return 'night';
  }
  return null;
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
 * Formats hour integer (e.g. 5, 23) into clean 12h time (e.g. "5:00 AM", "11:00 PM")
 */
function formatHourNumber(h) {
  const num = parseInt(h, 10);
  if (isNaN(num)) return '5:00 AM';
  if (num === 0 || num === 24) return '12:00 AM';
  if (num === 12) return '12:00 PM';
  if (num < 12) return `${num}:00 AM`;
  return `${num - 12}:00 PM`;
}

/**
 * Checks if a slot time overlaps with tournament active daily window
 */
function isSlotInTournament(slotStart, slotEnd, dStart, dEnd) {
  const sStart = slotStart.slice(0, 5);
  const sEnd = slotEnd.slice(0, 5);
  const tStart = (dStart || '18:00').slice(0, 5);
  const tEnd = (dEnd || '23:00').slice(0, 5);
  if (tStart <= tEnd) {
    return sStart < tEnd && sEnd > tStart;
  } else {
    return sStart >= tStart || sEnd <= tEnd;
  }
}

/**
 * Queries Neon DB for available slots for a specific date and facility type ('cricket' | 'football')
 * Supports filtering by 3 Time Bands: 'morning', 'afternoon', 'night'
 * Automatically excludes tournament-blocked slots and respects arena/turf closures.
 */
async function getAvailableSlotsForDate(facilityType = 'cricket', targetDate = null, timeBand = null) {
  try {
    const today = getTodayString();
    const dateToQuery = targetDate || today;
    const isToday = (dateToQuery === today);
    const nowIST = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

    // 1. Fetch turf info
    const turfRes = await pool.query(
      `SELECT id, name, facility_type, physical_resource_id, opening_hour, closing_hour, weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price 
       FROM turfs 
       WHERE facility_type ILIKE $1 AND is_active = true 
       LIMIT 1`,
      [`%${facilityType}%`]
    );

    if (turfRes.rows.length === 0) {
      return { isClosed: false, slots: [], facilityName: 'Turf', date: dateToQuery, timeBand, counts: { morning: 0, afternoon: 0, night: 0, total: 0 } };
    }

    const turf = turfRes.rows[0];

    // 2. Check if turf/club is closed on this date
    const closureCheck = await pool.query(
      'SELECT reason FROM arena_closures WHERE date = $1 AND (turf_id IS NULL OR turf_id = $2)',
      [dateToQuery, turf.id]
    );
    if (closureCheck.rows.length > 0) {
      return {
        isClosed: true,
        reason: closureCheck.rows[0].reason || 'Club closed for maintenance on this date',
        facilityName: turf.name,
        slots: [],
        date: dateToQuery,
        timeBand,
        counts: { morning: 0, afternoon: 0, night: 0, total: 0 },
      };
    }

    // 3. Check for active tournament on this date (direct or shared resource turf)
    const tournamentCheck = await pool.query(`
      SELECT name, is_full_day, daily_start_time, daily_end_time 
      FROM tournaments
      WHERE is_active = true
        AND (
          LOWER(sport_type) = LOWER($1)
          OR (
            $2::int IS NOT NULL AND EXISTS (
              SELECT 1 FROM turfs t_shared
              WHERE t_shared.physical_resource_id = $2::int
              AND LOWER(t_shared.facility_type) = LOWER(tournaments.sport_type)
            )
          )
        )
        AND $3 >= start_date::date
        AND $3 <= end_date::date
      ORDER BY created_at DESC
      LIMIT 1
    `, [turf.facility_type, turf.physical_resource_id, dateToQuery]);

    let activeTournament = null;
    if (tournamentCheck.rows.length > 0) {
      activeTournament = tournamentCheck.rows[0];
      if (activeTournament.is_full_day) {
        return {
          isClosed: true,
          isTournament: true,
          tournamentName: activeTournament.name,
          reason: `Turf is reserved for the whole day for "${activeTournament.name}"`,
          facilityName: turf.name,
          slots: [],
          date: dateToQuery,
          timeBand,
          counts: { morning: 0, afternoon: 0, night: 0, total: 0 },
        };
      }
    }

    // 4. Ensure slots are generated for this date
    try {
      await pool.query('SELECT generate_daily_slots($1, $2)', [dateToQuery, turf.id]);
    } catch {
      // Ignore if function already populated
    }

    // 5. Query vacant slots for the date
    let bandSqlClause = '';
    if (timeBand === 'morning') {
      bandSqlClause = "AND s.start_time < '12:00:00'";
    } else if (timeBand === 'afternoon') {
      bandSqlClause = "AND s.start_time >= '12:00:00' AND s.start_time < '18:00:00'";
    } else if (timeBand === 'night') {
      bandSqlClause = "AND s.start_time >= '18:00:00'";
    }

    const query = `
      SELECT s.id, s.start_time, s.end_time, s.price, s.date
      FROM slots s
      JOIN turfs t ON s.turf_id = t.id
      WHERE s.turf_id = $1
        AND s.date = $2
        AND s.is_available = true
        AND ($4 = false OR s.end_time > $3)
        ${bandSqlClause}
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
    `;

    const slotsRes = await pool.query(query, [turf.id, dateToQuery, nowIST, isToday]);

    const rawSlots = slotsRes.rows.map((row) => {
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

    // Exclude tournament slots from available slots
    let formattedSlots = rawSlots;
    if (activeTournament && !activeTournament.is_full_day) {
      formattedSlots = formattedSlots.filter((s) =>
        !isSlotInTournament(s.start_time, s.end_time, activeTournament.daily_start_time, activeTournament.daily_end_time)
      );
    }

    // Compute session slot counts
    let morningCount = 0;
    let afternoonCount = 0;
    let nightCount = 0;

    if (!timeBand) {
      morningCount = formattedSlots.filter((s) => s.start_time < '12:00:00').length;
      afternoonCount = formattedSlots.filter((s) => s.start_time >= '12:00:00' && s.start_time < '18:00:00').length;
      nightCount = formattedSlots.filter((s) => s.start_time >= '18:00:00').length;
    } else {
      if (timeBand === 'morning') morningCount = formattedSlots.length;
      if (timeBand === 'afternoon') afternoonCount = formattedSlots.length;
      if (timeBand === 'night') nightCount = formattedSlots.length;
    }

    // Dynamic weekend vs weekday pricing
    const queryDay = new Date(dateToQuery).getDay();
    const isWeekend = queryDay === 0 || queryDay === 6;
    const dayPrice = Math.round(Number(isWeekend ? (turf.weekend_day_price || 700) : (turf.weekday_day_price || 700)));
    const nightPrice = Math.round(Number(isWeekend ? (turf.weekend_night_price || 1000) : (turf.weekday_night_price || 900)));

    return {
      isClosed: false,
      turfId: turf.id,
      date: dateToQuery,
      isToday,
      timeBand,
      facilityName: turf.name || (facilityType === 'football' ? 'Football Turf' : 'Cricket Turf'),
      activeTournament,
      dayPrice,
      nightPrice,
      openingHour: turf.opening_hour || 5,
      closingHour: turf.closing_hour || 23,
      slots: formattedSlots,
      counts: {
        morning: morningCount,
        afternoon: afternoonCount,
        night: nightCount,
        total: formattedSlots.length,
      },
    };
  } catch (err) {
    console.error('Error fetching available slots for date:', err.message);
    return { isClosed: false, slots: [], error: true, date: targetDate, timeBand, counts: { morning: 0, afternoon: 0, night: 0, total: 0 } };
  }
}

/**
 * Backward compatibility wrapper for today's slots
 */
function getTodayAvailableSlots(facilityType = 'cricket') {
  return getAvailableSlotsForDate(facilityType, getTodayString());
}

/**
 * Sends a 3-button date selection prompt (Today, Tomorrow, Next 7 Days)
 */
async function sendDatePickerPrompt({ to, facilityType = 'cricket' }) {
  const isCricket = facilityType.toLowerCase().includes('cricket');
  const sportEmoji = isCricket ? '🏏' : '⚽';
  const sportName = isCricket ? 'Cricket Turf' : 'Football Turf';

  const todayStr = getISTDate(0);
  const tomorrowStr = getISTDate(1);
  const todayLabel = formatDisplayDate(todayStr).split(', ')[1] || 'Today';
  const tomorrowLabel = formatDisplayDate(tomorrowStr).split(', ')[1] || 'Tomorrow';

  const todayBtn = (`📅 Today (${todayLabel})`).length <= 20 ? `📅 Today (${todayLabel})` : '📅 Today';
  const tomorrowBtn = (`📅 Tomorrow (${tomorrowLabel})`).length <= 20 ? `📅 Tomorrow (${tomorrowLabel})` : '📅 Tomorrow';

  return sendInteractiveButtons({
    to,
    headerText: `${sportEmoji} ${sportName}`,
    bodyText: `Which date would you like to book for *${sportName}*?\n\nChoose *Today*, *Tomorrow*, or browse upcoming dates:`,
    buttons: [
      { id: `DATE_${todayStr}_${facilityType}`, title: todayBtn },
      { id: `DATE_${tomorrowStr}_${facilityType}`, title: tomorrowBtn },
      { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Next 7 Days' },
    ],
  });
}

/**
 * Sends a WhatsApp List Menu showing the upcoming 7 calendar days
 */
async function sendDateListMenu({ to, facilityType = 'cricket' }) {
  const isCricket = facilityType.toLowerCase().includes('cricket');
  const sportEmoji = isCricket ? '🏏' : '⚽';
  const sportName = isCricket ? 'Cricket Turf' : 'Football Turf';

  const rows = [];
  for (let i = 0; i < 7; i++) {
    const dStr = getISTDate(i);
    const dLabel = formatDisplayDate(dStr);
    const prefix = i === 0 ? 'Today • ' : i === 1 ? 'Tomorrow • ' : '';
    rows.push({
      id: `DATE_${dStr}_${facilityType}`,
      title: `${prefix}${dLabel}`.substring(0, 24),
      description: `View available ${sportName} slots`,
    });
  }

  const sections = [
    {
      title: 'Upcoming 7 Days',
      rows,
    },
  ];

  return sendInteractiveList({
    to,
    headerText: `${sportEmoji} ${sportName} Dates`,
    bodyText: `Select any of the upcoming 7 days to view live available slots for *${sportName}*:`,
    buttonTitle: '📅 Choose Date',
    sections,
    footerText: 'Shri Trimurti Fitness Club',
  });
}

/**
 * Fetches dynamic turf pricing, amenities, and operating hours from Neon DB
 */
async function getDynamicFacilityDetails() {
  try {
    const res = await pool.query(`
      SELECT name, facility_type, opening_hour, closing_hour, 
             weekday_day_price, weekday_night_price, weekend_day_price, weekend_night_price 
      FROM turfs 
      WHERE is_active = true 
      ORDER BY name ASC
    `);

    let settingsHours = null;
    try {
      const sRes = await pool.query('SELECT working_hours FROM settings LIMIT 1');
      if (sRes.rows.length > 0 && sRes.rows[0].working_hours) {
        settingsHours = sRes.rows[0].working_hours;
      }
    } catch {
      // Ignore if settings table not present
    }

    const turfs = res.rows;
    let minOpen = 5;
    let maxClose = 23;

    if (turfs.length > 0) {
      const openHours = turfs.map((t) => Number(t.opening_hour)).filter((h) => !isNaN(h));
      const closeHours = turfs.map((t) => Number(t.closing_hour)).filter((h) => !isNaN(h));
      if (openHours.length > 0) minOpen = Math.min(...openHours);
      if (closeHours.length > 0) maxClose = Math.max(...closeHours);
    }

    const openStr = formatHourNumber(minOpen);
    const closeStr = formatHourNumber(maxClose);
    const operatingHoursStr = settingsHours || `Mon - Sun: ${openStr} - ${closeStr}`;

    return {
      turfs,
      minOpen,
      maxClose,
      operatingHoursStr,
      openStr,
      closeStr,
    };
  } catch (err) {
    console.error('Error fetching facility details:', err.message);
    return {
      turfs: [],
      minOpen: 5,
      maxClose: 23,
      operatingHoursStr: 'Mon - Sun: 5:00 AM - 11:00 PM',
      openStr: '5:00 AM',
      closeStr: '11:00 PM',
    };
  }
}

/**
 * Sends a 3-button Time Band prompt:
 * 1. 🌙 Night (6:00 PM to closingHour)
 * 2. ☀️ Morning (openingHour to 12:00 PM)
 * 3. ⛅ Afternoon (12:00 PM to 6:00 PM)
 */
async function sendTimeBandPrompt({ to, facilityType = 'cricket', date, counts = null, result = null }) {
  const isCricket = facilityType.toLowerCase().includes('cricket');
  const sportEmoji = isCricket ? '🏏' : '⚽';
  const sportName = isCricket ? 'Cricket Turf' : 'Football Turf';
  const todayIST = getTodayString();
  const tomorrowIST = getISTDate(1);
  const dateFormatted = formatDisplayDate(date);
  const dateLabel = date === todayIST ? `Today (${dateFormatted})` : date === tomorrowIST ? `Tomorrow (${dateFormatted})` : dateFormatted;

  const mCount = counts ? counts.morning : (result ? result.counts.morning : 6);
  const aCount = counts ? counts.afternoon : (result ? result.counts.afternoon : 6);
  const nCount = counts ? counts.night : (result ? result.counts.night : 6);

  const dayPrice = result?.dayPrice || 700;
  const nightPrice = result?.nightPrice || 900;
  const openStr = formatHourNumber(result?.openingHour || 5);
  const closeStr = formatHourNumber(result?.closingHour || 23);
  const activeTournament = result?.activeTournament || null;

  const buttons = [];
  // Night first as prime-time
  if (nCount > 0) {
    buttons.push({ id: `BAND_${date}_${facilityType}_night`, title: '🌙 Night (6-11)' });
  }
  if (mCount > 0) {
    buttons.push({ id: `BAND_${date}_${facilityType}_morning`, title: `☀️ Morning (${openStr.replace(':00', '')}-12)` });
  }
  if (aCount > 0) {
    buttons.push({ id: `BAND_${date}_${facilityType}_afternoon`, title: '⛅ Afternoon (12-6)' });
  }

  if (buttons.length === 0) {
    buttons.push({ id: `DATE_PICKER_${facilityType}`, title: '🗓️ Pick Another Date' });
  } else if (buttons.length < 3) {
    buttons.push({ id: `DATE_PICKER_${facilityType}`, title: '🗓️ Other Date' });
  }

  let tournamentAlert = '';
  if (activeTournament) {
    const tStart = formatTime12h(activeTournament.daily_start_time || '18:00');
    const tEnd = formatTime12h(activeTournament.daily_end_time || '23:00');
    tournamentAlert = `\n🏆 *Tournament Alert:* Matches for _${activeTournament.name}_ run *${tStart} - ${tEnd}*. Other session slots are open!\n`;
  }

  const bodyText =
`Which match session would you like to book for *${sportName}* on *${dateLabel}*?
${tournamentAlert}
🌙 *Floodlit Night (6:00 PM - ${closeStr}):* ${nCount > 0 ? `${nCount} open (₹${nightPrice}/hr)` : activeTournament ? '🏆 Reserved for Tournament' : 'Booked Full'}
☀️ *Morning (${openStr} - 12:00 PM):* ${mCount > 0 ? `${mCount} open (₹${dayPrice}/hr)` : 'Booked Full'}
⛅ *Afternoon (12:00 PM - 6:00 PM):* ${aCount > 0 ? `${aCount} open (₹${dayPrice}/hr)` : 'Booked Full'}

👇 *Tap a session below to view live slots:*`;

  return sendInteractiveButtons({
    to,
    headerText: `${sportEmoji} ${sportName} Sessions`,
    bodyText,
    buttons: buttons.slice(0, 3),
  });
}

/**
 * Sends an interactive list menu displaying available slots for the selected date and time band
 */
async function sendSlotsListMenu({ to, facilityType = 'cricket', date, timeBand = null, result }) {
  const isCricket = facilityType.toLowerCase().includes('cricket');
  const sportEmoji = isCricket ? '🏏' : '⚽';
  const sportName = isCricket ? 'Cricket Turf' : 'Football Turf';
  const todayIST = getTodayString();
  const tomorrowIST = getISTDate(1);
  const dateFormatted = formatDisplayDate(date);
  const dateLabel = date === todayIST ? `Today (${dateFormatted})` : date === tomorrowIST ? `Tomorrow (${dateFormatted})` : dateFormatted;

  const openStr = formatHourNumber(result?.openingHour || 5);
  const closeStr = formatHourNumber(result?.closingHour || 23);

  const bandHeaders = {
    morning: `☀️ Morning (${openStr} - 12:00 PM)`,
    afternoon: `⛅ Afternoon (12:00 PM - 6:00 PM)`,
    night: `🌙 Floodlit Night (6:00 PM - ${closeStr})`,
  };
  const sessionLabel = timeBand && bandHeaders[timeBand] ? ` • ${bandHeaders[timeBand]}` : '';

  if (result.isClosed) {
    if (result.isTournament) {
      return sendInteractiveButtons({
        to,
        headerText: 'Tournament Match Day',
        bodyText: `🏆 *${result.tournamentName}*\n\nThe ${sportName} is reserved for the entire day on *${dateLabel}* for tournament matches.\n\nYou are welcome to visit the club to watch the matches! Would you like to check another date or sport?`,
        buttons: [
          { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Pick Another Date' },
          { id: isCricket ? 'BTN_FOOTBALL_SLOTS' : 'BTN_CRICKET_SLOTS', title: isCricket ? '⚽ Check Football' : '🏏 Check Cricket' },
          { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
        ],
      });
    }

    return sendInteractiveButtons({
      to,
      headerText: `${sportName} Closed`,
      bodyText: `⚠️ *Update for ${dateLabel}:*\n${result.reason}\n\nWould you like to check another date or speak with our desk staff?`,
      buttons: [
        { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Pick Another Date' },
        { id: isCricket ? 'BTN_FOOTBALL_SLOTS' : 'BTN_CRICKET_SLOTS', title: isCricket ? '⚽ Check Football' : '🏏 Check Cricket' },
        { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
      ],
    });
  }

  if (!result.slots || result.slots.length === 0) {
    if (result.activeTournament && timeBand === 'night') {
      return sendInteractiveButtons({
        to,
        headerText: 'Tournament Session',
        bodyText: `🏆 Evening slots on *${dateLabel}* are reserved for *${result.activeTournament.name}* (${formatTime12h(result.activeTournament.daily_start_time || '18:00')} - ${formatTime12h(result.activeTournament.daily_end_time || '23:00')}).\n\nMorning and afternoon slots are open for regular bookings!`,
        buttons: [
          { id: `SESSION_PICKER_${date}_${facilityType}`, title: '☀️ Other Sessions' },
          { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Pick Another Date' },
          { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
        ],
      });
    }

    return sendInteractiveButtons({
      to,
      headerText: `${sportEmoji} ${sportName}`,
      bodyText:
        `All slots for *${dateLabel}${sessionLabel}* are currently booked or have passed!\n\nWould you like to check other sessions or pick another date?`,
      buttons: [
        { id: `SESSION_PICKER_${date}_${facilityType}`, title: '⏰ Other Sessions' },
        { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Other Date' },
        { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
      ],
    });
  }

  const slotsList = result.slots
    .map((s) => `• *${s.timeLabel}* (₹${s.price})`)
    .join('\n');

  const rows = result.slots.slice(0, 10).map((s) => ({
    id: `BOOK_SLOT_${s.id}`,
    title: s.timeLabel.substring(0, 24),
    description: `₹${s.price} • Tap to Book with UPI`,
  }));

  const sectionTitle = (timeBand && bandHeaders[timeBand])
    ? bandHeaders[timeBand].substring(0, 24)
    : `${dateLabel} Slots`.substring(0, 24);

  const sections = [
    {
      title: sectionTitle,
      rows,
    },
  ];

  return sendInteractiveList({
    to,
    headerText: `${sportEmoji} ${sportName}`,
    bodyText:
`*AVAILABLE ${sportName.toUpperCase()} SLOTS FOR ${dateLabel.toUpperCase()}:*
${timeBand && bandHeaders[timeBand] ? `📌 Session: *${bandHeaders[timeBand]}*\n` : ''}
${slotsList}

👉 *Tap "Choose Slot" below to reserve directly on WhatsApp with UPI QR code:*`,
    buttonTitle: '📅 Choose Slot',
    sections,
    footerText: 'Shri Trimurti Fitness Club',
  });
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

    // Check if turf is closed on this date
    const closureCheck = await pool.query(
      'SELECT reason FROM arena_closures WHERE date = $1 AND (turf_id IS NULL OR turf_id = $2)',
      [slot.date, slot.turf_id]
    );
    if (closureCheck.rows.length > 0) {
      return sendTextMessage({
        to: from,
        text: `⚠️ The turf is closed on ${slotDateStr}: ${closureCheck.rows[0].reason || 'Club maintenance'}. Please pick another date!`,
      });
    }

    // Check if slot overlaps with an active tournament
    const tournamentCheck = await pool.query(`
      SELECT name, is_full_day, daily_start_time, daily_end_time 
      FROM tournaments
      WHERE is_active = true
        AND (
          LOWER(sport_type) = LOWER($1)
          OR (
            $2::int IS NOT NULL AND EXISTS (
              SELECT 1 FROM turfs t_shared
              WHERE t_shared.physical_resource_id = $2::int
              AND LOWER(t_shared.facility_type) = LOWER(tournaments.sport_type)
            )
          )
        )
        AND $3 >= start_date::date
        AND $3 <= end_date::date
      ORDER BY created_at DESC
      LIMIT 1
    `, [slot.facility_type, slot.physical_resource_id, slotDateStr]);

    if (tournamentCheck.rows.length > 0) {
      const tMatch = tournamentCheck.rows[0];
      const isBlocked = tMatch.is_full_day || isSlotInTournament(slot.start_time, slot.end_time, tMatch.daily_start_time, tMatch.daily_end_time);
      if (isBlocked) {
        return sendInteractiveButtons({
          to: from,
          headerText: 'Slot Reserved for Tournament',
          bodyText: `🏆 The ${formatTime12h(slot.start_time)} - ${formatTime12h(slot.end_time)} slot is reserved for *${tMatch.name}*.\n\nWould you like to check remaining slots?`,
          buttons: [
            { id: `DATE_${slotDateStr}_${slot.facility_type}`, title: '🗓️ Check Other Slots' },
            { id: `DATE_PICKER_${slot.facility_type}`, title: '🗓️ Pick Another Date' },
            { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
          ],
        });
      }
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

    const { upi_id: upiId, upi_qr_url: qrUrl } = await getLiveUpiSettings();
    const upiPayLink = `upi://pay?pa=${upiId}&am=${price}&pn=Trimurti`;

    // 1. Send the Cloudinary-hosted UPI QR code image
    await sendImageMessage({
      to: from,
      imageUrl: qrUrl,
      caption: `📲 Scan to Pay ₹${price} for ${turfName}\n⏰ Slot: ${timeStr} (${slotDateStr})`,
    });

    // 2. Send clean, single-screen mobile-optimized payment instructions
    const paymentInstructions =
`📋 *SLOT RESERVED (15 MINS)*
🏟️ *Turf:* ${turfName}
📅 *Date:* ${slotDateStr}
⏰ *Time:* ${timeStr}
💰 *Amount Due:* *₹${price}*

📲 *Pay via UPI:*
👉 *UPI ID:* \`${upiId}\`
👉 *1-Tap Pay:* ${upiPayLink}

⚡ *ACTION REQUIRED TO CONFIRM:*
Reply here with your *12-digit UPI Ref ID*:
👉 Example: \`431289012345\`
*(Or upload your payment screenshot)*

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
        text: '⚠️ Please enter a valid 12-digit UPI Ref ID (found on your payment receipt in GPay, PhonePe, or Paytm).',
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
        headerText: 'Duplicate UPI Ref ID',
        bodyText: `⚠️ The UPI Ref ID (*${cleanUtr}*) has already been submitted for another booking.\n\nPlease check your receipt or contact our desk if this is an error.`,
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
        bodyText: `⚠️ Apologies! This slot was booked right before your UPI Ref ID was received.\n\nPlease contact our arena manager to assign you another slot or issue an immediate refund.`,
        buttons: [
          { id: 'BTN_STAFF', title: '👤 Call Manager' },
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Other Slots' },
        ],
      });
    }

    // Find or create user - standardize to 10-digit number without country code
    const customerPhone = normalizeTo10Digits(from);
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
💳 *UPI Ref ID:* ${cleanUtr}

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
    if (!reviewUrl || reviewUrl.includes('CQ5GqNxPpdl4ECE') || reviewUrl.includes('Akola') || reviewUrl.includes('search?q=')) {
      reviewUrl = 'https://maps.app.goo.gl/XCxniFWMMtnfw2MJA';
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
  const isApproveAction = payload.startsWith('BTN_ADMIN_APPROVE_') ||
    payload.toLowerCase() === 'approve payment' ||
    normalizedText === 'approve payment' ||
    normalizedText === 'approve';

  const isRejectAction = payload.startsWith('BTN_ADMIN_REJECT_') ||
    payload.toLowerCase() === 'reject payment' ||
    normalizedText === 'reject payment' ||
    normalizedText === 'reject';

  if (isApproveAction || isRejectAction) {
    const isApprove = isApproveAction;
    let targetBookingId = '';
    if (payload.startsWith('BTN_ADMIN_APPROVE_') || payload.startsWith('BTN_ADMIN_REJECT_')) {
      targetBookingId = payload.replace(isApprove ? 'BTN_ADMIN_APPROVE_' : 'BTN_ADMIN_REJECT_', '').trim();
    }

    const cleanFrom = from.replace(/\D/g, '');
    const isAdmin = await adminBookingService.isAuthorizedAdmin(cleanFrom);
    if (!isAdmin) {
      return sendTextMessage({
        to: from,
        text: '⛔ *Unauthorized:* Only registered club administrators can approve or reject bookings from WhatsApp.',
      });
    }

    // If bookingId wasn't passed directly in payload, find the most recent pending verification booking
    if (!targetBookingId) {
      const recentPending = await pool.query(
        `SELECT id FROM bookings WHERE status = 'pending_verification' OR payment_status = 'pending_verification' ORDER BY created_at DESC LIMIT 1`
      );
      if (recentPending.rows.length > 0) {
        targetBookingId = recentPending.rows[0].id;
      }
    }

    if (!targetBookingId) {
      return sendTextMessage({
        to: from,
        text: 'ℹ️ No pending booking found awaiting approval.',
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
        text: `✅ *Booking #${result.bookingCode} Approved!* 🏏⚽\n\nPlayer *${result.customerName}* has been issued their official Digital Entry Pass with QR code on WhatsApp!\n\n🏟️ *Turf:* ${result.turfName}\n📅 *Date:* ${result.dateStr}\n⏰ *Time:* ${result.timeStr}\n💰 *Amount:* ₹${result.amount}\n💳 *UPI Ref ID:* ${result.utr || 'N/A'}`,
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
        bodyText: `📸 Thank you! We received your payment confirmation.\n\nTo ensure instant verification with our bank, please type and send the *12-digit UPI Ref ID* from your receipt (e.g. \`431289012345\`).`,
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
      bodyText: `⏳ We are holding your ${activeSession.turfName} slot (${activeSession.timeStr}) for ₹${activeSession.price}.\n\nTo complete your booking, please reply with your *12-digit UPI Ref ID*.\n\nOr tap below to cancel:`,
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
  // B0. Handle Session / Time Band Picker Request (e.g. SESSION_PICKER_2026-11-12_cricket)
  // ----------------------------------------------------
  if (payload.startsWith('SESSION_PICKER_')) {
    const parts = payload.replace('SESSION_PICKER_', '').split('_');
    const selectedDate = parts[0];
    const facilityType = parts[1] || 'cricket';

    const result = await getAvailableSlotsForDate(facilityType, selectedDate, null);
    if (result.isClosed) {
      return sendSlotsListMenu({ to: from, facilityType, date: selectedDate, timeBand: null, result });
    }
    return sendTimeBandPrompt({ to: from, facilityType, date: selectedDate, counts: result.counts, result });
  }

  // ----------------------------------------------------
  // B1. Handle Time Band Selection Click (e.g. BAND_2026-11-12_cricket_night)
  // ----------------------------------------------------
  if (payload.startsWith('BAND_')) {
    const parts = payload.replace('BAND_', '').split('_');
    const selectedDate = parts[0];
    const facilityType = parts[1] || 'cricket';
    const timeBand = parts[2] || 'night';

    const result = await getAvailableSlotsForDate(facilityType, selectedDate, timeBand);
    return sendSlotsListMenu({ to: from, facilityType, date: selectedDate, timeBand, result });
  }

  // ----------------------------------------------------
  // B2. Handle Date Picker List Request (e.g. DATE_PICKER_cricket)
  // ----------------------------------------------------
  if (payload.startsWith('DATE_PICKER_')) {
    const facilityType = payload.replace('DATE_PICKER_', '').trim();
    return sendDateListMenu({ to: from, facilityType });
  }

  // ----------------------------------------------------
  // B3. Handle Date Selection Click (e.g. DATE_2026-11-12_cricket)
  // ----------------------------------------------------
  if (payload.startsWith('DATE_')) {
    const parts = payload.replace('DATE_', '').split('_');
    const selectedDate = parts[0];
    const facilityType = parts[1] || 'cricket';

    const result = await getAvailableSlotsForDate(facilityType, selectedDate, null);

    if (result.isClosed) {
      return sendSlotsListMenu({ to: from, facilityType, date: selectedDate, timeBand: null, result });
    }

    if (!result.slots || result.slots.length === 0) {
      const isCricket = facilityType.toLowerCase().includes('cricket');
      const sportName = isCricket ? 'Cricket Turf' : 'Football Turf';
      const dateFormatted = formatDisplayDate(selectedDate);
      return sendInteractiveButtons({
        to: from,
        headerText: sportName,
        bodyText: `No vacant slots available for *${dateFormatted}*.\n\nWould you like to pick another date or check ${isCricket ? 'Football' : 'Cricket'}?`,
        buttons: [
          { id: `DATE_PICKER_${facilityType}`, title: '🗓️ Pick Another Date' },
          { id: isCricket ? 'BTN_FOOTBALL_SLOTS' : 'BTN_CRICKET_SLOTS', title: isCricket ? '⚽ Check Football' : '🏏 Check Cricket' },
          { id: 'BTN_STAFF', title: '👤 Talk to Desk' },
        ],
      });
    }

    // If available slots > 10, present Option 3: 3 Time Bands
    if (result.slots.length > 10) {
      return sendTimeBandPrompt({ to: from, facilityType, date: selectedDate, counts: result.counts, result });
    }

    // If 10 or fewer slots, display them directly in the list
    return sendSlotsListMenu({ to: from, facilityType, date: selectedDate, timeBand: null, result });
  }

  // ----------------------------------------------------
  // C. Handle standalone 12-digit UTR sent without active session
  // ----------------------------------------------------
  const standaloneUtrMatch = (text || '').match(/\b\d{10,18}\b/);
  if (standaloneUtrMatch && !activeSession) {
    const customerPhone = normalizeTo10Digits(from);
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
      headerText: 'UPI Ref ID Received',
      bodyText: `We received UPI Ref ID (*${standaloneUtrMatch[0]}*), but no active slot reservation was found.\n\nPlease pick a slot first to link your payment:`,
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
    const naturalDate = parseNaturalDate(normalizedText);
    const timeBand = parseTimeBand(normalizedText);

    if (naturalDate && timeBand) {
      const result = await getAvailableSlotsForDate('cricket', naturalDate, timeBand);
      return sendSlotsListMenu({ to: from, facilityType: 'cricket', date: naturalDate, timeBand, result });
    }

    if (naturalDate) {
      const result = await getAvailableSlotsForDate('cricket', naturalDate, null);
      if (result.isClosed) {
        return sendSlotsListMenu({ to: from, facilityType: 'cricket', date: naturalDate, timeBand: null, result });
      }
      if (result.slots.length > 10) {
        return sendTimeBandPrompt({ to: from, facilityType: 'cricket', date: naturalDate, counts: result.counts, result });
      }
      return sendSlotsListMenu({ to: from, facilityType: 'cricket', date: naturalDate, timeBand: null, result });
    }

    if (timeBand) {
      const today = getTodayString();
      const result = await getAvailableSlotsForDate('cricket', today, timeBand);
      return sendSlotsListMenu({ to: from, facilityType: 'cricket', date: today, timeBand, result });
    }

    // Default: Present Date Selection (Today, Tomorrow, Next 7 Days)
    return sendDatePickerPrompt({ to: from, facilityType: 'cricket' });
  }

  // ----------------------------------------------------
  // E. Football Slots Handler
  // ----------------------------------------------------
  if (
    payload === 'BTN_FOOTBALL_SLOTS' ||
    normalizedText.includes('football') ||
    normalizedText.includes('soccer')
  ) {
    const naturalDate = parseNaturalDate(normalizedText);
    const timeBand = parseTimeBand(normalizedText);

    if (naturalDate && timeBand) {
      const result = await getAvailableSlotsForDate('football', naturalDate, timeBand);
      return sendSlotsListMenu({ to: from, facilityType: 'football', date: naturalDate, timeBand, result });
    }

    if (naturalDate) {
      const result = await getAvailableSlotsForDate('football', naturalDate, null);
      if (result.isClosed) {
        return sendSlotsListMenu({ to: from, facilityType: 'football', date: naturalDate, timeBand: null, result });
      }
      if (result.slots.length > 10) {
        return sendTimeBandPrompt({ to: from, facilityType: 'football', date: naturalDate, counts: result.counts, result });
      }
      return sendSlotsListMenu({ to: from, facilityType: 'football', date: naturalDate, timeBand: null, result });
    }

    if (timeBand) {
      const today = getTodayString();
      const result = await getAvailableSlotsForDate('football', today, timeBand);
      return sendSlotsListMenu({ to: from, facilityType: 'football', date: today, timeBand, result });
    }

    return sendDatePickerPrompt({ to: from, facilityType: 'football' });
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
    const details = await getDynamicFacilityDetails();

    let turfSections = '';
    for (const t of details.turfs) {
      const sportEmoji = t.facility_type?.toLowerCase().includes('cricket') ? '🏏' : '⚽';
      const dayRate = Math.round(Number(t.weekday_day_price || 700));
      const nightWeekday = Math.round(Number(t.weekday_night_price || 900));
      const nightWeekend = Math.round(Number(t.weekend_night_price || 1000));
      const nightRateStr = nightWeekday === nightWeekend
        ? `*₹${nightWeekday} / hr*`
        : `*₹${nightWeekday}* (Mon-Fri) • *₹${nightWeekend}* (Sat-Sun)`;

      turfSections += `\n${sportEmoji} *${t.name} Turf:*
• Day Slots (${details.openStr} - 6:00 PM): *₹${dayRate} / hr*
• Floodlit Night (6:00 PM - ${details.closeStr}): ${nightRateStr}`;

      if (t.facility_type?.toLowerCase().includes('cricket')) {
        turfSections += `\n• _Includes premium cricket bats, leather/tennis balls & stumps._\n`;
      } else if (t.facility_type?.toLowerCase().includes('football')) {
        turfSections += `\n• _Includes official match footballs, goals & bibs._\n`;
      }
    }

    const pricingMsg =
`💰 *OFFICIAL FITNESS CLUB PRICING & AMENITIES*
${turfSections}
🚗 *Amenities:*
• Free on-site vehicle parking
• Covered player dugout & spectator lounge
• Purified drinking water & chilled energy drinks

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
    normalizedText.includes('where') ||
    normalizedText.includes('timing') ||
    normalizedText.includes('hours')
  ) {
    const details = await getDynamicFacilityDetails();
    const locationMsg =
`📍 *Shri Trimurti Fitness Club LOCATION & TIMINGS*

📌 *Address:*
Kudire Factory, Sangrul Fata, Koparde, Maharashtra 416205

⏰ *Operating Hours:*
${details.operatingHoursStr}

🗺️ *Google Maps Directions:*
https://maps.app.goo.gl/XCxniFWMMtnfw2MJA

📞 *Fitness Club Phone:* +91 9595153006`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Fitness Club Info',
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
  getAvailableSlotsForDate,
  getDynamicFacilityDetails,
  initiateSlotBooking,
  handleUtrSubmission,
  handleIncomingMessage,
};
