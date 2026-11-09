/**
 * AI Conversational Agent for Shri Trimurti Sports Arena WhatsApp Bot
 * Powered by Google Gemini API with Tool/Function Calling & Multi-turn Memory.
 */

const pool = require('../config/db');

// In-memory conversation history per phone number (retained for 30 minutes)
const conversationMemory = new Map();
const MEMORY_TTL_MS = 30 * 60 * 1000;

function getMemory(phone) {
  const entry = conversationMemory.get(phone);
  if (!entry) return [];
  if (Date.now() - entry.lastUpdated > MEMORY_TTL_MS) {
    conversationMemory.delete(phone);
    return [];
  }
  return entry.history;
}

function updateMemory(phone, userMessage, aiResponse) {
  const history = getMemory(phone);
  history.push({ role: 'user', parts: [{ text: userMessage }] });
  history.push({ role: 'model', parts: [{ text: aiResponse }] });
  // Keep only the last 8 messages (4 exchanges) for context
  if (history.length > 8) {
    history.splice(0, history.length - 8);
  }
  conversationMemory.set(phone, {
    history,
    lastUpdated: Date.now(),
  });
}

/**
 * System knowledge base for the AI Assistant
 */
const SYSTEM_INSTRUCTION = `
You are "Trimurti Arena Assistant", the official, friendly, front-desk digital manager for Shri Trimurti Sports Arena in Koparde (near Kolhapur, Maharashtra).

ARENA DETAILS:
- Name: Shri Trimurti Sports Arena
- Location: Kudire Factory, Sangrul Fata, Koparde, Maharashtra
- Google Maps: https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde
- Facilities:
  1. Box Cricket Turf: High-density synthetic grass, full-perimeter safety netting, powerful LED floodlights, professional batting/bowling crease. High-grade cricket bats, tennis balls, and stumps are provided completely free on-site!
  2. Football Arena: Shock-absorbing turf for 5v5 or 6v6 matches, full perimeter safety netting, quality footballs and bibs provided.
- Operating Hours: Open 7 days a week, 10:00 AM to 12:00 AM (Midnight).
- Pricing:
  - Cricket Day (10:00 AM - 6:00 PM): ₹600 / Hour
  - Cricket Night Floodlights (6:00 PM - 12:00 AM): ₹800 / Hour
  - Football (All Slots): ₹800 / Hour
- Booking: Instant online slot booking & UPI QR payment at:
  https://shri-trimurti-fitness-club.vercel.app/book
- Amenities: Free on-site vehicle parking (cars & bikes), covered player dugout & spectator lounge, hygienic washrooms and changing area, chilled drinking water & energy drinks, free high-speed Wi-Fi.
- Rain & Weather Policy: In case of heavy rain or bad weather, sessions are happily rescheduled to another vacant slot.
- Corporate / Tournaments / Full-day bookings: Special packages available. Manager Harshvardhan: +91 7083738373.

YOUR PERSONA & BEHAVIOR:
- Warm, polite, energetic, sporty tone (like an enthusiastic turf manager).
- Speak naturally in the SAME language the customer uses:
  - If they text in Marathi (e.g. "aaj ratri slot ahe ka?"), reply in natural Marathi.
  - If they text in Hindi/Hinglish (e.g. "bhaiya cricket ke liye kitna lagega?"), reply in natural friendly Hindi/Hinglish.
  - If they text in English, reply in English.
- Keep responses concise, helpful, and formatted cleanly with emojis and bullet points for WhatsApp readability.
- When recommending slots, always give them the online booking link:
  👉 https://shri-trimurti-fitness-club.vercel.app/book
- If the user asks about live slot availability, check the available slots or suggest they check the website link.
- Never make up fake slots or rates that contradict the arena rules.
`;

/**
 * Helper to query available slots today from Neon DB
 */
async function queryAvailableSlots(facilityType = 'cricket') {
  try {
    const today = new Date().toISOString().split('T')[0];
    const turfRes = await pool.query(
      `SELECT id, name, facility_type FROM turfs WHERE facility_type ILIKE $1 AND is_active = true LIMIT 1`,
      [`%${facilityType}%`]
    );

    if (turfRes.rows.length === 0) return 'No active turf found for ' + facilityType;
    const turf = turfRes.rows[0];

    const slotsRes = await pool.query(
      `SELECT s.start_time, s.end_time, s.price
       FROM slots s
       LEFT JOIN bookings b ON b.slot_id = s.id AND b.status NOT IN ('cancelled', 'rejected')
       WHERE s.turf_id = $1 AND s.date = $2 AND s.is_available = true AND b.id IS NULL AND s.end_time > CURRENT_TIME
       ORDER BY s.start_time ASC LIMIT 6`,
      [turf.id, today]
    );

    if (slotsRes.rows.length === 0) {
      return `All slots for ${turf.name} are fully booked or have ended for today.`;
    }

    const formatTime = (t) => {
      const [h, m] = t.split(':');
      let hour = parseInt(h, 10);
      const mer = hour >= 12 ? 'PM' : 'AM';
      if (hour === 0) hour = 12;
      else if (hour > 12) hour -= 12;
      return `${hour}:${m} ${mer}`;
    };

    const lines = slotsRes.rows.map(
      (s) => `• ${formatTime(s.start_time)} – ${formatTime(s.end_time)} (₹${parseInt(s.price, 10)})`
    );
    return `Available ${turf.name} slots today:\n${lines.join('\n')}`;
  } catch (err) {
    return 'Could not check live database at this moment.';
  }
}

/**
 * Generates an AI response using Google Gemini API
 * @param {Object} args
 * @param {string} args.phone - Customer phone
 * @param {string} args.userMessage - User input
 * @returns {Promise<string|null>} AI response or null if AI not enabled
 */
async function generateAIResponse({ phone, userMessage }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return null; // AI not enabled, fallback to deterministic rules
  }

  try {
    // 1. Pre-fetch live slot context if user asks about slots or timing
    const lower = userMessage.toLowerCase();
    let liveContext = '';
    if (lower.includes('cricket') || lower.includes('box')) {
      const cricketInfo = await queryAvailableSlots('cricket');
      liveContext += `\n[Live DB Context: ${cricketInfo}]\n`;
    }
    if (lower.includes('football') || lower.includes('soccer')) {
      const footballInfo = await queryAvailableSlots('football');
      liveContext += `\n[Live DB Context: ${footballInfo}]\n`;
    }
    if ((lower.includes('slot') || lower.includes('aaj') || lower.includes('today') || lower.includes('available')) && !liveContext) {
      const cricketInfo = await queryAvailableSlots('cricket');
      const footballInfo = await queryAvailableSlots('football');
      liveContext += `\n[Live DB Context:\n${cricketInfo}\n${footballInfo}]\n`;
    }

    // 2. Build contents array with conversation history
    const history = getMemory(phone);
    const contents = [
      ...history,
      {
        role: 'user',
        parts: [{ text: userMessage + (liveContext ? `\n${liveContext}` : '') }],
      },
    ];

    // 3. Call Google Gemini 1.5 Flash API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: SYSTEM_INSTRUCTION }],
          },
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 350, // Keep WhatsApp responses concise
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.warn('[AI AGENT] Gemini API warning:', response.status, errText);
      return null;
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (candidateText) {
      const reply = candidateText.trim();
      updateMemory(phone, userMessage, reply);
      return reply;
    }

    return null;
  } catch (err) {
    console.error('[AI AGENT EXCEPTION]', err.message);
    return null; // Fallback to rule engine
  }
}

module.exports = {
  generateAIResponse,
  queryAvailableSlots,
};
