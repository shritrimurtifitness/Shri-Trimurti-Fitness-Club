# 🏟️ SHRI TRIMURTI FITNESS CLUB (Turfbook Pro)

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61dafb?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169e1?logo=postgresql&logoColor=white)](https://neon.tech/)
[![Google Gemini](https://img.shields.io/badge/Google_Gemini-3.5_Flash-886ce4?logo=google&logoColor=white)](https://ai.google.dev/)
[![Meta WhatsApp](https://img.shields.io/badge/WhatsApp-Cloud_API-25d366?logo=whatsapp&logoColor=white)](https://developers.facebook.com/docs/whatsapp/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38bdf8?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

A comprehensive, production-grade sports facility management, autonomous booking, and customer engagement platform built specifically for **Shri Trimurti Fitness Club**. Engineered for multi-sport arenas managing **Cricket Turf** and **Football Turf**, tables, tournaments, staff operations, live occupancy tracking, financial reconciliation, and AI-driven growth workflows.

---

## 🌟 Core System Highlights

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SHRI TRIMURTI ARENA                             │
│       🏏 Cricket Turf                      ⚽ Football Turf            │
└───────────────────▲────────────────────────────────┬───────────────────┘
                    │                                │
        Omnichannel Booking                 Autonomous Operations
  ┌─────────────────┴─────────────────┐    ┌─────────────────┴─────────────────┐
  │ • Web App (Mobile/Desktop PWA)    │    │ • Zero-Touch Bank SMS UTR Match   │
  │ • 2-Way WhatsApp Conversational   │    │ • Trimurti Coins Loyalty Rewards  │
  │ • 1-Ring Missed-Call Booking      │    │ • Stacking Stealth Coupons Engine │
  │ • Direct Arena 0%-Fee UPI QR Code │    │ • Google Business AI Review Bot   │
  │ • Instant Vision AI Payment OCR   │    │ • 7/14/30-Day Churn Retention     │
  └───────────────────────────────────┘    │ • Monday Morning 8 AM BI Briefs   │
                                           └───────────────────────────────────┘
```

---

## 🚀 Key Features

### 1. Omnichannel Customer Booking Experience
- **Interactive Web Engine:** Real-time live slot calendar for **Cricket Turf** and **Football Turf** with daytime and floodlit night slots.
- **2-Way WhatsApp Conversational Bot:** Full-featured conversational reservation engine powered by Meta WhatsApp Cloud API and Google Gemini AI.
- **1-Ring Missed-Call Booking:** Instant trigger sending interactive booking menus to callers without airtime charges.
- **0%-Fee Direct Arena UPI:** Dynamic UPI QR code generation with instant payment verification via UTR entry or Computer Vision screenshot OCR.
- **Instant 2-Phase Screenshot Response:** Delivers sub-500ms WhatsApp acknowledgement and read receipts upon receiving payment screenshots, eliminating drop-off anxiety while Gemini Vision OCR processes the slip in the background.
- **Cryptographic Digital Entry Passes:** Verifiable QR passes with team cost-split calculator and 1-tap WhatsApp squad sharing.

### 2. Loyalty Rewards & Stealth Coupons (Stacking Engine)
- **Trimurti Coins (`1 Coin = ₹1`):** Dynamic tier multipliers (`Rookie 1.0x`, `Pro 1.25x`, `Legend 1.5x`, `Elite 2.0x`), automated 30-day expiry crons, and win-back bonus grants.
- **Stealth Private Coupons:** Targeted promotional vouchers (e.g., `WELCOME50`, `WEEKDAY30`) with strict redemption limits and anti-abuse safeguards.
- **Bidirectional Stacking:** Players can apply **both** a coupon and their Trimurti Coins simultaneously on the Web and WhatsApp booking engines.
- **Operational Floor Protection:** Enforces a strict **₹300 minimum price floor** on all discounted slot reservations.
- **Interactive Discount Management:** 1-tap `[❌ Remove Coins]` and `[❌ Remove Coupon]` buttons on WhatsApp dynamically regenerate live payment amounts and custom UPI QR codes.

### 3. Financial Reconciliation & Zero-Touch Verification
- **Bank SMS Auto-Verification (MacroDroid):** Ingests real-time Android bank credit alerts (SBI, Bank of Maharashtra, HDFC, Axis, etc.) to match 12-digit UTR numbers and approve slots in `< 3 seconds`.
- **1-Tap WhatsApp Admin Action:** HMAC-signed quick-approval links sent directly to venue managers.
- **15-Minute Slot Hold Guarantee:** Prevents double-booking while customer payments are in transit.

### 4. Autonomous Retention & AI Operations
- **Google Business Profile AI Review Automation:** Automated review monitoring and context-aware Gemini AI reply synthesis for customer reviews on Google Maps.
- **Smart Churn Predictor:** Automated cron detecting inactive regular squads at 7, 14, and 30-day thresholds with 1-tap WhatsApp re-engagement invites.
- **Weekly BI Executive Brief:** Monday morning WhatsApp summary reporting 7-day revenue, sport split, vacant daytime slot monetization, and player sentiment. Supports both scheduled cron execution and on-demand trigger from Admin Analytics dashboard via `authMiddleware.optional`.
- **Match Reminders & Review Collector:** Automated 2-hour pre-match reminders and post-match feedback collection flows.

### 5. Staff Floor Terminal & Admin Dashboard
- **6-Digit PIN Quick-Login:** Frictionless tablet access for ground staff.
- **High-Speed HTML5 QR Entry Scanner:** Verify player gate passes with camera or barcode reader.
- **Live Occupancy Pulse:** Real-time WebSocket match and court presence monitoring.
- **Instagram Story Ad Studio:** Instant branded promotional graphics generation with venue branding.
- **Dynamic Arena Settings & Live Location Sync:** Address, Google Maps directions, contact phone, operating hours, and UPI QR details configured in Admin Settings are cached in Redis (`site:settings`) and dynamically streamed to the Web Landing page, WhatsApp bot location inquiries, automated matchday reminders, entry passes, and the Gemini AI assistant with 0 hardcoding.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18.3, TypeScript 5.8, Vite 5.4, Tailwind CSS 3.4, Radix UI, Framer Motion, TanStack Query |
| **Mobile & PWA** | `vite-plugin-pwa` (Workbox Service Worker), offline resilience, mobile-first responsive layout |
| **Backend** | Node.js (v18+), Express.js (v5.2), Helmet, Redis rate limiting, JWT + Token Versioning |
| **Database** | PostgreSQL on Neon (Serverless connection pooling, PL/pgSQL functions) |
| **Realtime Engine** | Socket.io (v4.8) for live presence, instant auto-approval, and waitlist management |
| **AI & Vision** | Google Gemini 3.5 Flash (`@google/genai`) for Vision OCR, review drafts, and BI synthesis |
| **Integrations** | Meta WhatsApp Cloud API, Google Business Profile API, MacroDroid Webhooks, Razorpay, Brevo / Resend |

---

## 📚 Project Documentation Hub (`docs/`)

All architectural specifications, integration runbooks, and credentials references are organized in the [`docs/`](./docs) directory:

| Document | Description |
| :--- | :--- |
| **[docs/README.md](./docs/README.md)** | Master documentation directory index |
| **[google-business-api-setup.md](./docs/google-business-api-setup.md)** | OAuth credentials, refresh token, Location ID (`8011133562872577261`), and Case ID (`0-3671000041644`) |
| **[trimurti-coins-loyalty-system-plan.md](./docs/trimurti-coins-loyalty-system-plan.md)** | Complete Trimurti Coins loyalty rewards architecture and ₹300 price floor |
| **[whatsapp-engine-coupon-integration-plan.md](./docs/whatsapp-engine-coupon-integration-plan.md)** | Bidirectional coupon & coin stacking specification for WhatsApp bot |
| **[private-coupons-stealth-architecture-plan.md](./docs/private-coupons-stealth-architecture-plan.md)** | Stealth coupon engine, validation logic, and anti-abuse caps |
| **[bank-sms-auto-verification-plan.md](./docs/bank-sms-auto-verification-plan.md)** | MacroDroid bank SMS reconciliation workflow and endpoints |
| **[automated-weekly-bi-executive-summary-plan.md](./docs/automated-weekly-bi-executive-summary-plan.md)** | Monday morning automated BI executive summary reports |
| **[smart-churn-reengagement-plan.md](./docs/smart-churn-reengagement-plan.md)** | Automated 7/14/30-day player churn detection and win-back crons |
| **[whatsapp-reminders-feedback-plan.md](./docs/whatsapp-reminders-feedback-plan.md)** | 2-hour pre-match reminders and Google review collection flows |
| **[whatsapp-bot-implementation-plan.md](./docs/whatsapp-bot-implementation-plan.md)** | Meta WhatsApp Cloud API bot conversational flow architecture |
| **[landing-page-analysis.md](./docs/landing-page-analysis.md)** | UX/UI conversion analysis and turf booking optimization |

---

## ⚙️ Installation & Setup

### 1. Prerequisites
- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** Neon account or local PostgreSQL v14+
- **Redis:** Optional (in-memory fallback is automatically active)

### 2. Clone and Install Dependencies
```bash
# Clone the repository
git clone https://github.com/shritrimurtifitness/Shri-Trimurti-Fitness-Club.git
cd ShriTrimurtiFitness

# Install all dependencies (root, backend, and frontend)
npm run install:all
```

### 3. Environment Configuration
Copy the provided `.env.example` templates to configure your environment:

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

Key environment variables in `backend/.env`:
```dotenv
PORT=5000
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
JWT_SECRET=your-secure-jwt-secret-string
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key

# WhatsApp Cloud API Bot
WHATSAPP_TOKEN=your_meta_system_user_token
PHONE_NUMBER_ID=your_registered_phone_number_id
WHATSAPP_VERIFY_TOKEN=trimurti_arena_secret_2026

# Google Business Profile API (AI Review Management)
GOOGLE_BUSINESS_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_BUSINESS_CLIENT_SECRET=your_google_client_secret
GOOGLE_BUSINESS_REFRESH_TOKEN=1//your_refresh_token
GOOGLE_BUSINESS_LOCATION_ID=8011133562872577261
```

### 4. Database Initialization
```bash
# Provision database schema (tables, foreign keys, and indexes)
psql "$DATABASE_URL" -f database_schema.sql
```
*(The backend also runs automated schema migrations on startup to ensure all tables, columns, and constraint indexes are in place).*

### 5. Running the Application
```bash
# Run both Frontend and Backend concurrently from root:
npm run dev:backend     # Starts Express API at http://localhost:5000
npm run dev:frontend    # Starts Vite Web Client at http://localhost:5173
```

---

## 🧪 Automated Test Suites

The project contains end-to-end automated verification suites in the `scratch/` folder:

```bash
# 1. Test Coupon + Loyalty Coin Stacking Engine (35/35 tests)
node scratch/test_stacked_coupon_loyalty.js

# 2. Test Bank SMS Auto-Verification & UTR Reconciliation (10/10 tests)
node scratch/test_bank_sms_e2e.js

# 3. Test Smart Churn & Squad Retention Predictor (8/8 tests)
node scratch/test_retention_e2e.js

# 4. Test Weekly BI Executive Summary & SQL Math (19/19 tests)
node scratch/test_weekly_bi_e2e.js

# 5. Test Instant Payment Screenshot Acknowledgement Flow
node scratch/test_screenshot_ack.js

# 6. Test Admin Executive Summary & Churn Auth Dual Mode
node scratch/test_executive_summary_auth.js

# 7. Frontend Production Bundle Check
npm run build --prefix frontend
```

---

## 🔒 Security & Operational Rules

1. **Strict Turf Terminology:** All user-facing communications, bot templates, and UI components must strictly refer to **"Cricket Turf"** and **"Football Turf"**.
2. **Operational Price Floor:** Total discounts (stacked coupons + loyalty coins) must **never** reduce a slot reservation below the **₹300 minimum operational floor**.
3. **Data Integrity:** Bank SMS credit reconciliations require exact amount matching and 12-digit UTR verification before state transitions.
4. **Documentation Sync Policy:** Whenever new features, database schema adjustments, or operational workflows are added to the codebase, both `README.md` and `PROJECT.md` must be updated concurrently.

---

## 📄 License
This project is proprietary and confidential. Property of **Shri Trimurti Fitness Club**. All rights reserved.
