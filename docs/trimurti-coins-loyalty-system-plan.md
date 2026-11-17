# Trimurti Coins Loyalty & Milestone Reward System
## Complete Architectural Blueprint & Implementation Plan

---

### Executive Overview & Value Proposition

The **"Trimurti Coins" Loyalty & Milestone Reward System** is a customer retention engine engineered specifically for **Shri Trimurti Fitness Club**. It incentivizes repeat turf reservations across both **Cricket Turf** and **Football Turf** by combining slot booking rewards with a **Locked Vault & Milestone Unlock Gate**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   THE TRIMURTI VAULT LIFECYCLE                         │
└────────────────────────────────────────────────────────────────────────┘

 [Booking 1 to 19]                         [Booking 20]
 🪙 +50 Coins per Slot                      🎉 MILESTONE REACHED!
 Accumulates in LOCKED VAULT                VAULT UNLOCKS!
 ─────────────────────────►                 ─────────────────────────►
 🔒 50 ... 500 ... 950 TC                   🔓 1,000 Spendable Trimurti Coins
 (Progress: 1/20 ... 19/20)                 (Worth ₹1,000 off next matches!)
                                            Cycle resets & next milestone begins!
```

---

## 1. Core Business Rules & Mechanics

1. **Earning Trimurti Coins (Accrual)**:
   - For every completed and verified slot booking (Cricket Turf or Football Turf), the player earns **$X$ Trimurti Coins** (default: **50 TC**, fully configurable by Admin).
   - Coins are awarded when the booking reaches verified status (`confirmed` via Bank SMS auto-matching, Admin manual approval, or Staff check-in).
   - Bookings that are cancelled or rejected **never** award coins.

2. **The Milestone Gate (The Locked Vault)**:
   - During the accumulation phase (Matches 1 to 19), coins sit inside a **Locked Vault Balance** (`vault_balance`).
   - The player can see their coins accumulating, creating a strong psychological drive to complete the remaining matches.
   - Coins in the locked vault **cannot be redeemed** until the player completes the target number of bookings (default: **20 bookings**, configurable by Admin).
   - Upon the **20th confirmed match**, the vault **unlocks**! All accumulated coins (e.g. $20 \times 50\text{ TC} = 1,000\text{ TC} = \text{₹}1,000$) transfer immediately into **Spendable Coins Balance** (`spendable_balance`).
   - The player enters the next milestone cycle (e.g., Matches 21–40), continuing to earn spendable coins and work toward higher tiers/milestone bonuses.

3. **Multi-Channel Parity (Web App + WhatsApp Bot)**:
   - Player identity is unified by their **normalized 10-digit mobile number** (`users.phone`).
   - A player who books 10 matches on the website and 10 matches on WhatsApp hits the 20-match milestone with a single unified progress counter!
   - Coins can be redeemed seamlessly both on the Web checkout page and inside the WhatsApp interactive booking flow.

4. **Redemption & Financial Safeguards**:
   - **Conversion Rate**: $1\text{ Trimurti Coin} = \text{₹}1.00$ (configurable by Admin).
   - **Max Coins per Match Cap**: To ensure the club always covers lighting, staff, and operating costs, the Admin sets a maximum redemption cap per booking (e.g., **max 500 coins** or max 50% of the slot price). A ₹1,200 slot can be discounted down to ₹700, but not ₹0.
   - **Minimum Booking Amount**: Configurable threshold (e.g., minimum ₹600 booking) required to redeem coins.

---

## 2. Database Schema Architecture

```
                    ┌─────────────────────────┐
                    │      site_settings      │
                    ├─────────────────────────┤
                    │ loyalty_enabled         │
                    │ loyalty_coins_per_slot  │
                    │ loyalty_milestone_target│
                    │ loyalty_coin_value_inr  │
                    │ loyalty_max_redeem_cap  │
                    └───────────┬─────────────┘
                                │ Controls global rules
                                ▼
┌────────────────────────┐             ┌───────────────────────────────────┐
│         users          │ 1         1 │       user_loyalty_wallets        │
├────────────────────────┼─────────────┼───────────────────────────────────┤
│ id (PK)                │             │ id (PK)                           │
│ name                   │             │ user_id (FK -> users.id)          │
│ phone (10-digit index) │             │ phone (varchar(20), UNIQUE INDEX) │
└───────────┬────────────┘             │ vault_balance (numeric)           │
            │                          │ spendable_balance (numeric)       │
            │ 1                        │ completed_bookings_count (int)    │
            │                          │ milestone_unlocked (bool)         │
            │                          │ completed_cycles (int)            │
            ▼                          └─────────────────┬─────────────────┘
┌────────────────────────┐                               │ 1
│        bookings        │ 1                             │
├────────────────────────┤                               │
│ id (PK)                │                               │
│ user_id                │                               │
│ slot_id                │                               │
│ status                 │                               │
│ paid_amount            │                               ▼ *
│ coins_redeemed         │◄────────────┐   ┌───────────────────────────────┐
│ coins_discount_amount  │             └───┤     loyalty_transactions      │
│ coins_accrued          │                 ├───────────────────────────────┤
└────────────────────────┘                 │ id (PK)                       │
                                           │ wallet_id (FK -> wallets.id)  │
                                           │ booking_id (FK -> bookings.id)│
                                           │ type (accrual/unlock/redeem)  │
                                           │ amount_coins (numeric)        │
                                           │ channel (web/whatsapp/admin)  │
                                           │ created_at                    │
                                           └───────────────────────────────┘
```

### 2.1 Database Migrations (`backend/migrations/add_loyalty_system.sql`)

```sql
-- 1. Extend site_settings with Admin configurable parameters
ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS loyalty_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS loyalty_coins_per_slot INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS loyalty_milestone_target INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS loyalty_coin_value_inr NUMERIC(5,2) DEFAULT 1.00,
  ADD COLUMN IF NOT EXISTS loyalty_max_redeem_cap INTEGER DEFAULT 500,
  ADD COLUMN IF NOT EXISTS loyalty_min_order_amount NUMERIC(10,2) DEFAULT 600.00;

-- 2. User Loyalty Wallets Table
CREATE TABLE IF NOT EXISTS user_loyalty_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  vault_balance NUMERIC(10,2) DEFAULT 0.00,
  spendable_balance NUMERIC(10,2) DEFAULT 0.00,
  lifetime_earned NUMERIC(10,2) DEFAULT 0.00,
  lifetime_spent NUMERIC(10,2) DEFAULT 0.00,
  completed_bookings_count INTEGER DEFAULT 0,
  milestone_unlocked BOOLEAN DEFAULT false,
  completed_cycles INTEGER DEFAULT 0,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_wallets_phone ON user_loyalty_wallets(phone);

-- 3. Loyalty Transactions Audit Ledger Table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES user_loyalty_wallets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  type VARCHAR(30) NOT NULL CHECK (type IN (
    'accrual_vault',     -- Coins earned into locked vault
    'vault_unlock',      -- Vault unlocked and transferred to spendable
    'redemption',        -- Coins used to discount a booking
    'rollback',          -- Coins reversed due to cancellation/rejection
    'admin_bonus',       -- Coins manually awarded by admin
    'admin_deduct'       -- Coins manually deducted by admin
  )),
  coins NUMERIC(10,2) NOT NULL,
  inr_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  channel VARCHAR(20) NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'whatsapp', 'admin', 'system')),
  balance_after_spendable NUMERIC(10,2) NOT NULL,
  balance_after_vault NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_wallet ON loyalty_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_tx_booking ON loyalty_transactions(booking_id);

-- 4. Extend bookings Table
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS coins_redeemed INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_discount_amount NUMERIC(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS coins_accrued INTEGER DEFAULT 0;
```

---

## 3. Backend Service Architecture (`backend/services/loyaltyService.js`)

The `loyaltyService.js` module encapsulates all business logic, transaction safety, and notification dispatching.

### 3.1 Service API & Methods

| Method | Description |
| :--- | :--- |
| `getWalletByPhone(rawPhone)` | Fetches or creates the wallet for a 10-digit normalized phone number. Returns spendable coins, locked coins, completed count, milestone target, and unlock percentage. |
| `previewRedemption({ phone, bookingAmount })` | Calculates maximum redeemable coins for a proposed booking based on wallet balance and admin caps. |
| `applyRedemptionInTransaction(client, { bookingId, phone, coinsToUse, channel })` | Atomically verifies spendable balance, locks row with `FOR UPDATE`, deducts coins, logs the transaction, and updates the booking's `coins_redeemed` and `coins_discount_amount`. |
| `accrueCoinsForBooking(bookingId)` | Called when booking becomes `confirmed` or checked in. Increments `completed_bookings_count`, awards `loyalty_coins_per_slot` into `vault_balance`, and checks if the milestone threshold is reached. |
| `checkAndTriggerMilestoneUnlock(client, wallet, settings)` | If `completed_bookings_count >= settings.loyalty_milestone_target`: sets `milestone_unlocked = true`, transfers `vault_balance` to `spendable_balance`, and emits automated milestone WhatsApp & Socket.io notifications. |
| `rollbackBookingLoyalty(client, bookingId)` | In the event of a cancellation or rejection, restores any spent coins back to the user and rolls back any accrued coins/match counts. |
| `adminManualAdjustment({ phone, coins, type, reason, adminId })` | Allows admins to grant promotional bonus coins or correct discrepancies. |

---

## 4. WhatsApp Bot Engine Integration (`backend/services/whatsappBot.js`)

The WhatsApp bot provides a conversational experience for loyalty points without leaving the WhatsApp chat window.

### 4.1 Feature 1: Check Loyalty Points & Vault Status (Anytime Inquiry)
- **Triggers**: User texts `COINS`, `POINTS`, `REWARDS`, `WALLET`, `BALANCE`, or taps `[🪙 Trimurti Coins]` in the main menu.
- **WhatsApp Response Format**:

```
🪙 *SHRI TRIMURTI REWARDS WALLET* 🏆

👤 *Captain:* Harshvardhan Patil (+91 98765 43210)
📊 *Matches Completed:* 14 / 20 Matches (70%)

📦 *VAULT STATUS:* 🔒 LOCKED (6 matches to unlock!)
💎 *Coins in Vault:* 700 Trimurti Coins (Worth ₹700)
💳 *Spendable Coins:* 0 Trimurti Coins

🎯 *The Goal:* Complete 6 more matches to unlock your ₹1,000 Trimurti Club reward!

💡 _Every Cricket Turf & Football Turf match adds 50 Trimurti Coins to your vault!_
```

If the player has already unlocked the vault:
```
🪙 *SHRI TRIMURTI REWARDS WALLET* 🏆

👤 *Captain:* Harshvardhan Patil (+91 98765 43210)
📦 *VAULT STATUS:* 🔓 UNLOCKED! (VIP Gold Player)

💳 *Spendable Balance:* 1,000 Trimurti Coins (Worth ₹1,000)
📊 *Lifetime Matches:* 23 Matches

⚡ _You can apply up to 500 Trimurti Coins (Save ₹500) directly on your next WhatsApp or Web booking!_
```

### 4.2 Feature 2: Slot Booking with Coin Redemption Flow
When a player initiates a slot reservation via WhatsApp (`initiateSlotBooking` in `whatsappBot.js`):

```
┌────────────────────────────────────────────────────────┐
│             WHATSAPP BOOKING FLOW                      │
└────────────────────────────────────────────────────────┘

 1. Player selects Cricket Turf slot: 7:00 PM (₹1,200)
 2. Bot checks wallet for player's phone:
    ├─► CASE A: Vault Locked (< 20 matches)
    │   - Generate standard QR code for ₹1,200
    │   - Show Motivation Note:
    │     "🎯 Match 15/20! +50 Coins will be added to your Vault."
    │
    └─► CASE B: Vault Unlocked (Spendable Balance: 1,000 TC)
        - Send Interactive Selection Prompt:
          "🎉 You have 1,000 Trimurti Coins!
           Would you like to redeem 500 Coins for ₹500 OFF?"
          [🪙 Use 500 Coins (Pay ₹700)]   [💳 Pay Full ₹1,200]
        - If player taps [🪙 Use 500 Coins]:
          - Store redemption in session (`session.coinsToRedeem = 500`)
          - Generate UPI QR image for REDUCED AMOUNT (₹700)
          - Prompt player for last 4 digits of UPI Ref ID for ₹700!
```

### 4.3 Feature 3: Milestone Achievement WhatsApp Alert
When the 20th match is confirmed:

```
🎉 *CONGRATULATIONS, CAPTAIN!* 🏆🏏⚽

You have officially completed your *20th match* at Shri Trimurti Fitness Club!

🔓 *YOUR TRIMURTI VAULT IS NOW UNLOCKED!*
🪙 *1,000 Trimurti Coins (Worth ₹1,000)* have been transferred to your spendable wallet!

You can now redeem your coins for instant discounts on future Cricket Turf and Football Turf bookings on WhatsApp or our website.

Thank you for being one of our most valued athletes! See you on the turf! 🔥
```

---

## 5. Web App Frontend Integration

### 5.1 Slot Booking Page (`frontend/src/pages/BookingPage.tsx`)
1. **Dynamic Wallet Lookup**:
   - As soon as the user enters their 10-digit mobile number, a query is sent to `/api/loyalty/status/:phone`.
2. **Interactive UI States**:
   - **State 1: Locked Vault Display (< 20 bookings)**:
     - Sleek athletic progress card rendered below the phone number input:
       - Visual progress bar: `14 / 20 Matches (70% Completed)`
       - Status badge: `🔒 700 Trimurti Coins Locked in Vault`
       - Microcopy: *"Play 6 more matches to unlock your ₹1,000 Trimurti reward!"*
   - **State 2: Unlocked Spendable Balance (>= 20 bookings)**:
     - Golden VIP Banner:
       - `🔓 Trimurti Vault Unlocked! Available Balance: 1,000 TC (₹1,000)`
       - Checkbox toggle: `[✓] Apply 500 Trimurti Coins (Save ₹500.00)`
   - **State 3: Live Price Recalculation**:
     - Slot Subtotal: `₹1,200.00`
     - Trimurti Coins Discount: `-₹500.00`
     - **Net Payable**: `₹700.00`
     - UPI QR code and 1-tap UPI intent link automatically recalculate to `₹700.00`.
   - **State 4: Post-Booking Confirmation Modal**:
     - Confirmed screen highlights:
       `🎉 Match Booked! +50 Trimurti Coins added to your vault. Total: 750 / 1000 Coins.`

### 5.2 Customer Profile & My Bookings (`frontend/src/pages/MyBookings.tsx`)
- Adds a **"My Rewards & Trimurti Coins"** dashboard section:
  - Digital Loyalty Card displaying member name, phone, tier status, and coin balances.
  - Interactive Milestone Roadmap (e.g. Visual checkpoints at 5, 10, 15, and 20 matches).
  - Transaction History Table (Date, Slot, Facility, Type, Coins Earned/Redeemed, Balance).

### 5.3 Admin Portal (`frontend/src/pages/admin/AdminSettings.tsx` & Loyalty Tab)
- **Loyalty Program Settings Panel**:
  - `Program Status`: Switch toggle to Enable/Disable.
  - `Coins Awarded Per Booking`: Number input (default: `50`).
  - `Milestone Target (Bookings to Unlock Vault)`: Number input (default: `20`).
  - `Coin Value in INR`: Number input (default: `₹1.00`).
  - `Max Redeemable Coins Per Slot`: Number input (default: `500`).
  - `Minimum Booking Price for Redemption`: Number input (default: `₹600`).
- **Customer Loyalty Explorer**:
  - Search any player by phone or name.
  - View their vault balance, spendable balance, completed match count, and transaction ledger.
  - Action button: `[+ Award Bonus Coins]` or `[- Deduct Coins]` for customer support/promotional campaigns.

---

## 6. Edge Cases, Anti-Fraud & Reliability Safeguards

1. **Race Condition Prevention (Double Spending)**:
   - When a user applies coins during checkout on Web or WhatsApp, `loyaltyService.applyRedemptionInTransaction` locks the wallet row with PostgreSQL `SELECT ... FOR UPDATE` inside a database transaction.
   - If two bookings attempt to spend the same coins simultaneously, the second transaction waits and fails gracefully if balance is insufficient.

2. **Booking Cancellation & Rejection Handling**:
   - If a booking that used 500 coins is rejected by admin or cancelled:
     - Coins are immediately credited back to `spendable_balance`.
     - Transaction ledger logs `type: 'rollback'`.
   - If a confirmed booking that awarded 50 coins is later cancelled:
     - The 50 coins are revoked from the vault balance, and `completed_bookings_count` decrements by 1.

3. **UPI Payment Mismatch Protection**:
   - If a player applies 500 coins on a ₹1,200 slot, the net payable is ₹700.
   - The Bank SMS parser and UPI verification system (`bankSmsMatchingService.js`) validates the payment against the **discounted amount** (₹700), not the original slot price (₹1,200).

4. **Phone Number Normalization Parity**:
   - Both Web (`normalizeTo10Digits`) and WhatsApp (`from.replace(/\D/g, '')`) map to the exact same 10-digit standard (e.g., `9876543210`), ensuring zero balance drift between channels.

---

## 7. Step-by-Step Implementation Roadmap

```
┌────────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION PHASES                             │
└────────────────────────────────────────────────────────────────────────┘

  Phase 1: Database Migrations
  ├── Add loyalty fields to site_settings
  ├── Create user_loyalty_wallets table & indexes
  ├── Create loyalty_transactions audit table
  └── Add coins_redeemed, coins_discount_amount to bookings table

  Phase 2: Backend Core Service & API Routes
  ├── Create backend/services/loyaltyService.js
  ├── Create backend/routes/loyalty.js (wallet status, redeem preview, history)
  ├── Hook into adminBookingService.js & bankSmsMatchingService.js for accrual
  └── Add rollback logic on booking cancellation/rejection

  Phase 3: WhatsApp Bot Engine Integration
  ├── Add 'COINS' / 'WALLET' NLP triggers & menu handlers in whatsappBot.js
  ├── Integrate coin redemption prompt in initiateSlotBooking
  ├── Adjust QR price generation and handle reduced amount verification
  └── Add automated Milestone 20 Vault Unlock WhatsApp celebration alert

  Phase 4: Web Frontend Checkout & User Dashboard
  ├── Update BookingPage.tsx with live phone lookup & loyalty widget
  ├── Add Locked Vault milestone progress bar (< 20 bookings)
  ├── Add Spendable Coins redemption checkbox and price discount summary (>= 20 bookings)
  └── Update MyBookings.tsx with Trimurti Loyalty Card & history

  Phase 5: Admin Configuration & Management
  ├── Add Loyalty Settings tab in AdminSettings.tsx
  └── Create Customer Loyalty Explorer with manual bonus coin adjustments

  Phase 6: End-to-End Multi-Channel Verification
  ├── Script simulation: Test 20 bookings across Web and WhatsApp
  ├── Verify milestone unlock transition (vault_balance -> spendable_balance)
  ├── Verify coin redemption on both Web and WhatsApp with Bank SMS auto-matching
  └── Verify cancellation rollback integrity
```

---

### Key Decisions for User Review

1. **Coins per Slot**: Is **50 Trimurti Coins** (₹50 discount value) per completed slot the ideal reward rate, or would you prefer a different default?
2. **Milestone Target**: Is **20 completed bookings** the ideal threshold to unlock the vault, or should it be different (e.g. 10 or 15)?
3. **Max Redemption Cap**: Is **500 Coins (₹500 off)** per match suitable to ensure turf profitability on every game?
