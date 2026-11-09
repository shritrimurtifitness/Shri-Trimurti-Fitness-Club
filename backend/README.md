# TurfZone Backend

## Setup

```bash
cd backend
npm init -y
npm install express cors dotenv jsonwebtoken bcryptjs pg
```

## Environment Variables

Create a `.env` file:

```
PORT=5000
DATABASE_URL=postgresql://user:pass@host:5432/turfzone
JWT_SECRET=your-super-secret-jwt-key-change-this
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
FRONTEND_URL=http://localhost:5173
```

## Database Setup

1. Create a PostgreSQL database (Neon, Supabase, or local)
2. Run: `psql $DATABASE_URL -f schema.sql`

## Run

```bash
node server.js
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | No | Admin login |
| GET | `/api/slots?date=YYYY-MM-DD` | No | Get available slots |
| PATCH | `/api/slots/:id/toggle` | Admin | Block/unblock slot |
| POST | `/api/bookings` | No | Create booking |
| GET | `/api/bookings` | Admin | List all bookings |
| PATCH | `/api/bookings/:id/cancel` | Admin | Cancel booking |
| GET | `/api/admin/stats` | Admin | Dashboard stats |
| POST | `/api/payments/create-order` | No | Create Razorpay order |
| POST | `/api/payments/verify` | No | Verify payment |
| GET | `/api/health` | No | Health check |

## Deploy

- **Render**: Connect repo, set build command `npm install`, start command `node server.js`
- **Railway**: Connect repo, auto-detected as Node.js
