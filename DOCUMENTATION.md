# Shri Trimurti Sports Arena - Technical Documentation

## 1. Architecture Overview

The platform uses a decoupled client-server architecture:
- **Frontend (Client):** A React SPA (Single Page Application) built with Vite. It consumes the REST API provided by the backend and uses WebSockets (Socket.io) for real-time updates (like the Live Occupancy Pulse). It utilizes React Router for navigation and Tailwind CSS for utility-first styling.
- **Backend (Server):** A Node.js/Express.js REST API. It handles business logic, database interactions, authentication, and integration with third-party services (Razorpay, Cloudinary, Resend).
- **Database:** PostgreSQL is the primary data store.
- **Caching & Queue:** Redis is used for API rate limiting, caching heavy queries (like slots and analytics), and managing ephemeral data.

## 2. Project Folder Structure

\`\`\`
turfbook-pro/
├── backend/                  # Node.js Server
│   ├── config/               # Database, Redis, and Cloudinary configurations
│   ├── middleware/           # Rate limiting, Auth validation, Error handling
│   ├── migrations/           # Database schema migrations
│   ├── routes/               # API endpoint definitions (REST)
│   ├── services/             # Third-party integrations (Resend, Razorpay)
│   ├── server.js             # Main application entry point
│   └── package.json          # Backend dependencies
├── src/                      # React Frontend
│   ├── assets/               # Static assets, fonts, and images
│   ├── components/           # Reusable UI components
│   │   ├── admin/            # Admin dashboard specific components
│   │   ├── landing/          # Public-facing landing page sections
│   │   ├── staff/            # Staff-facing components (Scanner)
│   │   └── ui/               # Base UI components (Shadcn/Radix)
│   ├── hooks/                # Custom React hooks (useMobile, useToast, useSocket)
│   ├── lib/                  # Utility functions and Axios API configuration
│   ├── pages/                # Page-level components
│   │   └── admin/            # Admin Dashboard views
│   ├── App.tsx               # Main Router and Theme provider
│   ├── index.css             # Global Tailwind styles
│   └── main.tsx              # React DOM entry point
├── database_schema.sql       # Complete database schema dump
├── package.json              # Frontend dependencies
└── vite.config.ts            # Vite bundler configuration (includes PWA setup)
\`\`\`

## 3. Core Database Schema

The system uses a robust relational schema in PostgreSQL:

- \`users\`: Authentication and authorization. Roles include \`user\`, \`admin\`, and \`staff\`. Staff can have PIN hashes for quick tablet login.
- \`turfs\`: The physical facilities (e.g., Box Cricket, Snooker). Includes dynamic pricing configurations for time/day combinations and physical resource mapping (to prevent double booking shared physical spaces).
- \`slot_templates\`: Pre-configured rules for generating daily slots based on the turf's operational hours and pricing model.
- \`slots\`: Individual bookable time units generated dynamically from templates.
- \`bookings\`: Customer reservations mapping users to slots. Includes Razorpay order tracking and payment status.
- \`payments\`: Granular financial tracking tied to bookings. Includes method (online, cash), amount, and settlement status.
- \`table_sessions\`: Ad-hoc, time-based sessions for facilities like Snooker/Pool, tracking start/end times instead of fixed slots.
- \`arena_closures\`: System-wide blocks for specific dates (e.g., maintenance).
- \`tournaments\` & \`tournament_registrations\`: Management of seasonal events and team sign-ups.

## 4. Key Workflows

### 4.1 Dynamic Slot Generation (JIT)
To save database space, slots are not generated years in advance. 
Instead, when a user selects a date on the \`BookingPage\`, the backend checks if slots exist for that date/turf. If not, it executes the \`generate_daily_slots\` PostgreSQL function, which reads \`slot_templates\` and inserts the slots for that specific day instantly.

### 4.2 Shared Physical Resources
If "Box Cricket" and "Football" utilize the same physical ground, they are mapped to the same \`physical_resource_id\`.
When a slot is booked for Cricket, the backend automatically blocks the overlapping time slot for Football to prevent physical double-booking, while keeping the digital entities separate.

### 4.3 Live Occupancy Pulse
The dashboard features a "Live Pulse" that uses \`date-fns\` to calculate exactly which slots or table sessions are currently active based on the server time. This is broadcast via \`Socket.io\` to the frontend to highlight active turfs in green (blinking indicator).

### 4.4 Financial Settlement
The "Close the Day" workflow allows admins to calculate daily revenue (Online vs Cash). Online payments are considered settled automatically. Cash collected by staff on the floor is marked as unsettled until the admin manually "settles" it through the `AdminFinance` dashboard.

### 4.5 Ghost Booking Cleanup (Cron Setup)
To prevent unpaid or abandoned checkout sessions (e.g. users who open the Razorpay dialog but drop out) from permanently blocking active turf slots, a cleanup script removes pending bookings older than 2 minutes. 

To keep the Neon Database sleep-friendly (scaling to zero for cost efficiency), this task is NOT run via an internal Node.js timer loop. Instead, a secured API route (`POST /api/bookings/cleanup`) is exposed. 
- The endpoint is protected via an authorization header checking `x-cron-secret` against the `CRON_SECRET` environment variable.
- An external cron coordinator (e.g., cron-job.org or Vercel Crons) is configured to securely trigger this endpoint periodically (e.g., every 10–30 minutes), enabling the database to suspend automatically during idle hours.

## 5. Security & Performance

- **Authentication:** JWT (JSON Web Tokens) are used for stateless API authentication.
- **Rate Limiting:** Redis-backed rate limiting protects critical endpoints (e.g., login, password reset).
- **Caching:** Standardized \`GET\` requests (like public slots) are cached in Redis to reduce database load. Cache invalidation happens dynamically on booking creation/cancellation.
- **PWA Capabilities:** The \`vite-plugin-pwa\` allows the admin and staff dashboards to install as native applications on mobile and desktop, utilizing service workers for asset caching and offline resilience.
