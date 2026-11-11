-- Support phone-based WhatsApp OTP verification alongside email
ALTER TABLE otp_verifications ALTER COLUMN email DROP NOT NULL;
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
ALTER TABLE otp_verifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) DEFAULT 'email';
