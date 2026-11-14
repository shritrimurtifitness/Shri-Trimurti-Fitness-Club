const axios = require('axios');
const pool = require('../config/db');
const { toWhatsAppPhone } = require('../utils/phone');

/**
 * Normalizes a phone number to standard international format (e.g. 919595153006)
 */
function normalizePhone(phone) {
  return toWhatsAppPhone(phone);
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
async function sendInteractiveButtons({ to, bodyText, buttons = [], headerText = '', footerText = 'SHRI TRIMURTI FITNESS CLUB' }) {
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
async function sendInteractiveList({ to, bodyText, buttonTitle = 'View Options', sections = [], headerText = '', footerText = 'SHRI TRIMURTI FITNESS CLUB' }) {
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
async function sendWhatsAppMessage({ phone, template_name, params = [], languageCode = 'en' }) {
  const formattedPhone = normalizePhone(phone);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK TEMPLATE] To: ${formattedPhone}, Template: ${template_name}, Params:`, params);
    return { success: true, mock: true };
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

  const attemptSend = async (lang) => {
    const payload = {
      messaging_product: 'whatsapp',
      to: formattedPhone,
      type: 'template',
      template: {
        name: template_name,
        language: { code: lang },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    return axios.post(
      `https://graph.facebook.com/v21.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
  };

  try {
    let response;
    try {
      response = await attemptSend(languageCode);
    } catch (primaryErr) {
      const errSubcode = primaryErr.response?.data?.error?.error_subcode;
      const errMsg = primaryErr.response?.data?.error?.message || '';
      // If template was registered with a different English locale (e.g. en_US vs en), retry once
      if (errSubcode === 132001 || errMsg.includes('specified language') || errMsg.includes('does not exist')) {
        const fallbackLang = languageCode === 'en' ? 'en_US' : 'en';
        console.log(`[WHATSAPP TEMPLATE RETRY] Retrying ${template_name} with fallback language ${fallbackLang}`);
        response = await attemptSend(fallbackLang);
      } else {
        throw primaryErr;
      }
    }

    if (logId) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = 'sent', response = $1 WHERE id = $2`,
        [JSON.stringify(response.data), logId]
      );
    }
    return { success: true, data: response.data };
  } catch (error) {
    const errorData = error.response ? error.response.data : { message: error.message };
    console.error(`WhatsApp API Error [${template_name} to ${formattedPhone}]:`, JSON.stringify(errorData));

    if (logId) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = 'failed', response = $1 WHERE id = $2`,
        [JSON.stringify(errorData), logId]
      );
    }
    return { success: false, error: errorData };
  }
}

/**
 * Handles missed calls:
 * 1. Sanitizes phone to 10-digit / international 91 format.
 * 2. Checks cooldown (12 hours) so repeat callers don't get spammed and to save Meta costs.
 * 3. Sends the approved Meta template message (`trimurti_missed_call`).
 * 4. Records the lead and result in `missed_calls` table.
 */
async function sendMissedCallNotification({ phone, template_name = 'trimurti_missed_call' }) {
  const formattedPhone = normalizePhone(phone);
  if (!formattedPhone || formattedPhone.length < 10) {
    return { success: false, error: 'Invalid phone number' };
  }

  // 1. Ensure missed_calls table exists
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS missed_calls (
        id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
        phone VARCHAR(25) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        template_name VARCHAR(100),
        response JSONB,
        created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_missed_calls_phone_time ON missed_calls(phone, created_at DESC);
    `);
  } catch (tableErr) {
    console.warn('[MISSED CALL DB INIT]', tableErr.message);
  }

  // 2. Cooldown check: Has a message already been sent to this number in the last 12 hours?
  try {
    const cooldownRes = await pool.query(
      `SELECT id, created_at FROM missed_calls 
       WHERE phone = $1 
         AND status = 'sent' 
         AND created_at > NOW() - INTERVAL '12 hours' 
       ORDER BY created_at DESC LIMIT 1`,
      [formattedPhone]
    );

    if (cooldownRes.rows.length > 0) {
      console.log(`[MISSED CALL] Cooldown active for ${formattedPhone}. Skipping WhatsApp notification.`);
      await pool.query(
        `INSERT INTO missed_calls (phone, status, template_name, response) 
         VALUES ($1, 'cooldown_skipped', $2, $3)`,
        [formattedPhone, template_name, JSON.stringify({ reason: '12h cooldown active' })]
      );
      return {
        success: true,
        cooldown: true,
        phone: formattedPhone,
        message: 'Missed call logged. WhatsApp skipped due to 12h cooldown.',
      };
    }
  } catch (cdErr) {
    console.error('[MISSED CALL COOLDOWN CHECK ERROR]', cdErr.message);
  }

  // 3. Send WhatsApp template message
  const result = await sendWhatsAppMessage({
    phone: formattedPhone,
    template_name,
    params: [],
    languageCode: 'en',
  });

  // 4. Record lead outcome in database
  try {
    await pool.query(
      `INSERT INTO missed_calls (phone, status, template_name, response) 
       VALUES ($1, $2, $3, $4)`,
      [
        formattedPhone,
        result.success ? 'sent' : 'failed',
        template_name,
        JSON.stringify(result.data || result.error || {}),
      ]
    );
  } catch (saveErr) {
    console.error('[MISSED CALL SAVE ERROR]', saveErr.message);
  }

  return {
    ...result,
    phone: formattedPhone,
  };
}

/**
 * Sends a structured booking confirmation receipt ticket to the customer via WhatsApp,
 * including their official Gate Entry Pass QR code image.
 */
async function sendBookingConfirmationTicket({ 
  phone, 
  bookingId, 
  customerName, 
  turfName, 
  date, 
  slots, 
  totalAmount, 
  utrNumber, 
  qrToken,
  paidAmount,
  remainingAmount,
  paymentMethod,
}) {
  const formattedSlots = Array.isArray(slots) ? slots.join(', ') : slots;
  const tokenToEncode = qrToken || bookingId;
  const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(tokenToEncode)}&size=600&ecLevel=H&margin=2`;

  const isFootball = /football|soccer/i.test(turfName || '');
  const sportEmoji = isFootball ? '⚽' : '🏏';
  const cleanBookingCode = bookingId ? bookingId.slice(0, 8).toUpperCase() : 'CONFIRMED';

  const qrCaption = 
`🎟️ *OFFICIAL TURF ENTRY PASS*
🏟️ *Facility:* ${turfName || 'Sports Turf'}
📅 *Date:* ${date} | ⏰ *Slot:* ${formattedSlots}
📋 *Booking ID:* #${cleanBookingCode}

👉 *Show this QR code at the turf entry gate for check-in scan!*`;

  // 1. Send the Entry Pass QR Code Image
  try {
    await sendImageMessage({
      to: phone,
      imageUrl: qrImageUrl,
      caption: qrCaption,
    });
  } catch (imgErr) {
    console.error('[WHATSAPP ENTRY PASS QR SEND ERROR]', imgErr.message);
  }

  // 2. Format Payment Summary Line
  let paymentText = '';
  if (remainingAmount !== undefined && Number(remainingAmount) > 0) {
    paymentText = 
`💰 *Total Fee:* ₹${totalAmount}
💵 *Amount Paid:* ₹${paidAmount || 0}
⚠️ *Remaining Balance:* ₹${remainingAmount} (Due at arena desk)`;
  } else {
    paymentText = `💰 *Total Paid:* ₹${totalAmount} (Fully Paid ✅)`;
  }

  // Format payment method / reference line
  let paymentModeText = '';
  if (utrNumber) {
    paymentModeText = `💳 *UPI Ref ID:* ${utrNumber}\n`;
  } else if (paymentMethod) {
    const methodLabel = paymentMethod === 'cash' ? 'Cash at Counter'
      : paymentMethod === 'upi_qr' ? 'UPI QR'
      : paymentMethod === 'pay_at_desk' ? 'Pay at Desk'
      : paymentMethod.toUpperCase();
    paymentModeText = `💳 *Payment Mode:* ${methodLabel}\n`;
  }

  // 3. Send Detailed Booking Confirmation Receipt with Action Buttons
  const message = 
`🎉 *BOOKING CONFIRMED — SHRI TRIMURTI FITNESS CLUB*

Hi *${customerName || 'Player'}*! Your booking is confirmed. We look forward to seeing you on the pitch! ${sportEmoji}

📋 *Booking ID:* #${cleanBookingCode}
🏟️ *Facility:* ${turfName || 'Sports Turf'}
📅 *Date:* ${date}
⏰ *Slot(s):* ${formattedSlots}
${paymentText}
${paymentModeText}📍 *Location:* Kudire Factory, Sangrul Fata, Koparde, Maharashtra
🗺️ *Map:* https://maps.app.goo.gl/XCxniFWMMtnfw2MJA

⚠️ *Player Instructions:*
1. Arrive 10–15 minutes before your scheduled slot.
2. Proper sports footwear is required on the turf.
3. Show the official Entry Pass QR code above at the gate for fast check-in.

Play Hard. Compete Better! 🔥`;

  try {
    const res = await sendInteractiveButtons({
      to: phone,
      headerText: `${sportEmoji} Booking Confirmed`,
      bodyText: message,
      footerText: 'SHRI TRIMURTI FITNESS CLUB',
      buttons: [
        { id: 'BTN_LOCATION', title: '📍 Directions' },
        { id: 'BTN_STAFF', title: '📞 Call Arena' },
      ],
    });
    if (res && res.success) return res;
  } catch (btnErr) {
    console.warn('[INTERACTIVE CONFIRMATION FALLBACK]', btnErr.message);
  }

  const textRes = await sendTextMessage({ to: phone, text: message });
  if (textRes && textRes.success) return textRes;

  // Fallback: If free-form message failed (outside 24h customer window), send approved Meta Utility template
  console.log(`[WHATSAPP CONFIRMATION FALLBACK] Sending booking_confirmed_ticket template to ${phone}`);
  return sendWhatsAppMessage({
    phone,
    template_name: 'booking_confirmed_ticket',
    params: [
      customerName || 'Player',
      turfName || 'Sports Turf',
      date,
      formattedSlots,
      cleanBookingCode,
    ],
  });
}

/**
 * Sends an approved Meta Authentication OTP Template message.
 * Delivered by Meta even when the customer's 24-hour window is CLOSED.
 */
async function sendAuthOtpMessage({ to, otp }) {
  const phone = normalizePhone(to);
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.log(`[WHATSAPP MOCK AUTH OTP] To: ${phone}, OTP: ${otp}`);
    return { success: true, mock: true };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phone,
    type: 'template',
    template: {
      name: 'booking_auth_code',
      language: { code: 'en_US' },
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: String(otp) }
          ]
        },
        {
          type: 'button',
          sub_type: 'url',
          index: '0',
          parameters: [
            { type: 'text', text: String(otp) }
          ]
        }
      ]
    }
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
    console.log(`[WHATSAPP AUTH OTP SENT] To: ${phone}, wamid: ${res.data.messages?.[0]?.id}`);
    return { success: true, data: res.data };
  } catch (err) {
    const errorData = err.response ? err.response.data : { message: err.message };
    console.error(`[WHATSAPP AUTH OTP ERROR] To ${phone}:`, JSON.stringify(errorData));
    return { success: false, error: errorData };
  }
}

module.exports = {
  normalizePhone,
  sendTextMessage,
  sendImageMessage,
  sendInteractiveButtons,
  sendInteractiveList,
  sendWhatsAppMessage,
  sendBookingConfirmationTicket,
  sendAuthOtpMessage,
  sendMissedCallNotification,
};
