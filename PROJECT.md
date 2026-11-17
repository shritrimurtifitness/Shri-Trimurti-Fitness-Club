# SHRI TRIMURTI FITNESS CLUB (Turfbook Pro) — Complete Project Documentation

> **Status:** Production-Ready Full-Stack Web Platform, Progressive Web App (PWA) & Autonomous AI Agentic System  
> **Location:** Akola, Maharashtra, India  
> **Primary Domains:** Multi-Sport Arena Management, Turf & Table Slot Reservations, AI Payment Verification, Missed-Call & WhatsApp Conversational Booking, Bank SMS Auto-Verification, Smart Churn Retention Predictor, Weekly Business Intelligence Executive Summaries, Tournament Operations, Staff Floor Scanner, Financial Analytics, and Social Marketing Automation.

---

## 1. Executive Summary

**SHRI TRIMURTI FITNESS CLUB** (internally code-named **Turfbook Pro** / **TurfZone**) is a production-grade sports facility management and autonomous booking platform built specifically for contemporary multi-sport complexes. The system serves three primary user personas:

1. **Customers:**
   - Browse facilities, view real-time live court availability, book Cricket Turf and Football Turf or snooker/pool tables.
   - Contact verification via dual WhatsApp Phone OTP or Email OTP.
   - Multi-channel booking: Responsive Web App, 2-Way Conversational WhatsApp Bot, or 1-Ring Missed-Call Instant Booking.
   - **Trimurti Coins Loyalty Rewards:** Earn ₹1 value per coin on completed bookings, level up tiers (Rookie to Elite), and redeem coins seamlessly.
   - **Stackable Discounts:** Redeem both promo coupons and Trimurti Coins simultaneously with ₹300 operational floor protection.
   - 0%-fee Direct Arena UPI with UTR entry or instant Vision AI payment screenshot OCR verification.
   - Live socket auto-approval with 15-minute slot hold guarantee and real-time gate pass issuance.
   - Download verifiable digital entry passes with cryptographic QR codes, calculate team cost-splits, and share passes directly to WhatsApp squads.

2. **On-Site Staff:**
   - Quick-login on mobile or tablet terminals via a 6-digit numeric PIN.
   - Camera-based high-speed HTML5 QR scanner for frictionless gate check-in.
   - Real-time on-court presence tracking and live waitlist management.
   - 1-tap on-the-spot match extensions (+1 hour) with slot availability collision guards.
   - Stopwatch-based ad-hoc table session management for snooker and pool with automated billing.

3. **Arena Administrators & Owners:**
   - Manage dynamic tiered pricing (weekday/weekend, daytime/night lights).
   - Real-time venue occupancy tracking via the **Live Occupancy Pulse**.
   - **Bank SMS Auto-Verification Engine:** Automatically verifies UPI payments directly from Android bank SMS alerts (SBI, Bank of Maharashtra, HDFC, Axis, etc.) and auto-approves slots in < 3 seconds.
   - **1-Tap WhatsApp Verification:** Approve or reject bookings directly from phone notifications with secure HMAC short-links.
   - **Google Business Profile AI Review Automation:** Automated review monitoring and context-aware Gemini AI reply synthesis.
   - **Smart Churn & Retention Predictor:** Weekly automated detection of inactive regular teams, live weekend slot check, and 1-tap WhatsApp invitations.
   - **Weekly Business Intelligence Brief:** Every Monday at 8:00 AM, delivers a C-suite WhatsApp summary of 7-day revenue, sport split, dead-zone slot monetization, and player sentiment.
   - Full coupon and discount engine, operational expense logging, tournament management, staff RBAC permissions, and immutable audit logs.
   - Automated Instagram Story marketing poster generation via the **Ad Studio**.

---

## 2. Architecture & Technology Stack

The platform is designed as an event-driven, decoupled client-server architecture with high availability, real-time WebSockets synchronization, and serverless database cost optimization.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / FRONTEND                               │
│  React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/Radix UI        │
│  State & Data: TanStack React Query + Custom Hooks                     │
│  Realtime: Socket.io Client (Live auto-approval & presence)            │
│  PWA: vite-plugin-pwa (Workbox Service Worker + Offline Storage)       │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │                                │
          HTTP/REST │ (Axios + JWT)                  │ WebSockets (Socket.io)
                    ▼                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SERVER / BACKEND                                │
│  Node.js (v18+) + Express.js (v5)                                      │
│  Security: Helmet, Compression, Morgan, Redis Rate Limiting            │
│  Authentication: Stateless JWT + Token Versioning + bcryptjs PIN/Pass │
│  Realtime Engine: Socket.io Event Broadcaster                          │
│  Cache Layer: Redis (ioredis) with Cache-Aside & Pattern Invalidation   │
│  AI Engine: Google Gemini 3.5 Flash (Vision OCR, BI Synthesis, Copy)  │
└─────────┬──────────────────────┬───────────────────────┬───────────────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌──────────────────┐   ┌──────────────────┐    ┌─────────────────────────┐
│   POSTGRESQL     │   │   REDIS CACHE    │    │  THIRD-PARTY & IOT      │
│   Neon Database  │   │   (ioredis)      │    │  • Meta WhatsApp Cloud  │
│  • 24 Relational │   │  • Query caching │    │  • MacroDroid Webhooks  │
│    Tables        │   │  • Rate limiting │    │  • cron-job.org Trigger │
│  • PL/pgSQL JIT  │   │  • Graceful DB   │    │  • Razorpay Gateway     │
│    Functions     │   │    fallback      │    │  • Brevo / Resend Mail  │
│  • Full Text/MODE│   │                  │    │  • Cloudinary Media     │
└──────────────────┘   └──────────────────┘    └─────────────────────────┘
```

### 2.1 Frontend Stack
- **Framework:** React 18.3.1 with TypeScript 5.8.3
- **Bundler & Tooling:** Vite 5.4.19 (with `@vitejs/plugin-react-swc`)
- **Routing:** `react-router-dom` v6.30.1 with role-based route guards
- **Styling:** Tailwind CSS 3.4.17, `tailwind-merge`, `clsx`, `tailwindcss-animate`
- **UI Component Primitives:** Radix UI (`@radix-ui/react-*`), Shadcn UI design patterns
- **Data Fetching & State:** `@tanstack/react-query` v5.83.0
- **Forms & Validation:** `react-hook-form` v7.61.1 with `zod` schema validation
- **Animations:** `framer-motion` v12.38.0
- **QR Scanning & Generation:** `html5-qrcode` v2.3.8 (camera scanner), `qrcode.react` v4.2.0 (SVG generator)
- **Visual Analytics:** `recharts` v3.8.1 (Bar, Area, Pie charts)
- **Exporting & Capture:** `html-to-image` v1.11.13 (Instagram Story ad generation)
- **Realtime:** `socket.io-client` v4.8.3 with custom `useSocket` reactive hooks
- **Progressive Web App:** `vite-plugin-pwa` v1.2.0 with Workbox runtime caching
- **Feedback & Notifications:** `sonner` v1.7.4 and `canvas-confetti` v1.9.4

### 2.2 Backend Stack
- **Runtime & Web Framework:** Node.js v18+ with Express.js v5.2.1
- **Database Client:** `pg` (v8.20.0) with pooled connections optimized for serverless PostgreSQL (Neon)
- **Caching & Ephemeral Store:** Redis via `ioredis` (v5.10.1) with in-memory fallback
- **Real-Time Engine:** Socket.io (v4.8.3) with channel broadcasting
- **AI & Computer Vision:** Google Gemini 3.5 Flash (`@google/genai` & REST) for Vision OCR, Sentiment Clustering, and Executive Reporting
- **Security & Middlewares:**
  - `helmet` (v8.1.0) for HTTP header hardening
  - `compression` (v1.8.1) for gzip response compression
  - `express-rate-limit` (v8.3.2) & `rate-limit-redis` (v4.3.1) for IP throttling
  - `cors` (v2.8.6) with dynamic origin checker
  - `jsonwebtoken` (v9.0.3) for stateless authentication
  - `bcryptjs` (v3.0.3) for password and PIN hashing
- **File & Media Storage:** Cloudinary via `multer` (v1.4.5) & `multer-storage-cloudinary` (v4.0.0)
- **Payment Processing:** `razorpay` (v2.9.6) with SHA-256 HMAC signature verification
- **Messaging & Notifications:** Meta WhatsApp Cloud API (Graph v21.0), Brevo (Sendinblue) REST API, and Resend (v6.12.2)

---

## 3. Directory & File Structure

```
ShriTrimurtiFitness/
├── database_schema.sql            # Master PostgreSQL DDL schema definition
├── DOCUMENTATION.md               # Quick technical brief
├── README.md                      # Public repository readme
├── PROJECT.md                     # Master architectural documentation
├── package.json                   # Root monorepo convenience scripts
├── .gitignore                     # Monorepo git ignore rules
│
├── docs/                          # Comprehensive Architectural & Integration Documentation
│   ├── README.md                  # Master documentation index
│   ├── google-business-api-setup.md # Google Business Profile API OAuth credentials & Case ID
│   ├── trimurti-coins-loyalty-system-plan.md # Loyalty rewards, tier multipliers, 30-day expiry
│   ├── whatsapp-engine-coupon-integration-plan.md # Bidirectional coupon & coin stacking logic
│   ├── private-coupons-stealth-architecture-plan.md # Stealth coupon engine and anti-abuse caps
│   ├── bank-sms-auto-verification-plan.md # MacroDroid bank SMS verification workflow
│   ├── automated-weekly-bi-executive-summary-plan.md # Monday morning automated BI executive brief
│   ├── smart-churn-reengagement-plan.md # 7/14/30-day dormant squad retention crons
│   ├── whatsapp-reminders-feedback-plan.md # Matchday reminders & Google review collection
│   ├── whatsapp-bot-implementation-plan.md # Meta WhatsApp Cloud API conversational flows
│   └── landing-page-analysis.md   # UX/UI conversion rate optimization breakdown
│
├── frontend/                      # React 18 + Vite + TypeScript Client
│   ├── package.json               # Frontend dependencies and Vite build scripts
│   ├── vite.config.ts             # Bundler config, PWA manifest & Workbox rules
│   ├── tailwind.config.ts         # Custom colors (turf neon green), font families, animations
│   ├── tsconfig.json              # TypeScript configuration
│   ├── index.html                 # Single page application HTML entry
│   ├── public/                    # Static public assets (manifest, robots, logos)
│   └── src/                       # Frontend source code
│       ├── main.tsx               # React root entry point
│       ├── App.tsx                # Route definitions, ThemeProvider, QueryClient
│       ├── index.css              # Global CSS, Tailwind utilities, custom scrollbars
│       ├── assets/                # Facility pictures, turf backgrounds, brand logo
│       ├── hooks/                 # Custom React hooks (useSocket, useToast, useMobile)
│       ├── lib/                   # Utility libraries (api, utils, whatsapp, mock-data)
│       ├── components/            # Reusable UI components
│       │   ├── AdminLayout.tsx    # Responsive admin sidebar & tab navigation
│       │   ├── AdminWhatsAppModal.tsx # Admin 1-click customer WhatsApp notifier
│       │   ├── landing/           # Landing page sections (Hero, Facilities, Pricing, etc.)
│       │   ├── admin/             # LiveOccupancyPulse, LivePresence, AdminDateFilter
│       │   └── ui/                # 40+ Shadcn atomic UI components
│       └── pages/                 # Routed view components
│           ├── Index.tsx          # Public landing homepage
│           ├── BookingPage.tsx    # 5-step booking wizard with anxiety reduction & socket sync
│           ├── MyBookings.tsx     # Mobile number lookup for active/past passes
│           ├── TournamentDetails.tsx
│           ├── TournamentRegistrationDialog.tsx
│           ├── StaffLogin.tsx     # Tablet-friendly 6-digit numeric PIN entry
│           ├── AdminLogin.tsx     # Administrator email + password portal
│           └── admin/             # 22+ Administrative control screens
│               ├── AdminDashboard.tsx
│               ├── AdminBookings.tsx      # Table & cards with Auto-Verified (Bank SMS) badges
│               ├── AdminCalendar.tsx
│               ├── AdminSlots.tsx
│               ├── AdminTables.tsx
│               ├── AdminSchedules.tsx
│               ├── AdminFacilities.tsx
│               ├── AdminTournaments.tsx
│               ├── AdminTournamentRegistrations.tsx
│               ├── AdminAnalytics.tsx     # Includes Weekly Executive Intelligence briefs
│               ├── AdminRetention.tsx     # Squad Churn & Retention Predictor UI
│               ├── AdminFinance.tsx
│               ├── AdminCoupons.tsx       # Discount codes & promo engine
│               ├── AdminAdStudio.tsx      # Instagram Story poster generator
│               ├── AdminPricing.tsx
│               ├── AdminGallery.tsx
│               ├── AdminTestimonials.tsx
│               ├── AdminClosures.tsx
│               ├── AdminAuditLogs.tsx
│               ├── AdminStaff.tsx
│               └── AdminSettings.tsx
│
└── backend/                       # Node.js Express REST API server
    ├── package.json               # Backend dependencies and node scripts
    ├── server.js                  # Express entry point, socket initialization, auto-migrations
    ├── config/                    # Infrastructure configurations (db, redis, cache, cloudinary)
    ├── middleware/                # Express middleware (auth, rateLimiter)
    ├── routes/                    # Modular API route controllers
    │   ├── auth.js                # Login, PIN auth, staff profiles, password reset
    │   ├── bookings.js            # Slot booking, UPI submission, QR verification, quick verify
    │   ├── slots.js               # JIT slot generator and live availability
    │   ├── facilities.js          # Facility CRUD, table counts, cover uploads
    │   ├── payments.js            # Razorpay orders, Bank SMS webhook (/bank-sms)
    │   ├── whatsapp.js            # Meta webhook, missed-call trigger (/missed-call)
    │   ├── retention.js           # Churn analysis cron trigger (/churn-analysis) & logs
    │   ├── loyalty.js             # Trimurti Coins balance lookup, preview, and redemption
    │   ├── coupons.js             # Coupon validation and redemption tracking
    │   ├── analytics.js           # Analytics stats, settle-up, weekly executive summary
    │   ├── tournaments.js         # Tournament management & registrations
    │   ├── sessions.js            # Ad-hoc snooker/pool stopwatch sessions
    │   ├── expenses.js            # Operational overhead logging
    │   ├── closures.js            # Dynamic facility & global arena closures
    │   ├── gallery.js             # Media asset management
    │   ├── testimonials.js        # Customer review moderation
    │   ├── staff.js               # Staff accounts & RBAC management
    │   └── settings.js            # Arena contact, UPI ID, QR, and tax settings
    ├── services/                  # Specialized autonomous engines
    │   ├── whatsapp.js            # WhatsApp Cloud API client (text, image, interactive)
    │   ├── whatsappBot.js         # Conversational booking bot & state machine
    │   ├── loyaltyService.js      # Trimurti Coins loyalty engine, tier multipliers & expiry
    │   ├── couponService.js       # Stealth coupon validation & atomic redemption recording
    │   ├── adminBookingService.js # 1-tap admin action links, passes, notifications
    │   ├── receiptOcrService.js   # Gemini 3.5 Flash Vision OCR for payment screenshots
    │   ├── bankSmsParser.js       # Fast regex + Gemini fallback parser for bank SMS
    │   ├── bankSmsMatchingService.js # 2-way matching engine for UPI payments
    │   ├── retentionService.js    # SQL churn detection + Gemini personalized copywriting
    │   ├── weeklyBiService.js     # 7-day SQL financial aggregations + executive synthesis
    │   ├── settingsService.js     # Live arena settings cache (address, phone, Google Maps, UPI)
    │   └── notificationScheduler.js # Match reminders and post-match feedback surveys
    └── utils/                     # Utility modules (dual-provider mailer, phone normalizer)
```

---

## 4. Database Schema & Entities

The relational database is architected in PostgreSQL with `uuid-ossp` extensions for secure, non-sequential identifiers.

```mermaid
erDiagram
    users ||--o{ bookings : places
    users ||--o{ audit_logs : triggers
    users ||--o{ churn_outreach_logs : tracks
    turfs ||--o{ slots : generates
    turfs ||--o{ slot_templates : defines
    turfs ||--o{ table_sessions : hosts
    slots ||--o{ bookings : reserves
    bookings ||--o{ payments : settles
    bookings ||--o{ coupon_redemptions : applies
    tournaments ||--o{ tournament_registrations : enrolls
    bank_sms_credits ||--o| bookings : auto_verifies
    bank_sms_credits ||--o| tournament_registrations : auto_verifies
```

### 4.1 Master Data Dictionary

| Table Name | Primary Key | Description & Key Columns |
|---|---|---|
| `users` | `id` (UUID) | Admin, staff, and customer accounts. Columns: `name`, `email`, `phone`, `password_hash`, `role` (`user`, `admin`, `staff`), `pin_hash` (6-digit PIN), `token_version` (logout invalidation), `allowed_tabs` (RBAC access array). |
| `turfs` | `id` (UUID) | Physical and digital facilities. Columns: `name`, `facility_type` (`cricket`, `football`, `snooker`, `pool`), `pricing_model` (`slot` or `hourly`), `weekday_day_price`, `weekday_night_price`, `weekend_day_price`, `weekend_night_price`, `table_count`, `opening_hour`, `closing_hour`, `physical_resource_id`, `is_active`. |
| `slot_templates` | `id` (UUID) | Weekly recurring master schedule rules. Columns: `turf_id`, `day_of_week` (0-6), `start_time`, `end_time`, `price`. |
| `slots` | `id` (UUID) | Concrete bookable hourly time units. Columns: `turf_id`, `date`, `start_time`, `end_time`, `price`, `table_number`, `is_available`. |
| `bookings` | `id` (UUID) | Customer reservations. Columns: `user_id`, `slot_id`, `status` (`pending`, `pending_verification`, `confirmed`, `cancelled`, `rejected`, `completed`), `payment_status` (`pending`, `paid`, `refunded`), `paid_amount`, `remaining_amount`, `payment_mode` (`cash`, `upi_qr`, `bank_sms`, `online`), `qr_token` (UUID entry pass), `checked_in_at`, `is_manual`, `utr_number`, `coupon_code`, `discount_amount`, `feedback_rating`, `feedback_comment`. |
| `payments` | `id` (UUID) | Granular financial transactions. Columns: `booking_id`, `amount`, `method` (`online`, `cash`, `upi_qr`, `bank_sms`), `platform_fee`, `is_settled`, `razorpay_order_id`, `razorpay_payment_id`. |
| `bank_sms_credits` | `id` (UUID) | Unused & matched bank SMS ledger. Columns: `amount`, `utr_number`, `last4`, `raw_sms`, `sender`, `is_used`, `matched_booking_id`, `matched_registration_id`, `expires_at`, `created_at`. |
| `churn_outreach_logs` | `id` (UUID) | Customer retention outreach ledger. Columns: `user_id`, `customer_name`, `customer_phone`, `total_past_matches`, `preferred_day_of_week`, `preferred_time`, `target_date`, `target_slot_id`, `slot_status` (`open`, `alternative`, `general`), `generated_message`, `status` (`drafted`, `sent`, `converted`, `snoozed`), `created_at`, `dispatched_at`. |
| `weekly_executive_summaries` | `id` (UUID) | Weekly business intelligence briefs. Columns: `period_start`, `period_end`, `total_revenue`, `previous_revenue`, `growth_percentage`, `cricket_revenue`, `football_revenue`, `matches_count`, `unique_teams_count`, `peak_occupancy_pct`, `dead_zone_occupancy_pct`, `unbooked_afternoon_slots`, `average_rating`, `star_team_name`, `star_team_matches`, `raw_data_json`, `generated_summary_text`, `dispatched_to_admin`, `created_at`. |
| `coupons` | `id` (UUID) | Promo codes & discounts. Columns: `code`, `discount_type` (`flat`, `percent`), `discount_value`, `min_booking_amount`, `max_discount`, `is_first_booking_only`, `total_usage_limit`, `per_user_limit`, `used_count`, `valid_from`, `valid_until`, `is_active`. |
| `coupon_redemptions` | `id` (UUID) | Tracks coupon usage history. Columns: `coupon_id`, `booking_id`, `customer_phone`, `discount_amount`, `final_paid_amount`, `created_at`. |
| `table_sessions` | `id` (UUID) | Stopwatch timer sessions for snooker/pool. Columns: `turf_id`, `name`, `table_number`, `customer_name`, `customer_phone`, `start_time`, `end_time`, `total_amount`, `payment_mode`, `status` (`running`, `completed`, `cancelled`), `is_settled`. |
| `arena_closures` | `id` (SERIAL) | Maintenance/holiday blocks. Columns: `date` (UNIQUE), `reason`, `turf_id` (NULL = global). |
| `tournaments` | `id` (UUID) | Competitive events. Columns: `name`, `sport_type`, `description`, `rules`, `entry_fee`, `prize`, `start_date`, `end_date`, `max_teams`, `banner_image`, `is_featured`, `show_on_homepage`, `display_priority`, `is_active`. |
| `tournament_registrations` | `id` (UUID) | Team tournament enrollments. Columns: `tournament_id`, `team_name`, `captain_name`, `phone`, `email`, `payment_status`, `utr_number`, `payment_mode`, `rejection_reason`. |
| `otp_verifications` | `id` (SERIAL) | 4-digit verification codes. Columns: `email`, `phone`, `otp_code`, `expires_at`, `verified`. |
| `expenses` | `id` (UUID) | Operational costs. Columns: `category` (Equipment, Utilities, Maintenance, Salary), `amount`, `description`, `expense_date`. |
| `site_settings` | `id` (INT = 1) | Arena configuration singleton. Columns: `address`, `phone`, `email`, `working_hours`, `google_rating`, `google_reviews_count`, `google_maps_url`, `gateway_percent`, `gst_percent`, `upi_id`, `upi_qr_url`, `show_testimonials`. |
| `gallery_images` | `id` (UUID) | Media assets. Columns: `cloudinary_url`, `public_id`, `alt_text`, `span_type`, `sort_order`, `resource_type`. |
| `testimonials` | `id` (UUID) | Customer feedback. Columns: `name`, `role`, `text`, `rating`, `status`, `is_featured`. |
| `pricing_plans` | `id` (UUID) | Marketing cards. Columns: `name`, `subtitle`, `price`, `unit`, `features`, `popular`, `facility`, `sort_order`. |
| `audit_logs` | `id` (UUID) | Immutable audit trails. Columns: `admin_id`, `action`, `details`, `created_at`. |
| `password_resets` | `id` (SERIAL) | Password recovery tokens. Columns: `user_id`, `token`, `expires_at`. |
| `whatsapp_logs` | `id` (UUID) | Message dispatch tracking. Columns: `phone`, `template_name`, `status`, `response`. |

---

## 5. Core Autonomous AI & Business Workflows

### 5.1 Bank SMS Auto-Verification Engine (Zero Manual Checking)
Eliminates manual admin approval for UPI payments:
1. When a player pays via GPay, PhonePe, or Paytm, the venue Android phone receives a bank credit SMS (e.g., from SBI, Bank of Maharashtra, HDFC, or Axis).
2. **MacroDroid** captures the SMS and posts it to `POST /api/payments/bank-sms`.
3. The hybrid parser (`bankSmsParser.js`) validates the credit, strictly rejects debits/withdrawals, and extracts `{ amount, utr, last4, bank }` via fast regex (with Gemini 3.5 Flash fallback).
4. **Two-Way Matching & Race Condition Handling**:
   - **Case A (Customer submits first $\rightarrow$ SMS arrives second)**: Locates the pending booking matching `amount == paid_amount` AND `utr endsWith last4`. Auto-approves the booking, generates the cryptographic QR pass, turns the web booking screen green via Socket.io, sends the entry pass to the customer's WhatsApp, and alerts the admin.
   - **Case B (SMS arrives first $\rightarrow$ Customer submits second)**: Caches the bank credit in `bank_sms_credits` (30-minute validity). When the player submits their UTR, the fast-path check matches the pre-cached credit and approves the booking **on the spot**.
5. **Unrelated Payment Protection**: Personal transfers or canteen payments are isolated in the ledger and will never confirm a turf booking unless the UTR matches.

### 5.2 Vision AI Payment Screenshot OCR & Instant 2-Phase Response
- Customers who book via WhatsApp or mobile don't need to manually type 12-digit numbers.
- **Phase 1 (Instant Ack < 0.5s):** As soon as an image arrives for an active booking session, the bot immediately triggers WhatsApp read receipts (`markMessageAsRead` to show blue checkmarks) and dispatches an instant waiting message (*"📸 Payment screenshot received! ⏳ Scanning your UPI reference with AI for Cricket Turf / Football Turf, please wait a few seconds... ⚡"*). This completely eliminates user anxiety and avoids redundant re-uploads.
- **Phase 2 (Background Vision OCR):** In the background, `receiptOcrService.js` routes the downloaded image to **Gemini 3.5 Flash Vision** to extract the 12-digit UTR, last 4 digits, payment app name, and amount paid.
- Automatically initiates verification and notifies the customer: *"📸 Payment Screenshot Verified! Detected UPI Ref ID ending in 2715 via PhonePe."*

### 5.3 1-Ring Missed-Call Instant Booking Agent
- When a customer calls the venue phone and hangs up (or call drops):
- MacroDroid detects the call state and hits `POST /api/whatsapp/missed-call` with the caller's number.
- The WhatsApp bot instantly delivers an interactive greeting with quick-action buttons:
  - `[🏏 Cricket Slots]`
  - `[⚽ Football Slots]`
  - `[💰 Rates & Pricing]`
  - `[📍 Venue Directions]`

### 5.4 Smart Churn & Squad Retention Predictor
- Runs on a scheduled trigger via **cron-job.org** (`POST /api/retention/churn-analysis`) every **Thursday at 11:00 AM IST** (`0 11 * * 4`).
- **Deterministic SQL Detection**: PostgreSQL uses `MODE() WITHIN GROUP` to find regular teams ($\ge 2$ bookings) who haven't played in the last 10–35 days and have no future bookings.
- Extracts their favorite day of the week (e.g. Saturday), favorite time (e.g. 8:00 PM), and favorite facility.
- Checks live slot availability for the upcoming weekend.
- Enforces a strict **21-day anti-spam cooldown** tracked in `churn_outreach_logs`.
- **Gemini 3.5 Flash** crafts a polite, natural Hinglish greeting ("Namaskar Captain!").
- Delivers a compiled **Thursday Admin WhatsApp Digest** with pre-filled 1-tap `wa.me` links.
- **Conversion Hook**: If the captain replies *"yes"*, *"book"*, or *"karo book"*, the WhatsApp bot locks the slot, marks the outreach as `converted`, and sends the UPI QR code!

### 5.5 Automated Weekly Turf Business Intelligence (Executive Summary)
- Dual-trigger execution:
  1. **Automated Scheduled Cron:** Runs via **cron-job.org** (`POST /api/analytics/weekly-executive-summary`) every **Monday at 8:00 AM IST** (`0 8 * * 1`) with webhook header verification (`x-bi-secret`).
  2. **Admin On-Demand Generation:** Admin can click **"Generate Live Executive Summary"** on the `/admin/analytics` dashboard at any time using their Admin Bearer JWT token (authenticated seamlessly via `authMiddleware.optional` without 401 session expiration).
- **The 4 Metric Pillars (Deterministic SQL)**:
  1. *Financial Health*: Total Revenue, Cricket Turf vs Football Turf split, Week-over-Week Growth %, and best revenue day.
  2. *Dead-Zone Slot Opportunity*: Peak hours occupancy % vs weekday afternoon (12 PM – 4 PM) occupancy %, and count of vacant daytime slots.
  3. *Ground Sentiment & Maintenance*: Average rating out of 5.0, plus AI clustering of maintenance issues (water dispenser, lighting, netting) from customer feedback comments.
  4. *Squad Activity*: Total matches, unique teams, new first-time teams, and Star Team of the week.
- **Gemini 3.5 Flash** synthesizes these verified numbers into a concise C-suite briefing delivered directly to the owner's WhatsApp.
- Preserved in `weekly_executive_summaries` and viewable under `/admin/analytics`.

### 5.6 1-Tap Secure Admin Action Links
- When a customer submits a manual booking or tournament registration:
- Admin receives an alert on WhatsApp with instant 1-tap action buttons.
- Micro compact URLs (`/v/a/<code>/<token>` for approve, `/v/r/<code>/<token>` for reject) use SHA-256 HMAC verification.
- Admin can approve payments from any smartphone lock screen without logging into the admin portal.

### 5.7 Shared Physical Resource Management
- In multi-sport facilities, Cricket Turf and 5-a-side Football Turf share the same physical ground.
- Both facilities carry an identical `physical_resource_id` (e.g. `1`).
- When an hour is booked on Cricket, the availability queries automatically lock the overlapping slot on Football, preventing physical double-booking while tracking independent metrics for each sport.

### 5.8 Dynamic Coupon & Discount Engine
- Supports flat (₹) and percentage (%) discounts with floor price protection (minimum ₹300 payable to prevent losses).
- Restricts coupons to first-time bookings, sets minimum booking thresholds, and enforces per-user and global usage limits.

### 5.9 Multilingual Conversational WhatsApp Digital Turf Manager (`aiAgent.js`)
- Powered by Google Gemini with multi-turn conversational memory (30-minute rolling context per phone number).
- **Direct Neon DB Function Calling**: When a customer asks about open slots, the AI executes a live database query (`queryAvailableSlots`), format-matches the request, and presents real-time availability without hallucination.
- **Fluent Trilingual Conversational Persona**: Fluently replies in the customer's preferred tongue:
  - **Marathi** (e.g. *"आज संध्याकाळी ७ वाजता क्रिकेटचा स्लॉट मोकळा आहे का?"*)
  - **Hindi / Hinglish** (e.g. *"Bhaiya cricket turf ka charge kya hai floodlights ke sath?"*)
  - **English** (e.g. *"Are there any slots available for 8v8 football this Saturday?"*)
- Answers questions regarding venue rules, free equipment (bats, balls, stumps, bibs provided free on-site), amenities, weather/rain policies, and provides instant booking links.

### 5.10 Automated Match Reminders & Post-Match Feedback Surveys (`notificationScheduler.js`)
- **Zero-Polling Precision Architecture**: Uses in-memory precision timers initialized at server startup and on every new booking confirmation—eliminating continuous scheduled polling against the Neon PostgreSQL database.
- **T - 2 Hours (Matchday Reminder)**: Dispatches a match briefing to the team captain including pitch status, gate arrival instructions, Google Maps venue directions, and the entry QR pass.
- **T + 1 Hour (Feedback & Sentiment Survey)**: Dispatches an interactive 1-to-5 star rating prompt via WhatsApp.
  - ⭐⭐⭐⭐⭐ (4-5 Stars): Praises the squad and delivers a direct 1-tap link to rate on **Google Maps**.
  - ⭐ / ⭐⭐ (1-2 Stars): Solicits feedback notes, logs maintenance sentiment into `weekly_executive_summaries`, and triggers an immediate admin alert.

### 5.11 Ad Studio Social Marketing Engine (`AdminAdStudio.tsx`)
- High-resolution dynamic 9:16 (1080x1920) story poster creator for Instagram and WhatsApp status promotion.
- Live-queries tomorrow's open slots from the database, renders branded graphic layouts with facility badges and pricing, and exports high-quality PNGs in 1 click via `html-to-image`.

### 5.12 WhatsApp Team Split-Bill Calculator (`TeamSplitModal.tsx`)
- Interactive squad cost-splitting utility for captains directly within the web booking interface.
- Calculates per-player share for squad sizes (8 to 15 players) with automatic upward rounding.
- One-tap button generates an formatted WhatsApp squad invite containing match details and a pre-configured UPI payment link directly to the captain's UPI ID.

### 5.13 On-Site Gate Pass Cryptographic QR Scanner (`AdminScanner.tsx` & `/scanner`)
- Turnkey camera-based QR validator built with `html5-qrcode` designed for staff smartphones or reception tablets.
- Decrypts and verifies the booking UUID token, validates the scheduled time window, checks payment status, emits audio confirmation beeps, and updates the booking status to `completed` in real time.

### 5.14 Snooker & Pool Stopwatch Session Billing (`sessions.js`)
- Digital referee stopwatch for walk-in pool and snooker tables.
- Staff start a session upon arrival; the system computes elapsed time down to the minute, calculates total bill based on hourly rate tables, logs payment mode, and closes out table availability.

### 5.15 Trimurti Coins Loyalty Rewards System (`loyaltyService.js`)
- **Direct Currency Equivalence (`1 Coin = ₹1`):** Every completed booking awards player coins based on dynamic tier progression:
  - **Rookie:** 1.0x (1 coin per ₹100 spent)
  - **Pro:** 1.25x (1.25 coins per ₹100 spent)
  - **Legend:** 1.5x (1.5 coins per ₹100 spent)
  - **Elite:** 2.0x (2.0 coins per ₹100 spent)
- **Automatic 30-Day Expiry:** Unused coins expire after 30 days to drive repeat booking velocity.
- **₹300 Operational Price Floor:** Coin redemption is strictly capped via `maxRedeemableCoins = Math.min(spendableBalance, slotPrice - 300)` so that no reservation ever operates below arena overhead costs.
- **Atomic Balance Updates:** Redemptions and grants are executed inside PostgreSQL transactions with row-level locks on `loyalty_accounts` and ledger entries in `loyalty_transactions`.

### 5.16 Bidirectional Coupon & Loyalty Coin Stacking Engine
- Allows players to redeem **both** a promotional coupon and their Trimurti Coins simultaneously on the same reservation across both the Web Engine and the Meta WhatsApp Engine.
- **Order-Independent Stacking:** Supports applying coins first then a coupon, or applying a coupon first then coins.
- **Combined Price Floor:** Total discount is evaluated as `finalPayable = Math.max(300, grandTotal - totalDiscount)`. If the coupon already brings the slot price to ₹300, coin redemption is gracefully prevented with an informative message.
- **Dynamic UPI QR Code Regeneration:** In the WhatsApp bot, applying or removing either discount dynamically generates and returns a new UPI QR image reflecting the exact updated amount.
- **Independent Removal Buttons:** Provides `[❌ Remove Coins]` and `[❌ Remove Coupon]` buttons that preserve the remaining discount without resetting the entire booking flow.

### 5.17 Google Business Profile AI Review Response Automation
- **OAuth 2.0 Integration:** Integrated with Google Cloud project `trimurti-automation` (Project #`34745779149`) with verified Location ID `8011133562872577261` and official Google allowlist Support Case `0-3671000041644`.
- **Automated Review Ingestion & Gemini Synthesis:** Monitors incoming Google Maps reviews and synthesizes personalized, context-aware replies matching user sentiment and referencing specific facility amenities (Cricket Turf pitch bounce, Football Turf turf quality, lighting, parking).
- **Hybrid Admin Approval Workflow:** Drafts are dispatched to the venue owner's WhatsApp with a 1-tap approval link before publishing to Google Maps.

### 5.18 Dynamic Arena Settings & Real-Time Location Distribution (`settingsService.js`)
- **Centralized Live Settings Cache:** Ingests arena address, phone, email, operating hours, Google Maps directions link, and UPI payment credentials from `site_settings` table and caches them in Redis (`site:settings`).
- **Zero-Hardcoding Architecture:** Eliminates static address strings across the entire stack. Any update made in `/admin/settings` automatically invalidates the Redis cache and propagates in real time to:
  1. *WhatsApp Conversational Bot:* Replies to "where is turf", "location", "address", and "map" queries with live address and directions.
  2. *Automated Match Reminders:* Injects verified arena address into pre-match WhatsApp notifications.
  3. *Booking Passes & Tickets:* Renders accurate location and Google Maps link on WhatsApp confirmation passes.
  4. *Gemini AI Digital Manager:* Dynamically updates the conversational prompt context with live location, hours, and manager phone.
  5. *Web Landing Engine:* Populates Hero section badge, Contact card, and turn-by-turn navigation buttons with live database values.


---

## 6. Complete API Reference

All routes are mounted under `/api`.

### 6.1 Payments & Bank SMS (`/api/payments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST/GET` | `/payments/bank-sms` | Secret | MacroDroid webhook for incoming bank credit SMS |
| `GET` | `/payments/bank-credits` | Bearer | Admin ledger of captured bank SMS credits |
| `POST` | `/payments/create-order` | Public | Create Razorpay order with platform fee calculation |
| `POST` | `/payments/verify` | Public | Verify Razorpay SHA-256 HMAC signature |

### 6.2 WhatsApp Bot & Missed Calls (`/api/whatsapp`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST/GET` | `/whatsapp/webhook` | Meta Token | Inbound WhatsApp webhook for messages, OCR screenshots, and feedback |
| `POST/GET` | `/whatsapp/missed-call`| Secret | MacroDroid missed-call webhook trigger |
| `POST` | `/whatsapp/send` | Bearer | Admin outbound message dispatch |

### 6.3 Customer Retention & Churn (`/api/retention`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST/GET` | `/retention/churn-analysis` | Bearer / Secret | cron-job.org trigger (`x-retention-secret`) & Admin manual trigger via `authMiddleware.optional` |
| `GET` | `/retention/logs` | Bearer | Admin view of at-risk regular teams and outreach history |
| `POST` | `/retention/logs/:id/snooze` | Bearer | Snooze customer outreach for 14 days |
| `POST` | `/retention/logs/:id/mark-sent`| Bearer | Mark outreach invite as dispatched |
| `POST` | `/retention/logs/:id/dispatch` | Bearer | Dispatch WhatsApp invite directly via Cloud API |

### 6.4 Weekly Business Intelligence & Analytics (`/api/analytics`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST/GET` | `/analytics/weekly-executive-summary` | Bearer / Secret | cron-job.org trigger (`x-bi-secret`) & Admin live trigger via `authMiddleware.optional` |
| `GET` | `/analytics/weekly-summaries` | Bearer | Historical weekly executive reports list |
| `GET` | `/analytics` | Bearer | Live analytics dashboard (revenue, utilization, peak hours) |
| `POST` | `/analytics/settle` | Bearer | End-of-day cash batch settlement |

### 6.5 Bookings & Entry Passes (`/api/bookings`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings/send-otp` | Public | Send 4-digit booking OTP via WhatsApp or Email |
| `POST` | `/bookings/verify-otp` | Public | Verify booking OTP |
| `POST` | `/bookings/submit-upi` | Public | Submit UPI UTR booking with cached bank credit auto-match |
| `GET` | `/bookings/verify-qr/:token` | Public | Gate scanner pass validation |
| `PATCH`| `/bookings/:id/check-in` | Bearer | Staff mark booking checked-in |
| `POST` | `/bookings/:id/extend` | Bearer | Extend active slot by +1 hour |
| `GET` | `/v/:action/:code/:token` | Public | 1-tap secure admin action link (approve/reject) |

### 6.6 Facilities & Slots (`/api/facilities` & `/api/slots`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/facilities` | Public | List active turfs and game tables (cached in Redis) |
| `GET` | `/facilities/admin` | Bearer | Admin list of all facilities including inactive/drafts |
| `POST` | `/facilities` | Bearer | Create a new sports facility |
| `PUT` | `/facilities/:id` | Bearer | Update rates, opening/closing hours, resource mapping |
| `PATCH`| `/facilities/:id/toggle` | Bearer | Instant toggle active/inactive status |
| `POST` | `/facilities/upload` | Bearer | Upload facility cover image to Cloudinary |
| `GET` | `/slots` | Public | JIT slot query for date and facility with real-time status |
| `POST` | `/slots/bulk` | Bearer | Bulk generator for custom holiday or special pricing slots |
| `PATCH`| `/slots/:id` | Bearer | Lock, unlock, or adjust specific slot rate |
| `DELETE`| `/slots/:id` | Bearer | Remove custom slot override |

### 6.7 Coupons & Discounts (`/api/coupons`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/coupons/validate` | Public | Validate coupon code, check min booking & compute discount |
| `GET` | `/coupons` | Bearer | Admin view of all discount codes and redemption counts |
| `POST` | `/coupons` | Bearer | Create coupon (flat ₹ or %, max discount, first-booking rule) |
| `PUT` | `/coupons/:id` | Bearer | Update coupon rules or limits |
| `DELETE`| `/coupons/:id` | Bearer | Deactivate/delete coupon |

### 6.8 Tournaments & Registrations (`/api/tournaments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/tournaments` | Public | List public tournaments with prizes and registration status |
| `GET` | `/tournaments/:id` | Public | Get tournament details, bracket structure, and rules |
| `POST` | `/tournaments/:id/register` | Public | Submit team enrollment with captain UPI UTR |
| `POST` | `/tournaments` | Bearer | Admin create new competitive tournament |
| `PUT` | `/tournaments/:id` | Bearer | Update tournament dates, prize pool, or banners |
| `DELETE`| `/tournaments/:id` | Bearer | Archive/delete tournament |
| `GET` | `/tournaments/:id/registrations` | Bearer | Admin list of registered teams and payment statuses |
| `PATCH`| `/tournaments/registrations/:regId/status` | Bearer | Approve or reject team registration |

### 6.9 Snooker & Pool Sessions (`/api/sessions`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/sessions/active` | Bearer | List active running stopwatch sessions across all tables |
| `POST` | `/sessions/start` | Bearer | Start stopwatch timer for table with customer name/phone |
| `POST` | `/sessions/:id/stop` | Bearer | Stop session timer, calculate bill, and settle payment |
| `GET` | `/sessions/history` | Bearer | Completed table sessions history ledger |

### 6.10 Operational Expenses & Closures (`/api/expenses` & `/api/closures`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/expenses` | Bearer | Filter expenses by category (Equipment, Utilities, Salary) |
| `POST` | `/expenses` | Bearer | Log overhead expense with amount, category, and date |
| `DELETE`| `/expenses/:id` | Bearer | Remove logged expense entry |
| `GET` | `/closures` | Public | List upcoming maintenance or holiday closures |
| `POST` | `/closures` | Bearer | Add turf-specific or global facility blackout date |
| `DELETE`| `/closures/:id` | Bearer | Reopen arena on closed date |

### 6.11 Staff RBAC & Identity (`/api/auth` & `/api/staff`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Admin email + password authentication (returns JWT; supports `rememberMe` for 30d vs 24h) |
| `POST` | `/auth/login-pin` | Public | Admin 4-digit PIN authentication (supports `rememberMe` for 30d vs 24h) |
| `POST` | `/auth/login-staff-pin` | Public | Staff 6-digit numeric PIN terminal fast login (default 30d session) |
| `POST` | `/auth/forgot-password` | Public | Request password recovery email |
| `POST` | `/auth/reset-password` | Public | Set new password with secure token |
| `GET` | `/staff` | Bearer | List staff members and permission sets (`allowed_tabs`) |
| `POST` | `/staff` | Bearer | Create staff account with role and assigned access tabs |
| `PUT` | `/staff/:id` | Bearer | Update staff permissions or role |
| `POST` | `/staff/:id/reset-pin` | Bearer | Reset staff 6-digit terminal PIN |
| `DELETE`| `/staff/:id` | Bearer | Deactivate staff user |

### 6.12 Arena Settings, Gallery & Testimonials (`/api/settings`, `/api/gallery`, `/api/testimonials`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/settings` | Public | Get public settings (UPI ID, QR URL, timings, phone, Google Rating) |
| `PUT` | `/settings` | Bearer | Update arena configuration, UPI details, and tax rates |
| `POST` | `/settings/upload-qr` | Bearer | Upload official arena UPI QR graphic to Cloudinary |
| `GET` | `/gallery` | Public | Fetch gallery media assets sorted by display order |
| `POST` | `/gallery` | Bearer | Add new gallery image via Cloudinary CDN |
| `DELETE`| `/gallery/:id` | Bearer | Remove gallery image asset |
| `GET` | `/testimonials` | Public | List approved player reviews and star ratings |
| `POST` | `/testimonials` | Bearer | Create featured testimonial |
| `PATCH`| `/testimonials/:id/feature` | Bearer | Toggle display on public homepage |

### 6.13 Loyalty Rewards & Trimurti Coins (`/api/loyalty`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/loyalty/status/:phone` | Public | Fetch player loyalty profile, spendable balance, tier, and coin breakdown |
| `POST` | `/loyalty/preview` | Public | Preview maximum coin redemption against slot price with ₹300 floor enforcement |
| `GET` | `/loyalty/history/:phone` | Public | Ledger of earned, spent, and expired coin transactions |

---

## 7. Scheduled Automation Jobs (`cron-job.org`)

The platform integrates with [cron-job.org](https://cron-job.org) for scheduled serverless tasks without keeping Node processes awake:

| Task Name | Schedule (IST) | Crontab (`Asia/Kolkata`) | Target Endpoint | Headers |
|---|---|---|---|---|
| **Ghost Booking Cleanup** | Every 15 mins | `*/15 * * * *` | `POST /api/bookings/cleanup` | `x-cron-secret: <CRON_SECRET>` |
| **Squad Churn Predictor** | Thursdays 11:00 AM | `0 11 * * 4` | `POST/GET /api/retention/churn-analysis` | `x-retention-secret: trimurti_retention_secret_2026` |
| **Weekly Executive Summary** | Mondays 08:00 AM | `0 8 * * 1` | `POST/GET /api/analytics/weekly-executive-summary` | `x-bi-secret: trimurti_bi_secret_2026` |

---

## 8. Mobile Edge Automation Guide (MacroDroid Configuration)

[MacroDroid](https://www.macrodroid.com) runs on the arena's dedicated Android business phone (the device linked to the bank account and receiving incoming customer calls). It acts as an edge forwarder, streaming hardware events to the cloud backend in real time.

```
       📱 Arena Business Android Phone
      ┌────────────────────────────────┐
      │  Bank SMS / UPI Credit Alert   │
      │  Missed Call from Customer     │
      └──────────────┬─────────────────┘
                     │ MacroDroid HTTP POST Webhook
                     ▼
      ☁️ Shri Trimurti Fitness Backend (/api)
```

### 8.1 Macro 1: Bank Credit SMS Auto-Forwarder (Instant UPI Reconciler)
Captures bank credit SMS messages and pushes them to the auto-verification engine in under 1 second.

- **Trigger:**
  - `SMS Received` $\rightarrow$ Any Sender (or filter for bank sender patterns like `*SBI*`, `*HDFC*`, `*MAHABK*`, `*AXIS*`, `*ICICI*`, `*UNION*` or text containing `credit`, `credited`, `received`, `deposited`, `UPI`).
- **Action:**
  - `HTTP Request`
  - **Request Method:** `POST`
  - **URL:** `https://<YOUR-BACKEND-DOMAIN>/api/payments/bank-sms`
  - **Content Type:** `application/json`
  - **Request Headers:**
    - `x-bank-secret`: `trimurti_bank_secret_2026`
    - `Content-Type`: `application/json`
  - **Request Body (JSON):**
    ```json
    {
      "sms_body": "{sms_body}",
      "sender": "{sms_number}",
      "secret": "trimurti_bank_secret_2026"
    }
    ```
    *(Note: `{sms_body}` and `{sms_number}` are MacroDroid Magic Text variables).*

### 8.2 Macro 2: Missed Call Instant Booking Agent
Detects whenever a player calls the venue phone and hangs up, triggering an immediate interactive WhatsApp booking menu.

- **Trigger:**
  - `Call Ended` $\rightarrow$ Call Missed (or `Call Missed` trigger).
- **Action:**
  - `HTTP Request`
  - **Request Method:** `POST`
  - **URL:** `https://<YOUR-BACKEND-DOMAIN>/api/whatsapp/missed-call`
  - **Content Type:** `application/json`
  - **Request Headers:**
    - `x-webhook-secret`: `trimurti_missed_call_2026`
    - `Content-Type`: `application/json`
  - **Request Body (JSON):**
    ```json
    {
      "phone": "{call_number}",
      "secret": "trimurti_missed_call_2026"
    }
    ```
    *(Note: `{call_number}` is the MacroDroid Magic Text variable for the incoming caller phone number).*

### 8.3 Android Phone Reliability & Permissions Checklist
To ensure MacroDroid runs 24/7 without being killed by Android power management:
1. **Battery Optimization:** Set MacroDroid battery usage to **Unrestricted** / **Don't Optimize**.
2. **Permissions:** Grant `SMS (Read & Receive)`, `Call Logs (Read)`, `Phone State`, and `Notification Access`.
3. **App Pinning / Autostart:**
   - In Recent Apps, tap the lock icon to lock MacroDroid in memory.
   - For Xiaomi (MIUI/HyperOS), Vivo (Funtouch), Oppo (ColorOS), or OnePlus (OxygenOS): enable **Autostart** in system settings.
4. **Data Saver:** Exclude MacroDroid from Android Data Saver so webhooks send even in low-data mode.

---

## 9. Environment Variables Reference

Create a `.env` file in the `backend/` directory based on the following reference:

| Variable | Required | Default / Format | Description |
|---|---|---|---|
| `PORT` | No | `5000` | Backend Express server port |
| `DATABASE_URL` | **Yes** | `postgresql://user:pass@host:5432/dbname?sslmode=require` | Neon PostgreSQL pooled connection URI |
| `JWT_SECRET` | **Yes** | String (32+ chars) | Secret key for signing stateless authentication JWTs |
| `FRONTEND_URL` | No | `http://localhost:5173` | Allowed CORS origin for web client |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio Key | Powers Vision OCR, WhatsApp conversational bot, and BI synthesis |
| `WHATSAPP_TOKEN` | **Yes** | Meta System User Token | Permanent Cloud API Bearer access token |
| `PHONE_NUMBER_ID` | **Yes** | 15-digit ID | Meta WhatsApp Cloud API registered phone number ID |
| `WHATSAPP_VERIFY_TOKEN`| No | `trimurti_arena_secret_2026` | Webhook verification token configured in Meta App Dashboard |
| `WHATSAPP_WABA_ID` | No | Numeric ID | WhatsApp Business Account ID |
| `WHATSAPP_BOT_NUMBER` | No | `919595153006` | WhatsApp Bot registered number (used for self-messaging prevention) |
| `ADMIN_NOTIFICATION_PHONE`| No | `917083738373` | Admin personal WhatsApp number(s) (supports single or comma-separated multiple admin numbers) |
| `BANK_SMS_SECRET` | No | `trimurti_bank_secret_2026` | MacroDroid webhook auth token for bank SMS alerts |
| `RETENTION_SECRET` | No | `trimurti_retention_secret_2026`| cron-job.org auth token for Thursday churn predictor |
| `BI_SECRET` | No | `trimurti_bi_secret_2026` | cron-job.org auth token for Monday executive summary |
| `MISSED_CALL_SECRET` | No | `trimurti_missed_call_2026` | MacroDroid missed-call trigger secret |
| `CRON_SECRET` | No | String | Secret key for 15-minute ghost booking cleanup |
| `CLOUDINARY_CLOUD_NAME`| **Yes**| Cloudinary ID | Image storage for venue photos, UPI QR code, and tournament posters |
| `CLOUDINARY_API_KEY` | **Yes** | Cloudinary API Key | Media upload authentication key |
| `CLOUDINARY_API_SECRET`| **Yes** | Cloudinary Secret | Media upload signing secret |
| `REDIS_URL` | No | `redis://localhost:6379` | Optional caching & rate limiter layer (falls back to memory if absent) |
| `RAZORPAY_KEY_ID` | No | `rzp_test_...` / `rzp_live_...` | Razorpay API key ID for online gateway checkouts |
| `RAZORPAY_KEY_SECRET` | No | Razorpay Secret | Signature verification key for Razorpay webhooks |
| `BREVO_API_KEY` | No | Brevo v3 Key | Dual-provider transactional email service |
| `BREVO_SENDER_EMAIL` | No | `hello@shritrimurtifitnessclub.in`| Verified sender email address |
| `RESEND_API_KEY` | No | `re_...` | Secondary transactional email fallback provider |
| `GOOGLE_BUSINESS_CLIENT_ID` | No | OAuth Client ID | Google Cloud OAuth 2.0 Web Client ID for review bot |
| `GOOGLE_BUSINESS_CLIENT_SECRET` | No | OAuth Client Secret | Google Cloud OAuth 2.0 Client Secret |
| `GOOGLE_BUSINESS_REFRESH_TOKEN` | No | Refresh Token (`1//...`) | Permanent Google OAuth 2.0 refresh token |
| `GOOGLE_BUSINESS_LOCATION_ID` | No | Numeric ID (`8011133562872577261`) | Verified Google Maps Business Profile location ID |

---

## 10. Development, Testing & Operations Runbook

### 10.1 Initial Project Setup
```bash
# 1. Clone the repository
git clone https://github.com/shritrimurtifitness/Shri-Trimurti-Fitness-Club.git
cd ShriTrimurtiFitness

# 2. Install backend dependencies
cd backend && npm install

# 3. Install frontend dependencies
cd ../frontend && npm install
```

### 10.2 Database Provisioning (Neon PostgreSQL)
```bash
# Connect to your Neon PostgreSQL instance and execute the schema:
psql "$DATABASE_URL" -f database_schema.sql
```
*(Note: The backend also runs automated schema migrations on startup to ensure all indexes, enum types, and foreign keys are intact).*

### 10.3 Running the Development Servers
```bash
# Terminal 1: Start Backend API (Port 5000 with nodemon live reload)
cd backend
npm run dev

# Terminal 2: Start Frontend Web Client (Port 5173 with Vite HMR)
cd frontend
npm run dev
```

### 10.4 Running Automated Verification Test Suites
The project includes self-contained end-to-end automated test suites in the `scratch/` directory:
```bash
# 1. Test Coupon + Loyalty Coin Stacking Engine (35/35 test cases)
node scratch/test_stacked_coupon_loyalty.js

# 2. Test Bank SMS Auto-Verification Engine (10/10 test cases)
node scratch/test_bank_sms_e2e.js

# 3. Test Smart Churn & Squad Retention Predictor (8/8 test cases)
node scratch/test_retention_e2e.js

# 4. Test Weekly BI Executive Summary & SQL Math (19/19 test cases)
node scratch/test_weekly_bi_e2e.js

# 5. Test Instant Payment Screenshot Acknowledgement Flow
node scratch/test_screenshot_ack.js
```

### 10.5 Frontend Production Build
```bash
cd frontend
npm run build
# Compiles optimized bundles to frontend/dist with Workbox Service Worker assets
```

### 10.6 Documentation Maintenance Policy
To guarantee documentation integrity across iterative releases:
- Whenever any feature, API endpoint, database schema change, discount rule, or operational workflow is added or modified in the codebase, both **`README.md`** and **`PROJECT.md`** must be updated in sync.
- Architectural specifications, integration guides, and environment runbooks must be indexed in **`docs/README.md`**.

---

## 11. Summary & Competitive Advantages

1. **Zero-Touch Financial Operations:** Direct UPI payments are automatically reconciled and approved in under 3 seconds via Bank SMS webhooks, eliminating manual bank statement checks.
2. **Conversational Multi-Channel Commerce:** Customers can book on the web, chat with the AI WhatsApp bot, or simply give a missed call to receive an instant booking menu.
3. **Computer Vision OCR:** Eliminates typing friction by reading 12-digit transaction references directly off Google Pay, PhonePe, and Paytm receipts.
4. **Proactive Churn Prevention:** Automatically protects against team dropoffs by identifying inactive squads on Thursdays and delivering 1-tap re-engagement invitations.
5. **C-Suite Business Intelligence:** Delivers actionable Monday morning briefs summarizing revenue, sport split, vacant daytime slot monetization, and player sentiment directly to the owner's WhatsApp.
6. **Serverless & Sleep-Friendly:** JIT slot generation and external cron triggers allow Neon PostgreSQL databases to scale to zero during idle hours, keeping hosting costs at a minimum.
