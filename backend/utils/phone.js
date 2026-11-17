/**
 * Phone Number Normalization Utilities
 * Standardizes all stored customer and player phone numbers to exactly 10 digits without country code.
 */

/**
 * Normalizes any Indian phone representation to a clean 10-digit number.
 * Correctly distinguishes whether a leading '91' is the country code or part of the 10-digit number:
 * - 919168310559 (12 digits)  -> 9168310559 (first 91 is country code)
 * - +919168310559 (12 digits) -> 9168310559 (first 91 is country code)
 * - 9168310559 (10 digits)    -> 9168310559 (part of mobile number)
 * - 09168310559 (11 digits)   -> 9168310559 (leading 0 removed)
 * - 7083738373 (10 digits)    -> 7083738373
 * - 917083738373 (12 digits)  -> 7083738373
 */
function normalizeTo10Digits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.substring(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.substring(1);
  }
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Returns international format (without plus) required for WhatsApp Cloud API message delivery (e.g. "919168310559")
 */
function toWhatsAppPhone(phone) {
  const p10 = normalizeTo10Digits(phone);
  return p10 ? `91${p10}` : '';
}

/**
 * Formats standard 24h time ("19:00:00") into friendly 12h format ("7:00 PM")
 */
function formatTime12h(timeStr) {
  if (!timeStr) return '';
  const [h, m] = String(timeStr).split(':');
  let hour = parseInt(h, 10);
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${m} ${meridiem}`;
}

const DEFAULT_ADMIN_NOTIFICATION_PHONE = '917083738373';

/**
 * Parses ADMIN_NOTIFICATION_PHONE (supporting single number or comma/semicolon/space separated list)
 * Returns an array of clean international format numbers (e.g. ['917083738373', '919876543210'])
 * Automatically filters out the bot's own WhatsApp number and duplicate entries.
 */
function getAdminNotificationPhones() {
  const raw = process.env.ADMIN_NOTIFICATION_PHONE || DEFAULT_ADMIN_NOTIFICATION_PHONE;
  const botNumber = (process.env.WHATSAPP_BOT_NUMBER || '919595153006').replace(/\D/g, '');

  const entries = String(raw).split(/[,;\s]+/);
  const phones = [];

  for (const entry of entries) {
    const wa = toWhatsAppPhone(entry);
    if (wa && wa !== botNumber && !phones.includes(wa)) {
      phones.push(wa);
    }
  }

  return phones.length > 0 ? phones : [DEFAULT_ADMIN_NOTIFICATION_PHONE];
}

module.exports = {
  normalizeTo10Digits,
  toWhatsAppPhone,
  formatTime12h,
  DEFAULT_ADMIN_NOTIFICATION_PHONE,
  getAdminNotificationPhones,
};
