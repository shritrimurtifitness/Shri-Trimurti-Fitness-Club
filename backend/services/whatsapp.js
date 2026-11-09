const axios = require('axios');
const pool = require('../config/db');

/**
 * Sends a WhatsApp template message using Meta Cloud API.
 * @param {Object} args
 * @param {string} args.phone - Destination phone number
 * @param {string} args.template_name - Approved template name in Meta
 * @param {Array<string>} args.params - Ordered array of strings replacing {{1}}, {{2}} in template body
 * @returns {Promise<boolean>}
 */
async function sendWhatsAppMessage({ phone, template_name, params = [] }) {
  if (!process.env.WHATSAPP_TOKEN || !process.env.PHONE_NUMBER_ID) {
    console.warn("WhatsApp API credentials missing in .env. Skipping message.");
    return false;
  }

  // Sanitize phone and force country code if needed
  let formattedPhone = phone.replace(/\D/g, '');
  if (formattedPhone.length === 10) {
    formattedPhone = '91' + formattedPhone; // default to India
  }

  // 1. Log pending message state reliably
  let logId = null;
  try {
    const logRes = await pool.query(
      `INSERT INTO whatsapp_logs (phone, template_name, status) VALUES ($1, $2, 'pending') RETURNING id`,
      [formattedPhone, template_name]
    );
    logId = logRes.rows[0].id;
  } catch (dbErr) {
    console.error("Failed to insert initial whatsapp_log:", dbErr);
  }

  // 2. Build payload components
  const components = [];
  if (params.length > 0) {
    components.push({
      type: 'body',
      parameters: params.map(p => ({
        type: 'text',
        text: String(p)
      }))
    });
  }

  const payload = {
    messaging_product: 'whatsapp',
    to: formattedPhone,
    type: 'template',
    template: {
      name: template_name,
      language: { code: 'en' },
      components: components
    }
  };

  // 3. Dispatch to Meta Cloud API
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${process.env.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // 4. Trace success state
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
    
    // 4. Trace broken state
    if (logId) {
      await pool.query(
        `UPDATE whatsapp_logs SET status = 'failed', response = $1 WHERE id = $2`,
        [JSON.stringify(errorData), logId]
      );
    }
    return false;
  }
}

module.exports = {
  sendWhatsAppMessage
};
