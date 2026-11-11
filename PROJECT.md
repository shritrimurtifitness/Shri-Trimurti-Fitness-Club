# SHRI TRIMURTI FITNESS CLUB (Turfbook Pro) — Complete Project Documentation

> **Status:** Production-Ready Full-Stack Web Platform & Progressive Web App (PWA)  
> **Location:** Akola, Maharashtra, India  
> **Primary Domains:** Multi-Sport Arena Management, Turf & Table Slot Reservations, Ad-Hoc Table Sessions, Tournament Operations, Staff Floor Scanner, Financial Analytics, and Social Marketing Automation.

---

## 1. Executive Summary

**SHRI TRIMURTI FITNESS CLUB** (internally code-named **Turfbook Pro** / **TurfZone**) is a production-grade sports facility management and booking platform built specifically for contemporary multi-sport complexes. The system serves three primary user personas:

1. **Customers:** Browse facilities, check live slot availability in real time, book turfs or snooker/pool tables, verify contact details via email OTP, pay online via Razorpay or direct UPI with UTR reference, download verifiable QR entry passes, calculate team cost-splits, and share match passes directly to WhatsApp squads.
2. **On-Site Staff:** Quick-login on mobile or tablet terminals via a 6-digit PIN, scan customer QR passes for zero-friction gate check-in, monitor live on-court presence, initiate immediate slot extensions, and operate live stopwatch-based table sessions.
3. **Arena Administrators:** Manage dynamic tiered pricing (day/night, weekday/weekend), track real-time venue occupancy with the **Live Occupancy Pulse**, review and approve UPI UTR payments, execute end-of-day cash settlements, log facility expenses, organize sports tournaments with team registrations, manage staff accounts with granular tab permissions, review immutable audit logs, and automatically generate high-resolution Instagram Story marketing posters via the **Ad Studio**.

---

## 2. Architecture & Technology Stack

The platform is designed as a decoupled client-server architecture with high availability, real-time synchronization, and serverless database cost optimization.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENT / FRONTEND                               │
│  React 18 + TypeScript + Vite + Tailwind CSS + Shadcn/Radix UI        │
│  State & Data: TanStack React Query + Custom Hooks                     │
│  Realtime: Socket.io Client | Animations: Framer Motion               │
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
└─────────┬──────────────────────┬───────────────────────┬───────────────┘
          │                      │                       │
          ▼                      ▼                       ▼
┌──────────────────┐   ┌──────────────────┐    ┌─────────────────────────┐
│   POSTGRESQL     │   │   REDIS CACHE    │    │  THIRD-PARTY SERVICES   │
│   Neon Database  │   │   (ioredis)      │    │  • Razorpay (Payments)  │
│  • 19 Relational │   │  • Query caching │    │  • Brevo / Resend (SMTP)│
│    Tables        │   │  • Rate limiting │    │  • Cloudinary (Media)   │
│  • PL/pgSQL JIT  │   │  • Graceful DB   │    │  • Meta WhatsApp API    │
│    Functions     │   │    fallback      │    │  • Canvas Confetti      │
└──────────────────┘   └──────────────────┘    └─────────────────────────┘
```

### 2.1 Frontend Stack
- **Framework:** React 18.3.1 with TypeScript 5.8.3
- **Bundler & Tooling:** Vite 5.4.19 (with `@vitejs/plugin-react-swc`)
- **Routing:** `react-router-dom` v6.30.1 with role-based route guards
- **Styling:** Tailwind CSS 3.4.17, `tailwind-merge`, `clsx`, `tailwindcss-animate`
- **UI Component Primitives:** Radix UI (`@radix-ui/react-*`), Shadcn UI patterns
- **Data Fetching & State:** `@tanstack/react-query` v5.83.0
- **Forms & Validation:** `react-hook-form` v7.61.1 with `zod` schema validation
- **Animations:** `framer-motion` v12.38.0
- **QR Scanning & Generation:** `html5-qrcode` v2.3.8 (camera scanner), `qrcode.react` v4.2.0 (SVG generator)
- **Visual Analytics:** `recharts` v3.8.1 (Bar, Area, Pie charts)
- **Exporting & Capture:** `html-to-image` v1.11.13 (Instagram Story ad generation)
- **Realtime:** `socket.io-client` v4.8.3
- **Progressive Web App:** `vite-plugin-pwa` v1.2.0 with Workbox runtime caching
- **Feedback & Notifications:** `sonner` v1.7.4 and `canvas-confetti` v1.9.4

### 2.2 Backend Stack
- **Runtime & Web Framework:** Node.js v18+ with Express.js v5.2.1
- **Database Client:** `pg` (v8.20.0) with pooled connections optimized for serverless PostgreSQL
- **Caching & Ephemeral Store:** Redis via `ioredis` (v5.10.1) with graceful memory fallback
- **Real-Time Engine:** Socket.io (v4.8.3)
- **Security & Middlewares:**
  - `helmet` (v8.1.0) for HTTP header hardening
  - `compression` (v1.8.1) for gzip response compression
  - `express-rate-limit` (v8.3.2) & `rate-limit-redis` (v4.3.1) for IP throttling
  - `cors` (v2.8.6) with dynamic IP and domain origin checker
  - `jsonwebtoken` (v9.0.3) for stateless authentication
  - `bcryptjs` (v3.0.3) for password and PIN hashing
- **File & Media Storage:** Cloudinary via `multer` (v1.4.5) & `multer-storage-cloudinary` (v4.0.0)
- **Payment Processing:** `razorpay` (v2.9.6) with SHA-256 HMAC signature verification
- **Email Delivery:** Direct Brevo (Sendinblue) REST API with automatic failover to `resend` (v6.12.2)

---

## 3. Directory & File Structure

```
ShriTrimurtiFitness/
├── clean_backup.sql               # Full SQL database backup with seed data (ignored in git)
├── database_schema.sql            # Master PostgreSQL DDL schema definition
├── DOCUMENTATION.md               # Quick technical brief
├── README.md                      # Public repository readme
├── PROJECT.md                     # Comprehensive project documentation
├── package.json                   # Root monorepo convenience scripts
├── .gitignore                     # Monorepo git ignore rules
│
├── frontend/                      # React 18 + Vite + TypeScript Client
│   ├── package.json               # Frontend dependencies and Vite build scripts
│   ├── vite.config.ts             # Bundler config, PWA manifest & Workbox rules
│   ├── tailwind.config.ts         # Custom colors (turf neon green), font families, animations
│   ├── tsconfig.json              # TypeScript configuration
│   ├── index.html                 # Single page application HTML entry
│   ├── vercel.json                # SPA rewrite rules
│   ├── public/                    # Static public assets (manifest, robots, logos)
│   └── src/                       # Frontend source code
│       ├── main.tsx               # React root entry point
│       ├── App.tsx                # React Router definitions, ThemeProvider, QueryClient
│       ├── index.css              # Global CSS, Tailwind utilities, custom scrollbars
│       ├── assets/                # Facility pictures, turf backgrounds, brand logo
│       ├── hooks/                 # Custom React hooks (useSocket, useToast, useMobile)
│       ├── lib/                   # Utility libraries (api, utils, whatsapp, mock-data)
│       ├── components/            # Reusable UI components (landing, admin, staff, ui)
│       └── pages/                 # Routed view components (Index, BookingPage, admin/*)
│
└── backend/                       # Node.js Express REST API server
    ├── package.json               # Backend dependencies and node scripts
    ├── server.js                  # Express entry point, socket initialization, auto-migrations
    ├── config/                    # Infrastructure configurations (db, redis, cache, cloudinary)
    ├── middleware/                # Express middleware (auth, rateLimiter)
    ├── routes/                    # Modular API route controllers (bookings, slots, admin, etc.)
    ├── services/                  # Third-party services (WhatsApp Cloud API)
    └── utils/                     # Utility modules (Brevo & Resend dual-provider mailer)
```
    │   ├── AdminWhatsAppModal.tsx # Admin 1-click customer WhatsApp notifier
    │   ├── landing/               # Public landing page sections
    │   │   ├── HeroSection.tsx
    │   │   ├── FacilitiesSection.tsx
    │   │   ├── FeaturesSection.tsx
    │   │   ├── PricingSection.tsx
    │   │   ├── UpcomingTournaments.tsx
    │   │   ├── GallerySection.tsx
    │   │   ├── TestimonialsSection.tsx
    │   │   ├── ContactSection.tsx
    │   │   └── FooterSection.tsx
    │   ├── admin/                 # Admin specific components
    │   │   ├── LiveOccupancyPulse.tsx # Real-time visual arena court monitor
    │   │   ├── LivePresence.tsx       # Live floor check-in and waiting list
    │   │   └── AdminDateFilter.tsx    # Reusable date range selector
    │   ├── staff/
    │   │   └── StaffScanner.tsx   # Camera-based HTML5 QR code gate scanner
    │   └── ui/                    # 40+ Shadcn atomic UI components
    └── pages/                     # Routed view components
        ├── Index.tsx              # Landing homepage
        ├── BookingPage.tsx        # 5-step customer booking wizard
        ├── MyBookings.tsx         # Mobile number lookup for active/past passes
        ├── TournamentDetails.tsx  # Tournament landing view & team registration
        ├── TournamentRegistrationDialog.tsx # Tournament registration modal
        ├── StaffLogin.tsx         # Tablet-friendly 6-digit numeric PIN entry
        ├── AdminLogin.tsx         # Administrator email + password portal
        └── admin/                 # 20+ Administrative control screens
            ├── AdminDashboard.tsx
            ├── AdminBookings.tsx
            ├── AdminCalendar.tsx
            ├── AdminSlots.tsx
            ├── AdminTables.tsx
            ├── AdminSchedules.tsx
            ├── AdminFacilities.tsx
            ├── AdminTournaments.tsx
            ├── AdminTournamentRegistrations.tsx
            ├── AdminAnalytics.tsx
            ├── AdminFinance.tsx
            ├── AdminAdStudio.tsx
            ├── AdminPricing.tsx
            ├── AdminGallery.tsx
            ├── AdminTestimonials.tsx
            ├── AdminClosures.tsx
            ├── AdminAuditLogs.tsx
            ├── AdminStaff.tsx
            └── AdminSettings.tsx
```

---

## 4. Database Schema & Entities

The relational database is architected in PostgreSQL with `uuid-ossp` extensions for secure, non-sequential identifiers.

```mermaid
erDiagram
    users ||--o{ bookings : places
    users ||--o{ audit_logs : triggers
    users ||--o{ password_resets : requests
    turfs ||--o{ slots : generates
    turfs ||--o{ slot_templates : defines
    turfs ||--o{ table_sessions : hosts
    turfs ||--o{ arena_closures : affects
    slots ||--o{ bookings : reserves
    bookings ||--o{ payments : settles
    tournaments ||--o{ tournament_registrations : enrolls
```

### 4.1 Data Dictionary

| Table Name | Primary Key | Description & Key Columns |
|---|---|---|
| `users` | `id` (UUID) | Admin, staff, and customer accounts. Columns: `name`, `email`, `phone`, `password_hash`, `role` (`user`, `admin`, `staff`), `pin_hash` (6-digit PIN), `token_version` (logout invalidation), `allowed_tabs` (RBAC access array). |
| `turfs` | `id` (UUID) | Physical and digital facilities. Columns: `name`, `facility_type` (`cricket`, `football`, `snooker`, `pool`), `pricing_model` (`slot` or `hourly`), `weekday_day_price`, `weekday_night_price`, `weekend_day_price`, `weekend_night_price`, `table_count`, `opening_hour`, `closing_hour`, `physical_resource_id`, `is_active`. |
| `slot_templates` | `id` (UUID) | Weekly recurring master schedule rules. Columns: `turf_id`, `day_of_week` (0-6), `start_time`, `end_time`, `price`. |
| `slots` | `id` (UUID) | Concrete bookable hourly time units. Columns: `turf_id`, `date`, `start_time`, `end_time`, `price`, `table_number`, `is_available`. |
| `bookings` | `id` (UUID) | Customer reservations. Columns: `user_id`, `slot_id`, `status` (`pending`, `pending_verification`, `confirmed`, `cancelled`, `rejected`, `completed`), `payment_status` (`pending`, `paid`, `refunded`), `paid_amount`, `remaining_amount`, `payment_mode` (`cash`, `upi`, `online`), `qr_token` (UUID entry pass), `checked_in_at`, `is_manual`, `utr_number`. |
| `payments` | `id` (UUID) | Granular financial transactions. Columns: `booking_id`, `amount`, `method` (`online`, `cash`, `upi`), `platform_fee`, `is_settled`, `razorpay_order_id`, `razorpay_payment_id`. |
| `table_sessions` | `id` (UUID) | Ad-hoc stopwatch timer sessions for snooker/pool. Columns: `turf_id`, `name`, `table_number`, `customer_name`, `customer_phone`, `start_time`, `end_time`, `total_amount`, `payment_mode`, `status` (`running`, `completed`, `cancelled`), `is_settled`. |
| `arena_closures` | `id` (SERIAL) | Facility or venue-wide maintenance/holiday blocks. Columns: `date` (UNIQUE), `reason`, `turf_id` (NULL = global). |
| `tournaments` | `id` (UUID) | Competitive events. Columns: `name`, `sport_type`, `description`, `rules`, `entry_fee`, `prize`, `start_date`, `end_date`, `max_teams`, `banner_image`, `is_featured`, `show_on_homepage`, `display_priority`, `is_active`. |
| `tournament_registrations` | `id` (UUID) | Team tournament enrollments. Columns: `tournament_id`, `team_name`, `captain_name`, `phone`, `email`, `payment_status` (`pending_verification`, `paid`, `rejected`), `utr_number`, `payment_mode`, `rejection_reason`. |
| `otp_verifications` | `id` (SERIAL) | 4-digit verification codes. Columns: `email`, `otp_code`, `expires_at`, `verified`. |
| `expenses` | `id` (UUID) | Operational overhead costs. Columns: `category` (Equipment, Utilities, Maintenance, Salary), `amount`, `description`, `expense_date`. |
| `site_settings` | `id` (INT = 1) | Arena configuration singleton. Columns: `address`, `phone`, `email`, `working_hours`, `google_rating`, `google_reviews_count`, `google_maps_url`, `gateway_percent`, `gst_percent`, `upi_id`, `upi_qr_url`, `show_testimonials`. |
| `gallery_images` | `id` (UUID) | Media assets. Columns: `cloudinary_url`, `public_id`, `alt_text`, `span_type`, `sort_order`, `resource_type` (`image` or `video`). |
| `testimonials` | `id` (UUID) | Customer feedback. Columns: `name`, `role`, `text`, `rating`, `status` (`pending`, `approved`, `rejected`), `is_featured`. |
| `pricing_plans` | `id` (UUID) | Marketing pricing cards. Columns: `name`, `subtitle`, `price`, `unit`, `features`, `popular`, `facility`, `sort_order`. |
| `audit_logs` | `id` (UUID) | Immutable audit trails. Columns: `admin_id`, `action`, `details`, `created_at`. |
| `password_resets` | `id` (SERIAL) | Self-service password recovery tokens. Columns: `user_id`, `token`, `expires_at`. |
| `whatsapp_logs` | `id` (UUID) | Meta webhook message tracking. Columns: `phone`, `template_name`, `status`, `response`. |

---

## 5. Core Business Workflows & Logic

### 5.1 Just-In-Time (JIT) Slot Generation
Rather than pre-generating millions of empty database rows months in advance, slots are generated on-demand when a user views a date:
1. When `GET /api/slots?date=YYYY-MM-DD` is invoked, the server checks `arena_closures`.
2. If the arena is open, it executes the stored procedure:
   ```sql
   SELECT generate_daily_slots(target_date, id) FROM turfs WHERE is_active = true;
   ```
3. `generate_daily_slots` inspects the turf's operational window (`opening_hour` to `closing_hour`), checks if the date is a weekend (`EXTRACT(DOW FROM target_date) IN (0, 6)`), and generates one slot per table/court for each hour.
4. Slots starting at or after 18:00 automatically receive the night price (`weekday_night_price` or `weekend_night_price`).
5. Redundant slots created before a table count reduction are automatically pruned, provided they have no active bookings.

### 5.2 Shared Physical Resource Management
In multi-sport arenas, the same physical court often serves multiple sports (e.g., Cricket and 5-a-side Football share the main turf).
- Both turfs share an identical `physical_resource_id` (e.g., `1`).
- When a booking is confirmed on Cricket at 19:00, the availability query in `slots.js` and `bookings.js` detects the overlapping slot on the same `physical_resource_id` and marks Football at 19:00 as booked/unavailable.
- This prevents physical double-booking while preserving independent pricing and marketing metrics for each sport.

### 5.3 Dual Payment & Verification Pipelines
The platform provides two robust payment options:

#### Flow A: Direct Arena UPI (Zero Platform Fees)
```
Customer selects slot 
  └── Enters Name, Mobile, Email
        └── 4-digit OTP sent to Email (Brevo / Resend)
              └── Verifies OTP
                    └── Dynamic UPI QR & ID displayed (harshvardhanp@slc)
                          └── Customer transfers funds & inputs 12-digit UTR
                                └── Booking created with status: "pending_verification"
                                      └── Admin verifies UTR against bank statement
                                            ├── [Approved] ➔ Status: "confirmed" ➔ Official Match Pass Email sent
                                            └── [Rejected] ➔ Status: "rejected"  ➔ Rejection Email sent with reason
```

#### Flow B: Razorpay Online Gateway
1. Frontend calls `POST /api/payments/create-order` with the calculated price plus dynamic gateway fee + GST (configured in `site_settings`).
2. Server creates a Razorpay order in INR paise and attaches `razorpay_order_id` to the booking.
3. Razorpay Checkout modal opens. Upon successful completion, the client posts signature credentials to `POST /api/payments/verify`.
4. The server computes `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`.
5. Upon signature match, the booking status transitions to `confirmed`, `payment_status` becomes `paid`, a `payments` ledger record is created, and cache is invalidated.

### 5.4 Live Occupancy Pulse & Presence Engine
- **Live Occupancy Pulse:** An automated background mechanism evaluates the current server timestamp in Indian Standard Time (`Asia/Kolkata`) against active bookings and ongoing table sessions. It categorizes every physical resource into:
  - `available` (Green indicator)
  - `in_use` (Red blinking indicator with active customer name and time window)
  - `booked_soon` (Amber indicator for games starting within 30 minutes)
- **Live Presence Dashboard:** On-site reception monitors all checked-in players versus upcoming arrivals for the day. If network connection fails, the dashboard automatically transitions to an offline mode backed by cached `localStorage` data.

### 5.5 QR Entry Scanner & Match Extension
- Every confirmed reservation generates a cryptographic UUID `qr_token` rendered as an SVG QR Code on the customer's match pass.
- Floor staff point their tablet/phone camera at the QR pass using the built-in scanner (`html5-qrcode`).
- The endpoint `GET /api/bookings/verify-qr/:token` validates the pass, verifies that the booking is for today's date, and indicates payment status (Full Paid vs Cash Due).
- Staff can tap **"Confirm Check-in"** (`PATCH /api/bookings/:id/check-in`) or tap **"Extend Match (+1 Hour)"** (`POST /api/bookings/:id/extend`), which inspects whether the subsequent hour is open and creates an extended reservation on the fly.

### 5.6 WhatsApp Squad Sharing & 1-Click Notifications
- **Customer Team-Split Calculator:** A modal on the booking success screen enables the match organizer to specify team headcount (e.g., 12 players). The system calculates the per-head share and generates a pre-formatted WhatsApp message containing venue address, map URL, match timings, total cost, and captain's personal UPI ID.
- **Admin 1-Click Messaging:** Inside `AdminBookings`, staff can click the WhatsApp icon on any booking row to immediately launch WhatsApp Web/Mobile with pre-filled templates:
  - Official Confirmation Pass
  - Friendly Match Reminder (1-hour before start)
  - UTR / Payment Clarification Request

### 5.7 Ad Studio (Social Media Marketing Automation)
Inside `AdminAdStudio`:
- Selects tomorrow's date (or any custom date) and fetches all open Cricket turf slots.
- Formats slots into a grid layout (e.g., 6:00 AM – 7:00 AM, 7:00 PM – 8:00 PM).
- Renders a styled 1080×1920 Instagram Stories template featuring the arena logo, contact numbers, and neon styling.
- Uses `html-to-image` to generate and download a pixel-perfect PNG poster ready for social media publishing.

### 5.8 Serverless Ghost Booking Cleanup (Cron Setup)
To prevent uncompleted checkout attempts from locking slots indefinitely:
- Pending reservations without payment confirmation older than 2 minutes are eligible for cleanup.
- To prevent continuous database wakeups that defeat Neon Database auto-suspend (scale to zero), this is triggered via an authenticated API endpoint:
  ```
  POST /api/bookings/cleanup
  Header: x-cron-secret: <CRON_SECRET>
  ```
- External schedulers (e.g., cron-job.org or Vercel Crons) call this endpoint every 15–30 minutes, allowing the database to sleep during quiet hours.

---

## 6. Security, Authentication & Performance

### 6.1 Authentication & Role-Based Access Control (RBAC)
- **JWT Authentication:** Tokens are signed with `JWT_SECRET` and expire in 24 hours. The payload contains `id`, `email`, `role`, `allowed_tabs`, and `token_version`.
- **Token Versioning (Instant Revocation):** When a user's password is changed or global logout is triggered, their `token_version` integer in the `users` table is incremented. The `authMiddleware` checks this on every request, immediately rejecting stale tokens.
- **Staff PIN Login:** Staff members can log in by choosing their profile and typing a 6-digit PIN on a touch keypad (`/admin/staff-login`). PINs are stored using `bcryptjs` salt rounds.
- **Tab-Level Permission Filtering:** The `AdminLayout` sidebar filters visible links against the staff user's `allowed_tabs` array. Direct URL entry to unauthorized routes is intercepted and blocked.

### 6.2 Rate Limiting
Endpoints are shielded via Redis-backed rate limiters (`express-rate-limit` + `rate-limit-redis`):
- `globalLimiter`: 100 requests per minute per IP.
- `loginLimiter`: 3 failed login attempts per hour per IP.
- `bookingLimiter`: 10 booking submissions per hour per IP.
- `paymentLimiter`: 10 order creation/verification attempts per hour per IP.
- `reviewLimiter`: 3 reviews per hour per IP.

### 6.3 Cache-Aside Strategy
The Redis caching layer (`backend/config/cache.js`) implements a cache-aside pattern:
- **Public Slots:** Cached for 5 minutes (`slots:YYYY-MM-DD:*`).
- **Facilities List:** Cached for 5 minutes (`facilities:active`).
- **Admin Stats & Analytics:** Cached for 2 minutes (`admin:stats`, `analytics:dashboard`).
- **Tournaments & Gallery:** Cached for 5–10 minutes.
- **Cache Invalidation:** Any mutation (booking creation, payment approval, closure toggle, facility edit) calls `delPattern('slots:*')`, `delPattern('bookings:*')`, or `del('admin:stats')` to ensure consistency.
- **Debug Bypass:** Admins can bypass cache at any time by appending `?nocache=1` to any request.

---

## 7. API Reference

All routes are prefixed with `/api`.

### 7.1 Authentication & Staff (`/api/auth`, `/api/staff`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/login` | Public | Admin & staff email + password authentication |
| `POST` | `/auth/login-pin` | Public | Staff 6-digit PIN authentication |
| `GET` | `/auth/staff-profiles` | Public | List of staff names for tablet PIN selector |
| `PUT` | `/auth/profile` | Bearer | Update logged-in user name & email |
| `PUT` | `/auth/password` | Bearer | Change password (bumps `token_version`) |
| `GET` | `/staff` | Admin | List all staff with assigned permissions |
| `POST` | `/staff` | Admin | Create new staff account with PIN and allowed tabs |
| `PATCH` | `/staff/:id` | Admin | Update staff details, PIN, or allowed tabs |
| `DELETE`| `/staff/:id` | Admin | Delete a staff account |

### 7.2 Bookings & Entry (`/api/bookings`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/bookings/send-otp` | Public | Send 4-digit booking OTP to customer email |
| `POST` | `/bookings/verify-otp` | Public | Verify booking OTP |
| `POST` | `/bookings/submit-upi` | Public | Create booking with UTR reference (`pending_verification`) |
| `POST` | `/bookings` | Public | Create direct or manual booking |
| `GET` | `/bookings` | Bearer | Paginated, filterable booking list |
| `GET` | `/bookings/calendar` | Bearer | Calendar event stream for Day/Week/Month view |
| `GET` | `/bookings/my-bookings/:phone` | Public | Fetch active & historic customer reservations |
| `GET` | `/bookings/verify-qr/:token` | Public | Scan and validate QR match pass |
| `PATCH`| `/bookings/:id/check-in` | Bearer | Mark booking as checked in |
| `POST` | `/bookings/:id/extend` | Bearer | Extend active booking into the next hour |
| `POST` | `/bookings/:id/verify-upi` | Bearer | Approve or reject UPI UTR booking |
| `PATCH`| `/bookings/:id/pay` | Bearer | Settle remaining cash/UPI balance |
| `PATCH`| `/bookings/:id/cancel` | Bearer | Admin cancellation |
| `POST` | `/bookings/cleanup` | Cron Secret | Prune abandoned pending reservations older than 2 mins |

### 7.3 Slots, Facilities & Tables (`/api/slots`, `/api/facilities`, `/api/sessions`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/slots?date=YYYY-MM-DD` | Public | Fetch available slots (triggers JIT generation) |
| `GET` | `/facilities` | Public | Fetch active facilities (pass `?all=true` for admin) |
| `POST` | `/facilities` | Bearer | Add new sports facility with tiered pricing |
| `PATCH`| `/facilities/:id/toggle` | Bearer | Enable/disable facility visibility |
| `PATCH`| `/facilities/:id/tables` | Bearer | Update table count with future booking safety check |
| `POST` | `/facilities/upload` | Bearer | Upload facility cover image to Cloudinary |
| `GET` | `/sessions` | Public | Fetch currently running snooker/pool table sessions |
| `POST` | `/sessions` | Public | Start live walk-in session with timer |
| `PATCH`| `/sessions/:id/stop` | Public | Stop session, compute final bill, and record payment |
| `GET` | `/sessions/history` | Bearer | Historic completed walk-in sessions |

### 7.4 Payments (`/api/payments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/payments/create-order` | Public | Create Razorpay order with platform fee calculation |
| `POST` | `/payments/verify` | Public | Verify Razorpay SHA-256 HMAC signature |

### 7.5 Tournaments (`/api/tournaments`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/tournaments` | Public | List active tournaments |
| `GET` | `/tournaments/featured` | Public | Homepage featured tournament banners |
| `GET` | `/tournaments/:id` | Public | Specific tournament detail and team count |
| `POST` | `/tournaments/send-otp` | Public | Send captain email verification OTP |
| `POST` | `/tournaments/verify-otp` | Public | Verify captain email OTP |
| `POST` | `/tournaments/:id/register` | Public | Register team with bank UTR reference |
| `GET` | `/tournaments/admin` | Bearer | Admin list of all tournaments |
| `POST` | `/tournaments` | Bearer | Create new tournament event |
| `PUT` | `/tournaments/:id` | Bearer | Update tournament event details |
| `GET` | `/tournaments/:id/registrations` | Bearer | View registered teams for tournament |
| `POST` | `/tournaments/registrations/:id/verify-upi` | Bearer | Approve/reject team registration |

### 7.6 Analytics, Finance & Closures (`/api/analytics`, `/api/expenses`, `/api/admin/closures`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/admin/stats` | Bearer | Quick KPI overview (daily & total revenue, bookings) |
| `GET` | `/admin/live-pulse` | Bearer | Real-time physical occupancy of courts & tables |
| `GET` | `/analytics` | Bearer | Comprehensive analytics (daily trends, peak hours) |
| `GET` | `/analytics/finance` | Bearer | Detailed financial breakdown (settled vs unsettled) |
| `POST` | `/analytics/settle` | Bearer | "Close the Day" / batch settle cash collections |
| `GET` | `/expenses` | Bearer | List recorded expenses |
| `POST` | `/expenses` | Bearer | Log new operational expense |
| `DELETE`| `/expenses/:id` | Bearer | Remove expense item |
| `GET` | `/admin/closures` | Bearer | List upcoming arena closure dates |
| `POST` | `/admin/closures` | Bearer | Block date globally or per facility |
| `DELETE`| `/admin/closures/:id` | Bearer | Re-open arena on date |

### 7.7 CMS, Gallery & Settings (`/api/gallery`, `/api/testimonials`, `/api/settings`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/gallery` | Public | Fetch gallery images & videos |
| `POST` | `/gallery` | Bearer | Upload media to Cloudinary gallery |
| `DELETE`| `/gallery/:id` | Bearer | Delete gallery item |
| `GET` | `/testimonials` | Public | Fetch approved testimonials |
| `POST` | `/testimonials` | Public | Submit customer review |
| `GET` | `/testimonials/admin` | Bearer | Moderation review list |
| `PATCH`| `/testimonials/:id/status` | Bearer | Approve or reject review |
| `GET` | `/settings/contact` | Public | Fetch arena contact, UPI ID, QR, and reviews info |
| `PUT` | `/settings/contact` | Bearer | Update arena contact, UPI, and tax settings |
| `POST` | `/settings/upload-qr` | Bearer | Upload arena payment UPI QR code |

---

## 8. Realtime WebSocket Events (Socket.io)

| Event Name | Direction | Trigger Condition | Frontend Response |
|---|---|---|---|
| `booking_updated` | Server ➔ Client | Booking created, cancelled, verified, or extended | Re-fetches slots, active bookings, and Live Pulse |
| `slot_updated` | Server ➔ Client | Closures added/removed, facility modified | Re-renders booking calendar and time pickers |
| `facility_updated` | Server ➔ Client | Court pricing, table count, or active state toggled | Updates landing page cards and admin tables |
| `tournament_update`| Server ➔ Client | Tournament created, edited, or removed | Refreshes tournament banners |
| `tournament_registration_success` | Server ➔ Client | New team registers with UTR | Updates registration count badges |
| `settings_updated` | Server ➔ Client | Contact or UPI settings changed | Updates landing page contact info and payment QR |

---

## 9. Configuration & Environment Variables

### 9.1 Backend Environment Variables (`backend/.env`)

```ini
# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://shritrimurtisports.com

# PostgreSQL Connection String (Neon / AWS / Supabase)
DATABASE_URL=postgresql://user:password@ep-plain-wave.us-east-1.aws.neon.tech/neondb?sslmode=require

# Authentication
JWT_SECRET=super-secure-random-jwt-key-minimum-32-chars

# Redis Cache
REDIS_URL=redis://default:password@your-redis-host:6379

# Cron Secret for Ghost Booking Cleanup
CRON_SECRET=super-secure-cron-secret-key

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx

# Email Delivery (Dual-Provider)
BREVO_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
BREVO_SENDER_EMAIL=hello@shritrimurtisports.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abcdefghijklmnopqrstuvwxyz
```

### 9.2 Frontend Environment Variables (`.env`)

```ini
# Base URL for backend REST API
VITE_API_BASE_URL=https://api.shritrimurtisports.com/api
```

---

## 10. Installation & Local Development Setup

### 10.1 Prerequisites
- **Node.js:** v18.0.0 or higher
- **PostgreSQL:** v14 or higher (or a cloud Neon instance)
- **Redis:** Local Redis (`redis-server`) or cloud Upstash Redis instance

### 10.2 Database Initialization
```bash
# Connect to your PostgreSQL database and run the schema script:
psql -U postgres -d shritrimurti_db -f database_schema.sql
```

### 10.3 Backend Setup & Startup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your PostgreSQL, Redis, and Razorpay/Cloudinary keys

# Run in development mode with auto-reload:
npm run dev
# Server will listen on http://localhost:5000
```

### 10.4 Frontend Setup & Startup
```bash
# In the project root:
npm install
cp .env.example .env
# Ensure VITE_API_BASE_URL=http://localhost:5000/api

# Start Vite dev server:
npm run dev
# Application will run on http://localhost:5173 or http://localhost:8080
```

---

## 11. Testing & Quality Assurance

- **Unit & Component Testing:** Configured via `vitest` and `@testing-library/react`.
  ```bash
  npm run test        # Run Vitest test suite
  npm run test:watch  # Run Vitest in interactive watch mode
  ```
- **Code Linting:**
  ```bash
  npm run lint        # Run ESLint validation
  ```
- **Type Checking & Production Build:**
  ```bash
  npm run build       # Vite production bundle compilation to dist/
  ```

---

## 12. Deployment Architecture & Operations

### 12.1 Recommended Hosting Architecture
- **Frontend SPA:** Deploy to **Vercel** or **Cloudflare Pages**. Enable SPA rewrite rule (`/* -> /index.html`).
- **Backend API:** Deploy to **Render**, **Railway**, or **AWS ECS/EC2**. Ensure `trust proxy` is enabled for accurate client IP rate limiting.
- **Database:** **Neon PostgreSQL** serverless instance.
- **Redis Cache:** **Upstash Redis** (serverless, sleep-friendly) or standard Redis container.

### 12.2 Automated Scheduled Jobs
To ensure abandoned checkouts do not lock active slots, schedule an external HTTPS POST trigger every 15 minutes:
```bash
curl -X POST https://api.shritrimurtisports.com/api/bookings/cleanup \
  -H "x-cron-secret: your-cron-secret"
```

---

## 13. Summary & Project Highlights

1. **True Multi-Sport Support:** Simultaneously manages slot-based cricket/football turfs with shared physical space prevention, alongside continuous stopwatch-billed snooker/pool sessions.
2. **India-Optimized Payment Flows:** Supports zero-fee direct UPI with dynamic QR and bank UTR verification, alongside automated Razorpay online payments with customizable platform and GST pass-through.
3. **Comprehensive Staff & Gate Controls:** Tablet-optimized PIN authentication, instant camera-based QR pass scanning, and 1-click WhatsApp match pass and reminder dispatches.
4. **Built-in Growth & Social Marketing:** The integrated **Ad Studio** generates publication-ready Instagram Story posters directly from live open slot availability.
5. **Cost-Efficient Serverless Foundation:** JIT slot generation, intelligent Redis caching, and an external cron cleanup model that allows Neon serverless PostgreSQL databases to automatically scale to zero during idle periods.
