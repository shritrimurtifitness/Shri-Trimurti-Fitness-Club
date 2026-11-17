# Automated Weekly Turf Business Intelligence (Executive Summary) — Implementation Plan

> **Objective:** Deliver a high-impact, C-suite executive summary to the arena owner's WhatsApp every Monday at 8:00 AM IST. Automatically synthesizes 7-day revenue, sport breakdown, week-over-week growth, dead-zone slot monetization opportunities, and customer feedback sentiment.
> **Scheduled Trigger:** Triggered weekly via **cron-job.org** HTTP webhook (`0 8 * * 1` in Asia/Kolkata).
> **Guarantee:** 100% Zero-Hallucination — PostgreSQL computes every single rupee, percentage, and slot count; AI only formats the executive briefing and clusters text feedback.

---

## 1. System Architecture

```
                  [cron-job.org]
            (Every Monday 8:00 AM IST)
                         │
                         ▼
        [POST /api/analytics/weekly-executive-summary]
             (Protected by x-bi-secret)
                         │
                         ▼
        ┌────────────────────────────────────────┐
        │ 1. PostgreSQL Financial & Slot Engine  │
        │    - 7-Day Revenue (Cricket vs Football)
        │    - Week-over-Week Growth %           │
        │    - Peak vs Afternoon Slot Occupancy  │
        │    - Star Team of the Week             │
        │    - Customer Feedback Ratings & Text  │
        └──────────────────┬─────────────────────┘
                           │
                           ▼
        ┌────────────────────────────────────────┐
        │ 2. Gemini 3.5 Flash Executive Analyst  │
        │    - Formats concise WhatsApp brief    │
        │    - Clusters maintenance feedback     │
        │    - Suggests dead-zone pricing idea   │
        └──────────────────┬─────────────────────┘
                           │
            ┌──────────────┴──────────────┐
            ▼                             ▼
   [Admin WhatsApp Message]      [PostgreSQL History]
   (Delivered to Owner phone)    (Saved in `weekly_executive_summaries`)
                                          │
                                          ▼
                               [Admin Analytics View]
                               (Browse past weekly reports)
```

---

## 2. Deterministic SQL Aggregation Engine (The 4 Data Blocks)

All numbers are calculated purely in PostgreSQL using exact date ranges (`previous Monday 00:00:00` to `Sunday 23:59:59` IST):

### Block 1: Financial Health & Week-over-Week Growth
```sql
-- Current Week (Mon - Sun)
SELECT 
  COALESCE(SUM(b.paid_amount), 0) AS total_revenue,
  COALESCE(SUM(CASE WHEN t.facility_type = 'cricket' THEN b.paid_amount ELSE 0 END), 0) AS cricket_revenue,
  COALESCE(SUM(CASE WHEN t.facility_type = 'football' THEN b.paid_amount ELSE 0 END), 0) AS football_revenue,
  COUNT(b.id) AS total_matches,
  COUNT(DISTINCT b.user_id) AS unique_teams,
  -- Best revenue day
  MODE() WITHIN GROUP (ORDER BY TO_CHAR(s.date, 'Day')) AS peak_revenue_day
FROM bookings b
JOIN slots s ON b.slot_id = s.id
JOIN turfs t ON s.turf_id = t.id
WHERE b.status IN ('confirmed', 'completed')
  AND s.date >= $start_date AND s.date <= $end_date;
```
- Compare against previous 7-day window to calculate exact **Week-over-Week (WoW) Growth Percentage**:
  $$\text{Growth \%} = \frac{\text{Current Week} - \text{Previous Week}}{\text{Previous Week}} \times 100$$

### Block 2: Slot Utilization & "Dead Zone" Opportunity
- **Peak Hours Occupancy (Friday to Sunday 5:00 PM – 11:00 PM)**:
  $$\text{Peak Occupancy} = \frac{\text{Booked Peak Slots}}{\text{Total Available Peak Slots}} \times 100$$
- **Dead Zone Afternoon Occupancy (Monday to Friday 12:00 PM – 4:00 PM)**:
  $$\text{Dead Zone Occupancy} = \frac{\text{Booked Afternoon Slots}}{\text{Total Afternoon Slots}} \times 100$$
- **Vacant Slot Count**: Number of unbooked daytime slots that generated zero revenue.

### Block 3: Star Team & Customer Loyalty Watchlist
- **Top Spending Squad**:
  `SELECT u.name, u.phone, COUNT(b.id) as matches, SUM(b.paid_amount) as total_spent ... ORDER BY total_spent DESC LIMIT 1`
- **New vs Returning Split**: Count of first-time bookers vs teams with $\ge 2$ historical bookings.

### Block 4: Customer Feedback Sentiment & Maintenance Flags
```sql
SELECT b.feedback_rating, b.feedback_comment, u.name as customer_name, s.date
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN slots s ON b.slot_id = s.id
WHERE s.date >= $start_date AND s.date <= $end_date
  AND (b.feedback_rating IS NOT NULL OR b.feedback_comment IS NOT NULL);
```

---

## 3. Database Schema Migration

Create a dedicated ledger table to preserve every executive summary for historical comparison and analytics:

```sql
CREATE TABLE IF NOT EXISTS weekly_executive_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue NUMERIC(10, 2) DEFAULT 0,
  previous_revenue NUMERIC(10, 2) DEFAULT 0,
  growth_percentage NUMERIC(6, 2) DEFAULT 0,
  cricket_revenue NUMERIC(10, 2) DEFAULT 0,
  football_revenue NUMERIC(10, 2) DEFAULT 0,
  matches_count INT DEFAULT 0,
  unique_teams_count INT DEFAULT 0,
  peak_occupancy_pct NUMERIC(5, 2) DEFAULT 0,
  dead_zone_occupancy_pct NUMERIC(5, 2) DEFAULT 0,
  unbooked_afternoon_slots INT DEFAULT 0,
  average_rating NUMERIC(3, 2) DEFAULT 5.0,
  star_team_name VARCHAR(120),
  star_team_matches INT DEFAULT 0,
  raw_data_json JSONB,
  generated_summary_text TEXT NOT NULL,
  dispatched_to_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_bi_period ON weekly_executive_summaries(period_start DESC);
```

---

## 4. AI Executive Synthesis (Gemini 3.5 Flash)

### Strict Zero-Hallucination Guardrails:
1. All numbers are pre-computed in SQL. The AI prompt states: *"You are strictly forbidden from altering or inventing numbers. Use the exact figures supplied."*
2. Gemini's role is strictly:
   - Formatting the numbers into a clean, executive WhatsApp brief.
   - Grouping customer feedback comments into Praise vs Maintenance flags.
   - Translating unbooked afternoon slots into a practical pricing idea (e.g. afternoon student pass).
3. **Deterministic Fallback**: If the Gemini API is offline or returns an error, a pre-built TypeScript template produces the exact WhatsApp summary instantly.

---

## 5. What the Owner Receives on WhatsApp (Monday 8:00 AM)

```
📊 *SHRI TRIMURTI ARENA — WEEKLY EXECUTIVE SUMMARY*
🗓️ *Period: 09 Nov – 15 Nov 2026*

💰 *1. REVENUE PERFORMANCE:*
• Total Revenue: *₹42,800* (🟢 *+16%* vs last week)
• Cricket Turf: *₹28,600* (67%)
• Football Turf: *₹14,200* (33%)
• Best Day: *Saturday (₹15,400)*
• Payment Modes: 82% UPI | 18% Cash

⚡ *2. UNTAPPED SLOT OPPORTUNITY:*
• Evening & Weekend Occupancy: *91%* (Excellent 🔥)
• Weekday Afternoon (12 PM – 4 PM) Occupancy: *14%*
• 💡 *Actionable Idea:* 24 daytime slots went unbooked. Promoting a flat ₹400 afternoon student rate could generate ~₹12,000/month extra with zero added cost.

🚨 *3. GROUND SENTIMENT & MAINTENANCE:*
• Average Match Rating: *4.8 / 5.0* ⭐ (18 responses)
• ⚠️ *Maintenance Note:* 2 captains mentioned drinking water ran out Sunday evening.
• 👍 *Player Praise:* Strong positive feedback on the new batting turf pitch grip.

👥 *4. SQUAD ACTIVITY:*
• 26 total matches played | 19 unique teams
• 4 brand new squads joined this week
• Star Team: *Team Maratha Warriors (3 matches)*

━━━━━━━━━━━━━━━━━━━━
Have a productive week, Boss! 🏏⚽
```

---

## 6. Setup on `cron-job.org`

Setting up the scheduled trigger on [cron-job.org](https://cron-job.org):

1. **Title**: `Trimurti Weekly Executive Summary`
2. **URL**: `https://shri-trimurti-fitness-club.onrender.com/api/analytics/weekly-executive-summary`
3. **Execution Schedule**:
   - Days: **Monday**
   - Time: **08:00 AM IST**
   - Crontab (in `Asia/Kolkata` time zone): `0 8 * * 1` *(or `30 2 * * 1` in UTC)*
4. **Request Method**: `POST` (or `GET`)
5. **Headers**:
   - `x-bi-secret`: `trimurti_bi_secret_2026`
   - `Content-Type`: `application/json`

---

## 7. Implementation Phases

| Phase | Description | Key Files |
| :--- | :--- | :--- |
| **Phase 1** | Database Migration: Create `weekly_executive_summaries` table in Neon Postgres | Neon DB SQL |
| **Phase 2** | Weekly BI Aggregation Service: 7-day SQL metrics calculation + Gemini executive synthesis | `backend/services/weeklyBiService.js` |
| **Phase 3** | Webhook API Route: `POST /api/analytics/weekly-executive-summary` + admin fetch routes | `backend/routes/analytics.js` |
| **Phase 4** | Admin Analytics UI: Add "Weekly Executive Summaries" history and "Generate Live Summary" button | `frontend/src/pages/admin/AdminAnalytics.tsx` |
| **Phase 5** | Verification & Automated Test Suite: Test 7-day SQL accuracy, growth %, fallback, and cron trigger | `scratch/test_weekly_bi_e2e.js` |

---

## Your Feedback
Please review this implementation plan. Once you give the go-ahead, I will proceed with executing each phase and verifying with tests!
