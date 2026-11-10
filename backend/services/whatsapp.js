const axios = require('axios');
const pool = require('../config/db');

/**
 * Normalizes a phone number to standard international format (e.g. 917083738373)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean; // Default to India
  }
  return clean;
}

/**
 * Sends a plain text message using WhatsApp Cloud API (Free within 24-hr customer window).
 */
async function sendTextMessage({ to, text, previewUrl = false }) {
  const phone = normalizePhone(to);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK TEXT] To: ${phone}\nMessage: ${text}`);
    return { success: true, mock: true };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'text',
    text: {
      preview_url: previewUrl,
      body: text,
    },
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const errorData = err.response ? err.response.data : { message: err.message };
    console.error(`[WHATSAPP ERROR] sendTextMessage to ${phone}:`, JSON.stringify(errorData));
    return { success: false, error: errorData };
  }
}

/**
 * Sends an image message with optional caption using WhatsApp Cloud API.
 */
async function sendImageMessage({ to, imageUrl, caption = '' }) {
  const phone = normalizePhone(to);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK IMAGE] To: ${phone}\nImage: ${imageUrl}\nCaption: ${caption}`);
    return { success: true, mock: true };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'image',
    image: {
      link: imageUrl,
      caption: caption,
    },
  };

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const errorData = err.response ? err.response.data : { message: err.message };
    console.error(`[WHATSAPP ERROR] sendImageMessage to ${phone}:`, JSON.stringify(errorData));
    return { success: false, error: errorData };
  }
}

/**
 * Sends an interactive Quick-Reply Buttons message (up to 3 buttons).
 * @param {Object} args
 * @param {string} args.to - Destination phone
 * @param {string} args.bodyText - Main message body
 * @param {Array<{id: string, title: string}>} args.buttons - Up to 3 buttons
 * @param {string} [args.headerText] - Optional header
 * @param {string} [args.footerText] - Optional footer
 */
async function sendInteractiveButtons({ to, bodyText, buttons = [], headerText = '', footerText = 'Shri Trimurti Sports Arena' }) {
  const phone = normalizePhone(to);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK BUTTONS] To: ${phone}\nHeader: ${headerText}\nBody: ${bodyText}\nButtons:`, buttons);
    return { success: true, mock: true };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: {
            id: b.id,
            title: b.title.slice(0, 20), // Meta limit: 20 chars max for button title
          },
        })),
      },
    },
  };

  if (headerText) {
    payload.interactive.header = { type: 'text', text: headerText };
  }
  if (footerText) {
    payload.interactive.footer = { text: footerText };
  }

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const errorData = err.response ? err.response.data : { message: err.message };
    console.error(`[WHATSAPP ERROR] sendInteractiveButtons to ${phone}:`, JSON.stringify(errorData));
    return { success: false, error: errorData };
  }
}

/**
 * Sends an interactive List Menu message (up to 10 options across sections).
 */
async function sendInteractiveList({ to, bodyText, buttonTitle = 'View Options', sections = [], headerText = '', footerText = 'Shri Trimurti Sports Arena' }) {
  const phone = normalizePhone(to);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK LIST] To: ${phone}\nBody: ${bodyText}\nSections:`, JSON.stringify(sections));
    return { success: true, mock: true };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: bodyText },
      action: {
        button: buttonTitle.slice(0, 20),
        sections: sections,
      },
    },
  };

  if (headerText) {
    payload.interactive.header = { type: 'text', text: headerText };
  }
  if (footerText) {
    payload.interactive.footer = { text: footerText };
  }

  try {
    const res = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return { success: true, data: res.data };
  } catch (err) {
    const errorData = err.response ? err.response.data : { message: err.message };
    console.error(`[WHATSAPP ERROR] sendInteractiveList to ${phone}:`, JSON.stringify(errorData));
    return { success: false, error: errorData };
  }
}

/**
 * Sends a pre-approved WhatsApp Template Message (for outbound notifications outside 24h window).
 */
async function sendWhatsAppMessage({ phone, template_name, params = [] }) {
  const formattedPhone = normalizePhone(phone);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK TEMPLATE] To: ${formattedPhone}, Template: ${template_name}, Params:`, params);
    return true;
  }

  let logId = null;
  try {
    const logRes = await pool.query(
      `INSERT INTO whatsapp_logs (phone, template_name, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [formattedPhone, template_name]
    );
    logId = logRes.rows[0].id;
  } catch (dbErr) {
    console.error("Failed to insert initial whatsapp_log:", dbErr.message);
  }

  const components = [];
  if (params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map((p) => ({
        type: 'text',
        text: String(p),
      })),
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: template_name,
      language: { code: 'en' },
      components: components,
    },
  };

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (logId) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = 'sent', response = $1 WHERE id = $2`,
        [JSON.stringify(response.data), logId]
      );
    }
    return true;
  } catch (error) {
    const errorData = error.response ? error.response.data : { message: error.message };
    console.error(`WhatsApp API Error [${template_name} to ${formattedPhone}]:`, JSON.stringify(errorData));

    if (logId) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = 'failed', response = $1 WHERE id = $2`,
        [JSON.stringify(errorData), logId]
      );
    }
    return false;
  }
}

/**
 * Sends a structured booking confirmation receipt ticket to the customer via WhatsApp.
 */
async function sendBookingConfirmationTicket({ phone, bookingId, turfName, date, slots, totalAmount, utrNumber }) {
  const formattedSlots = Array.isArray(slots) ? slots.join(', ') : slots;
  const message = 
`🎉 *BOOKING CONFIRMED — SHRI TRIMURTI SPORTS ARENA*

Hi Player! Your booking has been verified. We look forward to seeing you on the field.

📋 *Booking ID:* #${bookingId ? bookingId.slice(0, 8).toUpperCase() : 'CONFIRMED'}
🏟️ *Facility:* ${turfName || 'Sports Turf'}
📅 *Date:* ${date}
⏰ *Slot(s):* ${formattedSlots}
💰 *Total Paid:* ₹${totalAmount} (Fully Paid)
${utrNumber ? `💳 *UTR Reference:* ${utrNumber}\n` : ''}
📍 *Location:* Kudire Factory, Sangrul Fata, Koparde, Maharashtra
🗺️ *Map:* https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde

⚠️ *Player Instructions:*
1. Arrive 10–15 minutes before your scheduled slot.
2. Proper sports footwear is required on the turf.
3. Bring this WhatsApp confirmation on your phone.

Play Hard. Compete Better! 🔥`;

  return sendTextMessage({ to: phone, text: message });
}

module.exports = {
  normalizePhone,
  sendTextMessage,
  sendImageMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendWhatsAppMessage,
  sendBookingConfirmationTicket,
};
