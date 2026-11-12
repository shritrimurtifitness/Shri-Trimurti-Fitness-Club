/**
 * WhatsApp Helper Utilities for SHRI TRIMURTI FITNESS CLUB
 * Supports customer team-split sharing and admin 1-click notification messages.
 */

export const ARENA_VENUE_NAME = "SHRI TRIMURTI FITNESS CLUB";
export const ARENA_DEFAULT_MAP_URL = "https://maps.app.goo.gl/XCxniFWMMtnfw2MJA";

/**
 * Sanitizes and formats an Indian phone number for WhatsApp deep-linking.
 */
export function formatPhoneForWhatsApp(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return digits;
  }
  return digits;
}

/**
 * Generates a WhatsApp deep-link URL (works on both Web and Mobile).
 */
export function getWhatsAppUrl(text: string, phone?: string): string {
  const encodedText = encodeURIComponent(text);
  if (phone) {
    const cleanPhone = formatPhoneForWhatsApp(phone);
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Customer Team Split Message generator (For sharing in cricket/football group).
 */
export interface TeamSplitParams {
  customerName: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  totalPrice: number;
  playerCount: number;
  captainUpi?: string;
  mapUrl?: string;
}

export function generateTeamSplitMessage({
  customerName,
  facilityName,
  date,
  timeSlot,
  totalPrice,
  playerCount,
  captainUpi,
  mapUrl = ARENA_DEFAULT_MAP_URL
}: TeamSplitParams): string {
  const isFootball = /football|soccer/i.test(facilityName);
  const sportEmoji = isFootball ? '⚽' : '🏏';
  const count = Math.max(1, playerCount);
  const perHead = Math.ceil(totalPrice / count);
  const cleanUpiOrPhone = (captainUpi || "").trim();

  let msg = `Hey boys! Turf booked at *${ARENA_VENUE_NAME}* 🏟️${sportEmoji}\n\n`;
  msg += `📅 *Date:* ${date}\n`;
  msg += `⏰ *Time:* ${timeSlot}\n`;
  msg += `🏟️ *Facility:* ${facilityName}\n`;
  msg += `💰 *Total Turf Fee:* ₹${totalPrice}\n\n`;
  msg += `👥 *Your share is ₹${perHead}/person* (for ${count} players)\n`;

  if (cleanUpiOrPhone) {
    const isVpa = cleanUpiOrPhone.includes('@');
    const upiVpa = isVpa ? cleanUpiOrPhone : `${cleanUpiOrPhone.replace(/\D/g, '')}@upi`;
    const upiLink = `upi://pay?pa=${upiVpa}&pn=${encodeURIComponent(customerName)}&am=${perHead}&cu=INR&tn=Turf%20Share`;
    msg += `\n💳 *Pay me via UPI:*\n`;
    msg += `👉 GPay / PhonePe / Paytm: *${cleanUpiOrPhone}*\n`;
    msg += `🔗 *1-Tap UPI Link:*\n${upiLink}\n`;
  }

  msg += `\n📍 *Location:*\n${mapUrl}\n\n`;
  msg += `👟 Reach 15 mins early. Proper sports shoes required.\n`;
  msg += `See you at the dugout! 🔥🏆`;
  return msg;
}

/**
 * Admin: Send Official Match Confirmation Pass
 */
export function generateAdminBookingConfirmMessage({
  customerName,
  facilityName,
  date,
  timeSlot,
  bookingId,
  totalPrice,
  paidAmount,
  mapUrl = ARENA_DEFAULT_MAP_URL
}: {
  customerName: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  bookingId: string;
  totalPrice: number;
  paidAmount: number;
  mapUrl?: string;
}): string {
  const passId = (bookingId || "").slice(0, 8).toUpperCase();
  let msg = `✅ *Booking Confirmed - ${ARENA_VENUE_NAME}* 🏆\n\n`;
  msg += `Hi *${customerName}*, your turf reservation is officially CONFIRMED! Here are your match details:\n\n`;
  msg += `🎫 *Pass ID:* ${passId}\n`;
  msg += `🏟️ *Facility:* ${facilityName}\n`;
  msg += `📅 *Date:* ${date}\n`;
  msg += `⏰ *Slot:* ${timeSlot}\n`;
  msg += `💳 *Amount Paid:* ₹${paidAmount} of ₹${totalPrice}\n`;
  msg += `📍 *Venue Location:* ${mapUrl}\n\n`;
  msg += `⚠️ *Guidelines:*\n`;
  msg += `• Please reach the arena 15 minutes prior to your slot.\n`;
  msg += `• Spikes / metal studs strictly prohibited on synthetic turf.\n\n`;
  msg += `Need help or directions? Reply to this message. See you on the turf! 🌟`;
  return msg;
}

/**
 * Admin: Send Friendly Match Reminder (1-hour before)
 */
export function generateAdminReminderMessage({
  customerName,
  facilityName,
  timeSlot,
  mapUrl = ARENA_DEFAULT_MAP_URL
}: {
  customerName: string;
  facilityName: string;
  timeSlot: string;
  mapUrl?: string;
}): string {
  const isFootball = /football|soccer/i.test(facilityName);
  const sportEmoji = isFootball ? '⚽' : '🏏';
  let msg = `${sportEmoji} *Match Reminder - ${ARENA_VENUE_NAME}*\n\n`;
  msg += `Hi *${customerName}*! Your match starts shortly at *${timeSlot}* on *${facilityName}*.\n\n`;
  msg += `📍 *Arena Location:* ${mapUrl}\n`;
  msg += `Please assemble with your squad 10-15 minutes early to warm up and get ready. Have a great match! ${sportEmoji}`;
  return msg;
}

/**
 * Admin: Send UPI Ref ID / Payment Clarification Request
 */
export function generateAdminUtrRequestMessage({
  customerName,
  facilityName,
  date,
  timeSlot,
  upiId = "harshvardhanp@slc"
}: {
  customerName: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  upiId?: string;
}): string {
  let msg = `⚠️ *Action Needed: UPI Verification - ${ARENA_VENUE_NAME}*\n\n`;
  msg += `Hi *${customerName}*, we received your slot booking request for *${facilityName}* on *${date}* (${timeSlot}).\n\n`;
  msg += `To confirm and lock your slot, please share your *12-digit UPI Ref ID* or a payment screenshot here.\n`;
  msg += `📲 *Arena UPI ID:* ${upiId}\n\n`;
  msg += `Once verified, we will immediately send you your confirmed match pass!`;
  return msg;
}

/**
 * Tournament: Team WhatsApp Share Message
 */
export function generateTournamentTeamShareMessage({
  teamName,
  captainName,
  tournamentName,
  entryFee,
  registrationId,
  mapUrl = ARENA_DEFAULT_MAP_URL
}: {
  teamName: string;
  captainName: string;
  tournamentName: string;
  entryFee: number;
  registrationId?: string;
  mapUrl?: string;
}): string {
  const regId = (registrationId || "").slice(0, 8).toUpperCase();
  let msg = `🏆 *Tournament Registration Entry - ${tournamentName}* 🔥\n\n`;
  msg += `🛡️ *Team Name:* ${teamName}\n`;
  msg += `👑 *Captain:* ${captainName}\n`;
  if (regId) msg += `🎫 *Entry Ref:* ${regId}\n`;
  msg += `💰 *Entry Fee:* ₹${entryFee} (Direct Arena UPI)\n`;
  msg += `📍 *Venue:* ${ARENA_VENUE_NAME} (${mapUrl})\n\n`;
  msg += `Squad, get ready! Reporting details and fixtures will be shared once team registrations conclude. Bring your best game! 🚀`;
  return msg;
}
