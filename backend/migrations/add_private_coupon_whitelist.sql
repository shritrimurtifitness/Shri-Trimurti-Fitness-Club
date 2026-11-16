-- Migration: Add private coupon support and whitelist table
-- Allows admin to create private/stealth coupons restricted to closed-group whitelisted phone numbers.

-- 1. Add is_private flag to coupons table
ALTER TABLE coupons 
  ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_coupons_is_private ON coupons(is_private);

-- 2. Create coupon_whitelist table
CREATE TABLE IF NOT EXISTS coupon_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  phone VARCHAR(10) NOT NULL,
  member_name VARCHAR(100),
  max_uses INT DEFAULT 1, -- NULL means unlimited, positive integer for cap
  used_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT uq_coupon_whitelist_coupon_phone UNIQUE(coupon_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_coupon_whitelist_lookup ON coupon_whitelist(coupon_id, phone);
CREATE INDEX IF NOT EXISTS idx_coupon_whitelist_phone ON coupon_whitelist(phone);
