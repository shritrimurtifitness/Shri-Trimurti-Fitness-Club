# SHRI TRIMURTI FITNESS CLUB (Turfbook Pro)

A comprehensive, full-stack sports facility management and booking platform designed for modern sports arenas. It handles turfs (cricket, football), tables (snooker, pool), tournaments, staff management, financial reporting, and live occupancy tracking.

## 🚀 Features

### Customer Facing
- **Responsive Landing Page:** Premium, interactive UI with dark mode support.
- **Dynamic Bookings:** Real-time slot availability for turfs and tables.
- **Online Payments:** Integrated with Razorpay for seamless booking.
- **Tournaments:** View and register for upcoming sports tournaments.
- **Gallery & Testimonials:** View facility images and customer reviews.
- **Interactive Cursor Glow:** Premium UX touches on desktop devices.

### Admin Dashboard
- **Live Occupancy Pulse:** Real-time tracking of ongoing matches and active tables via Socket.io.
- **Advanced Bookings Management:** View, edit, cancel, and manually add bookings.
- **Dynamic Slot Generation:** Automated slot creation based on operational hours and pricing templates.
- **Facility & Table Management:** Manage multiple turfs, configure pricing by day/time (weekday vs weekend, day vs night), and manage multiple tables for a single facility (e.g., Snooker).
- **Financial Command Center:** Detailed analytics, revenue aggregation, payment tracking, and expense management.
- **Dynamic Closures:** Block specific dates for maintenance or holidays globally.
- **Tournament Management:** Create and manage tournaments, track registrations.
- **Ad Studio:** Automate generation of promotional graphics for social media.
- **Staff Management:** Create secure, role-based accounts for staff members with PIN-based quick login.

### Staff Features
- **Tablet-Friendly Login:** Quick access via PIN.
- **Scanner:** Secure QR entry system for verifying bookings.
- **Presence Dashboard:** Manage active sessions, check-ins, and floor operations.
- **Offline Operations:** PWA support for resilient operations during network interruptions.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 18 + Vite + TypeScript
- **Routing:** React Router DOM v6
- **Styling:** Tailwind CSS, Radix UI, Shadcn UI
- **Animations:** Framer Motion
- **State/Data:** React Query (TanStack Query), Zustand (implicitly or natively handled)
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **PWA:** vite-plugin-pwa

### Backend
- **Framework:** Node.js + Express.js
- **Database:** PostgreSQL (via `pg`)
- **Real-time:** Socket.io
- **Caching/Queue:** Redis (via `ioredis`)
- **Payments:** Razorpay
- **Email:** Resend
- **File Storage:** Cloudinary (via `multer-storage-cloudinary`)
- **Security:** Helmet, express-rate-limit, bcryptjs, jsonwebtoken

## 📋 Prerequisites

- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- Redis server
- Cloudinary Account
- Razorpay Account
- Resend Account (for emails)

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone <repository-url>
cd turfbook-pro
```

### 2. Backend Setup
```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory based on `.env.example`:
```env
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=your-super-secret-jwt-key
FRONTEND_URL=http://localhost:5173

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# Redis
REDIS_URL=redis://localhost:6379

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Resend
RESEND_API_KEY=your_key_here
```

Initialize the database using the provided schema:
```bash
psql -U postgres -d dbname -f database_schema.sql
```

Start the backend server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory based on `.env.example`:
```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend development server:
```bash
npm run dev
```

### 4. Or Run From Root Directory (Convenience)
```bash
npm run install:all     # Installs both frontend and backend dependencies
npm run dev:frontend    # Starts Vite frontend
npm run dev:backend     # Starts Express backend
```

## 📚 Documentation
For a deep dive into the architecture, database schema, and core workflows, see [DOCUMENTATION.md](./DOCUMENTATION.md).

## 📄 License
This project is proprietary and confidential. Unauthorized copying of this file, via any medium, is strictly prohibited.
