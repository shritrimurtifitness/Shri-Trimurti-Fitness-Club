# Smart Churn & Re-Engagement Predictor — Architecture & Implementation Plan

> **Objective:** Detect regular cricket and football teams who haven't booked in the last 10–14 days, check if their favorite weekend slot is open, and generate a hyper-personalized, 1-tap WhatsApp re-engagement invitation for the Admin to send before the weekend fills up.
> **Scheduled Trigger:** Triggered weekly via **cron-job.org** HTTP webhook.
> **Guarantee:** 100% Zero-Hallucination — SQL determines customer facts and slot availability; AI only customizes the greeting copy.

---

## 1. System Architecture

```
                  [cron-job.org]
            (Every Thursday 11:00 AM IST)
                         │
                         ▼
             [POST /api/retention/churn-analysis]
             (Protected by x-retention-secret)
                         │
                         ▼
        ┌───────────────────────────────────┐
        │ 1. PostgreSQL Churn Detector      │
        │    - Played ≥ 3 times recently    │
        │    - No active/upcoming bookings  │
        │    - Not contacted in 21 days     │
        └────────────────┬──────────────────┘
                         │
                         ▼
        ┌───────────────────────────────────┐
        │ 2. Live Slot Availability Checker │
        │    - Checks upcoming favorite day │
        │    - Slot Open vs Alternate Slot  │
        └────────────────┬──────────────────┘
                         │
                         ▼
        ┌───────────────────────────────────┐
        │ 3. Gemini 3.5 Flash Personalizer  │
        │    - Polite Marathi/Hinglish copy │
        │    - Team name, time, & facility  │
        └────────────────┬──────────────────┘
                         │
            ┌────────────┴────────────┐
            ▼                         ▼
   [Admin WhatsApp Digest]   [Admin Web Dashboard]
   - Summary of at-risk teams - "Customer Retention" view
   - 1-Tap `wa.me` Send Link - Click to Send / Edit / Snooze
```

---

## 2. Deterministic SQL Churn Logic (Zero Hallucination)

### Step 1: Identifying Regular Teams
A user is classified as a **Regular Team** if:
- Total completed/paid bookings $\ge 3$ in the past 60 days.

### Step 2: Churn Condition
A regular team is flagged as **At Risk** if:
1. **No future bookings**: They have zero bookings scheduled for `date >= CURRENT_DATE`.
2. **Inactivity gap**: Their last match was between **10 to 35 days ago** (missed 1 to 3 regular cycles).
3. **Anti-Spam Cooldown**: They have **not** received a retention outreach in the last **21 days** (stored in `churn_outreach_logs`).

### Step 3: Determining Customer Habits
From historical bookings:
- **Favorite Day of Week**: Mode of `EXTRACT(DOW FROM s.date)` (e.g. 6 = Saturday, 0 = Sunday).
- **Favorite Start Time**: Mode of `s.start_time` (e.g. `20:00:00` for 8 PM).
- **Favorite Turf**: Most booked `turf_id` (Cricket Box vs Football Turf).

### Step 4: Live Slot Availability Check for the Upcoming Weekend
The system calculates the date of the next occurrence of their favorite day:
- Checks if the slot at their favorite time is **Available** (`is_available = true` and no active booking).
- **Case 1 (Slot Open)**: Suggest their exact regular slot.
- **Case 2 (Slot Booked)**: Look for adjacent slots ($\pm 1$ hour) or Sunday alternative and suggest the best alternative.

---

## 3. Database Schema Migration

Create a dedicated ledger table to track outreach history, prevent duplicate messaging, and measure revenue recovered:

```sql
CREATE TABLE IF NOT EXISTS churn_outreach_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name VARCHAR(120),
  customer_phone VARCHAR(20) NOT NULL,
  total_past_matches INT DEFAULT 0,
  preferred_day_of_week INT, -- 0=Sun, 6=Sat
  preferred_time VARCHAR(20),
  target_date DATE,
  target_slot_id UUID REFERENCES slots(id) ON DELETE SET NULL,
  slot_status VARCHAR(20) DEFAULT 'open', -- 'open', 'alternative'
  generated_message TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'drafted', -- 'drafted', 'sent', 'converted', 'snoozed'
  converted_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_churn_user_created ON churn_outreach_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_churn_phone ON churn_outreach_logs(customer_phone);
```

---

## 4. AI Message Generator (Gemini 3.5 Flash)

The AI prompt is strictly constrained to **polite copywriting** using only verified SQL inputs:

```javascript
const prompt = `
You are drafting a friendly, warm WhatsApp re-engagement message for the manager of Shri Trimurti Fitness Club (Sports Arena).
Player Name: "${player.name}"
Matches Played: ${player.matchesCount}
Favorite Facility: "${player.turfName}"
Upcoming Date: "${upcomingDateFormatted}" (${player.dayName})
Slot Status: ${player.isSlotOpen ? `Usual slot (${player.timeStr}) is wide OPEN` : `Usual slot taken; recommended alternate is ${player.alternateTimeStr}`}

Rules:
1. Warm, energetic Indian sports culture greeting (Namaskar / Hello Captain).
2. Polite and never pushy or sounding like an automated corporate bot.
3. Mention their usual slot / day.
4. Keep under 60 words.
5. Provide a clear call to action: "Reply YES to lock it in or tap our booking link".
`;
```

---

## 5. Admin Delivery & Action Workflows

To prevent unwanted automatic messages to VIP customers, the system supports **Admin-in-the-Loop 1-Tap Dispatch**:

### A. Thursday Admin WhatsApp Digest
When cron-job.org fires the webhook every Thursday at 11:00 AM IST:
Admin receives a compiled WhatsApp summary card:

```
📊 *WEEKEND RETENTION ALERT* (3 Teams At Risk)

🏏 *1. Amit Patil (Team Super Kings)*
• Played: 5 matches | Last match: 14 days ago
• Usual Slot: Saturday 8:00 PM (Box Cricket)
• Status: 🟢 *SLOT IS OPEN!*
👉 [Tap to Send Invite via WhatsApp](https://wa.me/919876543210?text=...)

⚽ *2. Kunal Shinde*
• Played: 4 matches | Last match: 12 days ago
• Usual Slot: Sunday 7:00 PM (Football)
• Status: 🟢 *SLOT IS OPEN!*
👉 [Tap to Send Invite via WhatsApp](https://wa.me/919988776655?text=...)

━━━━━━━━━━━━━━━━━━━━
💡 Tapping the link opens WhatsApp with the customized message pre-filled. Just tap Send!
```

### B. Admin Web Dashboard View ("Retention" Tab)
In `frontend/src/pages/admin/AdminBookings.tsx` or a dedicated Retention view:
- Table listing at-risk captains with their attendance history.
- Live badge: `🟢 Regular Slot Open` or `🟡 Alternate Slot Available`.
- Action buttons:
  - **Send WhatsApp**: Opens WhatsApp Web / App with pre-filled message.
  - **Snooze (14 Days)**: Skips player for 2 weeks if admin knows they are injured/out of town.
  - **Custom Note**: Add admin note.

---

## 6. Setup on cron-job.org

Setting up the scheduled trigger on [cron-job.org](https://cron-job.org) is simple:

1. **Title**: `Trimurti Churn Predictor`
2. **URL**: `https://shri-trimurti-fitness-club.onrender.com/api/retention/churn-analysis`
3. **Execution Schedule**:
   - Days: **Every Thursday** (Captains plan weekend matches on Thu/Fri).
   - Time: **11:00 AM IST** (05:30 UTC).
4. **HTTP Method**: `POST` (or `GET`)
5. **Headers**:
   - `x-retention-secret`: `trimurti_retention_secret_2026`
   - `Content-Type`: `application/json`

---

## 7. Implementation Phases

| Phase | Description | Files Involved |
| :--- | :--- | :--- |
| **Phase 1** | Database Migration: Create `churn_outreach_logs` table in Neon Postgres | Neon DB SQL |
| **Phase 2** | Retention Analysis Service: Deterministic SQL query + live slot check + Gemini copywriting | `backend/services/retentionService.js` |
| **Phase 3** | Webhook API Route: `POST /api/retention/churn-analysis` (secured for cron-job.org) | `backend/routes/retention.js`, `backend/server.js` |
| **Phase 4** | WhatsApp Bot Context Hook: If captain replies "YES" to outreach, bot holds slot automatically | `backend/services/whatsappBot.js` |
| **Phase 5** | Admin UI Retention Card / Tab: Display at-risk squads with 1-tap WhatsApp buttons | `frontend/src/pages/admin/AdminRetention.tsx` / `AdminBookings.tsx` |
| **Phase 6** | Automated Tests & Verification: Verify SQL accuracy, 21-day anti-spam cooldown, and cron trigger | `scratch/test_retention.js` |

---

## Your Feedback
Please review this plan. If this matches your vision, approve it and I will proceed with the implementation!
