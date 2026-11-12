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

module.exports = {
  normalizeTo10Digits,
  toWhatsAppPhone,
};
