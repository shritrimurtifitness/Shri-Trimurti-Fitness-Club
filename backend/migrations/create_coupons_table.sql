-- Migration: Create coupons and coupon_redemptions tables
-- Supports first-time player welcome discounts (tied to 10-digit mobile number)
-- and occasional/campaign coupon codes created by admin.

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL DEFAULT 'flat', -- 'flat' or 'percent'
  discount_value NUMERIC(10,2) NOT NULL,
  max_discount NUMERIC(10,2),
  min_booking_amount NUMERIC(10,2) DEFAULT 0,
  is_first_booking_only BOOLEAN DEFAULT false,
  total_usage_limit INT,
  used_count INT DEFAULT 0,
  per_user_limit INT DEFAULT 1,
  valid_from TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES coupons(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_phone VARCHAR(10) NOT NULL,
  discount_amount NUMERIC(10,2) NOT NULL,
  final_paid_amount NUMERIC(10,2) NOT NULL,
  redeemed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_phone ON coupon_redemptions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);

-- Alter bookings table to preserve coupon details
ALTER TABLE bookings 
  ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;

-- Seed default First-Time Welcome coupon
INSERT INTO coupons (
  code, title, description, discount_type, discount_value, min_booking_amount, is_first_booking_only, per_user_limit, is_active
) VALUES (
  'WELCOME100', 
  'First Match Welcome Offer', 
  'Flat ₹100 OFF on your first turf booking!', 
  'flat', 
  100, 
  600, 
  true, 
  1, 
  true
) ON CONFLICT (code) DO NOTHING;
