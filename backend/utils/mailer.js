const { Resend } = require('resend');

const brevoApiKey = process.env.BREVO_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Sends an email using Brevo with automatic fallback to Resend.
 */
async function sendEmail({ to, subject, html, text }) {
  // 1. Try Brevo API first
  if (brevoApiKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Shri Trimurti Sports Arena', email: process.env.BREVO_SENDER_EMAIL || 'harshalpatil9949@gmail.com' },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html,
          textContent: text || '',
        }),
      });

      const resData = await response.json();
      if (response.ok && (resData.messageId || resData.id)) {
        console.log(`[MAILER] Sent email via Brevo to ${to}`);
        return { success: true, provider: 'brevo', data: resData };
      }

      console.warn('[MAILER] Brevo returned warning/error:', resData.message || resData);
      if (resData.message && resData.message.includes('authorised_ips')) {
        console.warn('[MAILER] Note: To authorize your current IP in Brevo, visit: https://app.brevo.com/security/authorised_ips');
      }
    } catch (brevoErr) {
      console.error('[MAILER] Brevo exception:', brevoErr.message);
    }
  }

  // 2. Fallback to Resend if available
  if (resend) {
    try {
      const resendRes = await resend.emails.send({
        from: 'Shri Trimurti Sports Arena <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: html,
      });
      console.log(`[MAILER] Sent email via Resend fallback to ${to}`);
      return { success: true, provider: 'resend', data: resendRes };
    } catch (resendErr) {
      console.error('[MAILER] Resend fallback failed:', resendErr.message);
    }
  }

  console.warn(`[MAILER] Could not send email to ${to}. Please check API credentials.`);
  return { success: false, error: 'Failed to deliver email through all providers' };
}

/**
 * Send OTP verification code for booking
 */
async function sendBookingOTP({ email, name, otp }) {
  const subject = `Your Booking OTP: ${otp} - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #27272a; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #39FF14; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Shri Trimurti Sports Arena</h2>
        <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0 0;">Customer Booking Verification</p>
      </div>

      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #d4d4d8; font-size: 14px; margin-top: 0;">Hi ${name || 'Player'},</p>
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 16px;">Use the one-time code below to verify your booking at Shri Trimurti Sports Arena:</p>
        
        <div style="background-color: #27272a; border: 2px dashed #39FF14; border-radius: 8px; padding: 12px 24px; display: inline-block; margin-bottom: 12px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #39FF14;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 12px; margin: 0;">Valid for 5 minutes. Do not share this OTP with anyone.</p>
      </div>

      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        &copy; 2026 Shri Trimurti Sports Arena. All rights reserved.
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Your OTP is: ${otp}` });
}

/**
 * Send Booking Submission Alert (Pending Verification)
 */
async function sendBookingReceived({ email, name, bookingId, turfName, date, slots, totalAmount, utrNumber }) {
  const subject = `Booking Received (${bookingId}) - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #27272a; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <h2 style="color: #39FF14; margin-top: 0; font-size: 22px;">Booking Received & Under Verification</h2>
      <p style="color: #d4d4d8; font-size: 14px;">Hi <strong>${name}</strong>, we have received your booking request! Our team is verifying your payment with the submitted UPI reference.</p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 14px; color: #e4e4e7; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Booking ID:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #39FF14;">${bookingId}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Facility:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${turfName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Date:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${date}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Slots:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${slots.join(', ')}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Total Amount:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">₹${totalAmount}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Submitted UTR:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #facc15;">${utrNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Status:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #f59e0b;">Pending Verification</td></tr>
        </table>
      </div>

      <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5;">
        You will receive a confirmation receipt once the arena staff verifies the UPI payment. Please arrive 10-15 minutes before your scheduled slot.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        Shri Trimurti Sports Arena &bull; Akola, Maharashtra
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Booking ${bookingId} received. Status: Pending Verification.` });
}

/**
 * Send Booking Confirmed Receipt
 */
async function sendBookingConfirmed({ email, name, bookingId, turfName, date, slots, totalAmount }) {
  const subject = `Booking Confirmed! (${bookingId}) - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #22c55e; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background-color: #22c55e; color: #000; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; text-transform: uppercase;">Payment Verified</span>
        <h2 style="color: #39FF14; margin: 12px 0 0 0; font-size: 24px;">Your Slot is Confirmed!</h2>
      </div>

      <p style="color: #d4d4d8; font-size: 14px;">Hi <strong>${name}</strong>, your payment has been verified by the arena staff. We look forward to seeing you on the field!</p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 14px; color: #e4e4e7; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Booking ID:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #39FF14;">${bookingId}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Facility:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${turfName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Date:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${date}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Slots:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${slots.join(', ')}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Total Paid:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">₹${totalAmount}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Status:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #22c55e;">CONFIRMED</td></tr>
        </table>
      </div>

      <p style="color: #a1a1aa; font-size: 13px;">Please arrive 15 minutes before the match. Proper sports shoes are required on the turf.</p>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        &copy; 2026 Shri Trimurti Sports Arena. All rights reserved.
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Your booking ${bookingId} is confirmed!` });
}

/**
 * Send Booking Rejected Notice
 */
async function sendBookingRejected({ email, name, bookingId, turfName, date, reason }) {
  const subject = `Booking Update (${bookingId}) - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #ef4444; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <h2 style="color: #ef4444; margin-top: 0; font-size: 22px;">Booking Not Confirmed</h2>
      <p style="color: #d4d4d8; font-size: 14px;">Hi <strong>${name}</strong>, your booking request (ID: ${bookingId}) could not be confirmed.</p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #f87171; font-size: 14px;"><strong>Reason:</strong> ${reason || 'UPI payment reference (UTR) could not be verified in the bank records.'}</p>
      </div>

      <p style="color: #a1a1aa; font-size: 13px;">If you have already transferred the money, please contact the arena management directly with your payment receipt.</p>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        Shri Trimurti Sports Arena &bull; Akola, Maharashtra
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Booking ${bookingId} could not be confirmed.` });
}

/**
 * Send OTP verification code for tournament registration
 */
async function sendTournamentOTP({ email, name, otp, tournamentName }) {
  const subject = `Tournament Entry OTP: ${otp} - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #27272a; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #39FF14; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Shri Trimurti Sports Arena</h2>
        <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0 0;">Tournament Team Registration</p>
      </div>

      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 20px;">
        <p style="color: #d4d4d8; font-size: 14px; margin-top: 0;">Hi ${name || 'Captain'},</p>
        <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 16px;">
          Use the OTP code below to verify your email for registering in <strong>${tournamentName || 'the tournament'}</strong>:
        </p>
        
        <div style="background-color: #27272a; border: 2px dashed #39FF14; border-radius: 8px; padding: 12px 24px; display: inline-block; margin-bottom: 12px;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #39FF14;">${otp}</span>
        </div>
        <p style="color: #71717a; font-size: 12px; margin: 0;">Valid for 5 minutes. Do not share this OTP with anyone.</p>
      </div>

      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        &copy; 2026 Shri Trimurti Sports Arena. All rights reserved.
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Your Tournament OTP is: ${otp}` });
}

/**
 * Send Tournament Registration Received Notice (Pending UTR Verification)
 */
async function sendTournamentRegistrationReceived({ email, captainName, teamName, tournamentName, entryFee, utrNumber, registrationId }) {
  const subject = `Tournament Entry Received: ${teamName} - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #27272a; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <h2 style="color: #39FF14; margin-top: 0; font-size: 22px;">Tournament Registration Received</h2>
      <p style="color: #d4d4d8; font-size: 14px;">
        Hi Captain <strong>${captainName}</strong>, team <strong>${teamName}</strong> has been registered for <strong>${tournamentName}</strong>! Our staff is verifying your payment with the submitted bank UTR.
      </p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 14px; color: #e4e4e7; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Registration ID:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #39FF14;">${registrationId ? registrationId.slice(0, 8).toUpperCase() : 'PENDING'}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Tournament:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${tournamentName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Team Name:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${teamName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Captain:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${captainName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Entry Fee:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">₹${entryFee} (0% Fee)</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Submitted UTR:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #facc15;">${utrNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Status:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #f59e0b;">Pending Verification</td></tr>
        </table>
      </div>

      <p style="color: #a1a1aa; font-size: 13px; line-height: 1.5;">
        You will receive your official tournament pass confirmation once staff validates your UTR number with bank records.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        Shri Trimurti Sports Arena &bull; Akola, Maharashtra
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Registration for ${teamName} received. Awaiting UTR verification.` });
}

/**
 * Send Tournament Registration Confirmed Pass
 */
async function sendTournamentRegistrationConfirmed({ email, captainName, teamName, tournamentName, entryFee, registrationId, sportType }) {
  const subject = `🎉 Entry Confirmed! Match Pass: ${teamName} - ${tournamentName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #22c55e; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="background-color: #22c55e; color: #000; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px; text-transform: uppercase;">Official Team Pass</span>
        <h2 style="color: #39FF14; margin: 12px 0 0 0; font-size: 24px;">Registration Confirmed!</h2>
        <p style="color: #a1a1aa; font-size: 13px; margin: 4px 0 0 0;">${tournamentName}</p>
      </div>

      <p style="color: #d4d4d8; font-size: 14px;">
        Congratulations Captain <strong>${captainName}</strong>! Your team <strong>${teamName}</strong> is officially entered into the tournament. Payment has been verified.
      </p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <table style="width: 100%; font-size: 14px; color: #e4e4e7; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Pass / Ref ID:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #39FF14;">${registrationId ? registrationId.slice(0, 8).toUpperCase() : 'CONFIRMED'}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Team Name:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${teamName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Captain:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">${captainName}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Sport:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; text-transform: capitalize;">${sportType || 'Sports'}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Total Paid:</td><td style="padding: 6px 0; font-weight: bold; text-align: right;">₹${entryFee}</td></tr>
          <tr><td style="padding: 6px 0; color: #a1a1aa;">Status:</td><td style="padding: 6px 0; font-weight: bold; text-align: right; color: #22c55e;">CONFIRMED & READY</td></tr>
        </table>
      </div>

      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #d4d4d8;">
        <strong style="color: #39FF14;">Instructions for Captains:</strong>
        <ul style="margin: 6px 0 0 0; padding-left: 20px; color: #a1a1aa;">
          <li>All squad members must arrive 30 minutes prior to scheduled match time.</li>
          <li>Bring this email pass on your phone for registration verification at arena entrance.</li>
          <li>Proper sports footwear is mandatory.</li>
        </ul>
      </div>

      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        &copy; 2026 Shri Trimurti Sports Arena &bull; Akola, Maharashtra
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Registration for ${teamName} is confirmed! Tournament: ${tournamentName}` });
}

/**
 * Send Tournament Registration Rejected Notice
 */
async function sendTournamentRegistrationRejected({ email, captainName, teamName, tournamentName, registrationId, reason }) {
  const subject = `Tournament Registration Update: ${teamName} - Shri Trimurti Sports Arena`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #ef4444; border-radius: 16px; background-color: #09090b; color: #f4f4f5;">
      <h2 style="color: #ef4444; margin-top: 0; font-size: 22px;">Registration Not Confirmed</h2>
      <p style="color: #d4d4d8; font-size: 14px;">
        Hi Captain <strong>${captainName}</strong>, the registration for team <strong>${teamName}</strong> in <strong>${tournamentName}</strong> could not be verified.
      </p>
      
      <div style="background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 16px; margin: 20px 0;">
        <p style="margin: 0; color: #f87171; font-size: 14px;"><strong>Reason:</strong> ${reason || 'UPI payment UTR reference could not be verified in the bank statement.'}</p>
      </div>

      <p style="color: #a1a1aa; font-size: 13px;">
        If you have completed the payment, please reach out to the arena management with your UPI transaction screenshot.
      </p>
      
      <hr style="border: 0; border-top: 1px solid #27272a; margin: 20px 0;" />
      <p style="color: #71717a; font-size: 11px; text-align: center; margin: 0;">
        Shri Trimurti Sports Arena &bull; Akola, Maharashtra
      </p>
    </div>
  `;

  return sendEmail({ to: email, subject, html, text: `Registration for ${teamName} could not be confirmed.` });
}

module.exports = {
  sendEmail,
  sendBookingOTP,
  sendBookingReceived,
  sendBookingConfirmed,
  sendBookingRejected,
  sendTournamentOTP,
  sendTournamentRegistrationReceived,
  sendTournamentRegistrationConfirmed,
  sendTournamentRegistrationRejected,
};
