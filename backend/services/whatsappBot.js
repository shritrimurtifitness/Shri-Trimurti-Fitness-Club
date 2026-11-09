const pool = require('../config/db');
const {
  sendTextMessage,
  sendInteractiveButtons,
} = require('./whatsapp');
const { generateAIResponse } = require('./aiAgent');

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
function getTodayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
      `SELECT id, name, facility_type FROM turfs WHERE facility_type ILIKE $1 AND is_active = true LIMIT 1`,
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
    const query = `
      SELECT s.id, s.start_time, s.end_time, s.price
      FROM slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status NOT IN ('cancelled', 'rejected')
      WHERE s.turf_id = $1
        AND s.date = $2
        AND s.is_available = true
        AND b.id IS NULL
        AND s.end_time > CURRENT_TIME
      ORDER BY s.start_time ASC
      LIMIT 8
    `;

    const slotsRes = await pool.query(query, [turf.id, today]);

    const formattedSlots = slotsRes.rows.map((row) => ({
      id: row.id,
      label: `${formatTime12h(row.start_time)} – ${formatTime12h(row.end_time)} (₹${parseInt(row.price, 10)})`,
    }));

    return {
      isClosed: false,
      facilityName: turf.name,
      slots: formattedSlots,
    };
  } catch (err) {
    console.error('Error fetching today available slots for bot:', err.message);
    return { isClosed: false, slots: [], error: true };
  }
}

/**
 * Main intent router for incoming WhatsApp messages
 * @param {Object} args
 * @param {string} args.from - Customer WhatsApp phone number
 * @param {string} [args.text] - Plain text content
 * @param {string} [args.buttonPayload] - ID of clicked interactive button
 */
async function handleIncomingMessage({ from, text = '', buttonPayload = '' }) {
  const normalizedText = (text || '').trim().toLowerCase();
  const payload = buttonPayload || '';

  // 0. AI Conversational Assistant (for natural language text and multi-lingual questions)
  if (!payload && text.trim().length > 1) {
    const isPureGreeting = ['hi', 'hello', 'hey', 'start', 'menu', 'options'].includes(normalizedText);
    if (!isPureGreeting) {
      try {
        const aiReply = await generateAIResponse({ phone: from, userMessage: text });
        if (aiReply) {
          return sendTextMessage({ to: from, text: aiReply });
        }
      } catch (aiErr) {
        console.warn('[AI BOT BYPASS] Falling back to rule engine:', aiErr.message);
      }
    }
  }

  // 1. Cricket Slots Handler
  if (
    payload === 'BTN_CRICKET_SLOTS' ||
    normalizedText.includes('cricket') ||
    normalizedText.includes('box cricket')
  ) {
    const result = await getTodayAvailableSlots('cricket');

    if (result.isClosed) {
      return sendTextMessage({
        to: from,
        text: `⚠️ *Arena Update for Today:*\n${result.reason}\n\nYou can still book upcoming dates online:\n👉 https://shri-trimurti-fitness-club.vercel.app/book?facility=cricket`,
      });
    }

    if (!result.slots || result.slots.length === 0) {
      return sendInteractiveButtons({
        to: from,
        headerText: '🏏 Box Cricket Turf',
        bodyText:
          'All remaining slots for tonight are currently booked or in progress!\n\nWould you like to book ahead for tomorrow or talk to the arena desk?',
        buttons: [
          { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Check Football' },
          { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
        ],
      });
    }

    const slotsList = result.slots.map((s) => `• ${s.label}`).join('\n');
    const message =
`🏏 *TODAY'S AVAILABLE CRICKET SLOTS:*

${slotsList}

⚡ *Instant Online Booking:*
👉 https://shri-trimurti-fitness-club.vercel.app/book?facility=cricket

_Reserve your slot now before another team locks it in!_`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Shri Trimurti Sports Arena',
      bodyText: message,
      buttons: [
        { id: 'BTN_FOOTBALL_SLOTS', title: '⚽ Football Slots' },
        { id: 'BTN_LOCATION', title: '📍 Arena Location' },
        { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
      ],
    });
  }

  // 2. Football Slots Handler
  if (
    payload === 'BTN_FOOTBALL_SLOTS' ||
    normalizedText.includes('football') ||
    normalizedText.includes('soccer')
  ) {
    const result = await getTodayAvailableSlots('football');

    if (result.isClosed) {
      return sendTextMessage({
        to: from,
        text: `⚠️ *Arena Update for Today:*\n${result.reason}\n\nYou can book upcoming dates online:\n👉 https://shri-trimurti-fitness-club.vercel.app/book?facility=football`,
      });
    }

    if (!result.slots || result.slots.length === 0) {
      return sendInteractiveButtons({
        to: from,
        headerText: '⚽ Football Arena',
        bodyText:
          'No more vacant football slots tonight. Would you like to check cricket turf or talk to arena management?',
        buttons: [
          { id: 'BTN_CRICKET_SLOTS', title: '🏏 Check Cricket' },
          { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
        ],
      });
    }

    const slotsList = result.slots.map((s) => `• ${s.label}`).join('\n');
    const message =
`⚽ *TODAY'S AVAILABLE FOOTBALL SLOTS:*

${slotsList}

⚡ *Instant Online Booking:*
👉 https://shri-trimurti-fitness-club.vercel.app/book?facility=football

_Tap the link above to confirm your session instantly._`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Shri Trimurti Sports Arena',
      bodyText: message,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Cricket Slots' },
        { id: 'BTN_LOCATION', title: '📍 Arena Location' },
        { id: 'BTN_STAFF', title: '👤 Talk to Staff' },
      ],
    });
  }

  // 3. Pricing & Rates Handler
  if (
    payload === 'BTN_PRICING' ||
    normalizedText.includes('price') ||
    normalizedText.includes('rate') ||
    normalizedText.includes('cost') ||
    normalizedText.includes('charges')
  ) {
    const pricingMsg =
`💰 *OFFICIAL ARENA PRICING & AMENITIES*

🏏 *Box Cricket Turf:*
• Day Slots (10:00 AM – 6:00 PM): *₹600 / Hour*
• Floodlit Night Slots (6:00 PM – 12:00 AM): *₹800 / Hour*
• _Includes high-grade cricket bats, tennis balls & stumps._

⚽ *Football Arena:*
• Regular Slots: *₹800 / Hour*
• _Includes quality footballs, perimeter netting & bibs._

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

  // 4. Location & Directions Handler
  if (
    payload === 'BTN_LOCATION' ||
    normalizedText.includes('location') ||
    normalizedText.includes('address') ||
    normalizedText.includes('map') ||
    normalizedText.includes('directions') ||
    normalizedText.includes('where')
  ) {
    const locationMsg =
`📍 *SHRI TRIMURTI SPORTS ARENA LOCATION*

📌 *Address:*
Kudire Factory, Sangrul Fata, Koparde, Maharashtra

⏰ *Operating Hours:*
Mon – Sun: 10:00 AM – 12:00 AM (Midnight)

🗺️ *Google Maps Directions:*
https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde

📞 *Arena Phone:* +91 7083738373`;

    return sendInteractiveButtons({
      to: from,
      headerText: 'Arena Location',
      bodyText: locationMsg,
      buttons: [
        { id: 'BTN_CRICKET_SLOTS', title: '🏏 Check Slots' },
        { id: 'BTN_STAFF', title: '👤 Call Staff' },
      ],
    });
  }

  // 5. Human Staff / Manager Escalation Handler
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
`👤 *ARENA MANAGEMENT SUPPORT*

Our desk team has been notified of your inquiry!

📞 *Direct Call:* +91 7083738373
💬 *WhatsApp:* +91 7083738373
✉️ *Email:* shritrimurtisportsarena@gmail.com

For corporate events, full-day tournaments, or recurring league bookings, please call the number above or let us know your preferred date and squad size right here.`;

    return sendTextMessage({
      to: from,
      text: staffMsg,
    });
  }

  // 6. Default / Welcome Greeting Menu
  const welcomeMsg =
`Welcome to *Shri Trimurti Sports Arena*! 🏏⚽

Koparde's premier floodlit sports venue for Box Cricket & Football.

How can we assist you today? Tap an option below to check live available slots or view rates:`;

  return sendInteractiveButtons({
    to: from,
    headerText: 'Shri Trimurti Sports Arena',
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
  handleIncomingMessage,
};
