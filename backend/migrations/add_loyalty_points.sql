-- Migration: Trimurti Coins Loyalty & Milestone Reward System
-- Supports cycle-based locked vault and milestone unlock (e.g. 20 slots threshold)
-- Integrated across Web App & WhatsApp Bot Engine

-- 1. Extend site_settings
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_coins_per_slot INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS loyalty_milestone_target INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS loyalty_coin_value_inr NUMERIC(5,2) DEFAULT 1.00;

-- Ensure default values for existing row
UPDATE site_settings
SET loyalty_enabled = COALESCE(loyalty_enabled, true),
    loyalty_coins_per_slot = COALESCE(loyalty_coins_per_slot, 10),
    loyalty_milestone_target = COALESCE(loyalty_milestone_target, 20),
    loyalty_coin_value_inr = COALESCE(loyalty_coin_value_inr, 1.00)
WHERE id = 1;

-- 2. Create user_loyalty_wallets table
CREATE TABLE IF NOT EXISTS user_loyalty_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  vault_balance NUMERIC(10,2) DEFAULT 0.00,
  spendable_balance NUMERIC(10,2) DEFAULT 0.00,
  current_cycle_bookings INTEGER DEFAULT 0,
  completed_milestones INTEGER DEFAULT 0,
  lifetime_bookings_count INTEGER DEFAULT 0,
  lifetime_earned NUMERIC(10,2) DEFAULT 0.00,
  lifetime_spent NUMERIC(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_wallets_phone ON user_loyalty_wallets(phone);

-- 3. Create loyalty_transactions audit table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_loyalty_wallets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'accrual_vault',
    'vault_unlock',
    'redemption',
    'rollback',
    'admin_bonus',
    'admin_deduct'
  )),
  coins NUMERIC(10,2) NOT NULL,
  inr_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  channel VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'admin', 'system')),
  balance_after_spendable NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  balance_after_vault NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  cycle_number INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_wallet ON loyalty_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_booking ON loyalty_transactions(booking_id);

-- 4. Extend bookings table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_discount_amount NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS coins_accrued INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loyalty_status VARCHAR(20) DEFAULT 'none';
