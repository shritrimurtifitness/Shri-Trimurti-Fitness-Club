# Implementation Plan: WhatsApp Matchday Reminders & Viral Google Review Collector

> [!NOTE]
> **Objective**: Automatically send personalized matchday reminders 2 hours before kickoff, and collect 5-star Google Reviews 1 hour after match completion on autopilot.

---

## 1. System Architecture & Workflow

```
                                      Cron Scheduler (Runs every 10 mins)
                                                    │
                      ┌─────────────────────────────┴─────────────────────────────┐
                      ▼                                                           ▼
       [Check Slots Starting in ~2 Hours]                          [Check Slots Ended ~1 Hour Ago]
                      │                                                           │
                      ▼                                                           ▼
         `reminder_sent_at IS NULL`                                  `feedback_sent_at IS NULL`
                      │                                                           │
                      ▼                                                           ▼
        Send WhatsApp Matchday Alert                               Send WhatsApp 2-Button Survey
                      │                                                           │
                      ▼                                                           ▼
       `reminder_sent_at = NOW()`                                  `feedback_sent_at = NOW()`
                                                                                  │
                                                   ┌──────────────────────────────┴──────────────────────────────┐
                                                   ▼                                                             ▼
                                     Player Taps `[⭐️⭐️⭐️⭐️⭐️ Loved it!]`                        Player Taps `[💬 Give Feedback]`
                                                   │                                                             │
                                                   ▼                                                             ▼
                                     Send Direct Google Review Link                               Record Private Feedback for Arena Staff
```

---

## 2. Database Schema Adjustments

Add tracking columns to the existing `bookings` table to guarantee that **no customer ever receives duplicate reminders or reviews**:

```sql
ALTER TABLE bookings 
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback_rating INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS feedback_comment TEXT DEFAULT NULL;
```

---

## 3. Scheduled Worker Implementation (`backend/services/scheduler.js`)

A resilient background cron job running every 10 minutes (`*/10 * * * *`):

### Job A: Pre-Match Reminder Engine (2 Hours Prior)
* **Query condition**:
  * `b.status = 'confirmed'`
  * `b.reminder_sent_at IS NULL`
  * `s.date = CURRENT_DATE (Asia/Kolkata)`
  * `s.start_time BETWEEN CURRENT_TIME + interval '105 minutes' AND CURRENT_TIME + interval '135 minutes'` (targets the 2-hour window safely across 10-minute cron intervals).
* **WhatsApp Message Delivered**:
  ```text
  🏏 MATCH REMINDER — SHRI TRIMURTI SPORTS ARENA

  Hi {Captain Name}! Your match is coming up in 2 hours! 🔥

  🏟️ Facility: {Turf Name}
  📅 Date: Today
  ⏰ Slot Time: {Start Time} – {End Time}
  📍 Location: Kudire Factory, Sangrul Fata, Koparde

  💡 Dugout Ready:
  High-grade cricket bats, tennis balls, and stumps are set up for your team.

  🗺️ Google Maps Directions:
  https://maps.google.com/?q=Kudire+Factory+Sangrul+Fata+Koparde

  See you on the pitch! 🏆
  ```
* **Interactive Quick Buttons**:
  * `[📍 Directions]`
  * `[👤 Call Desk]`
* **Mark Sent**: `UPDATE bookings SET reminder_sent_at = NOW() WHERE id = $1`.

---

### Job B: Viral Google Review Collector (1 Hour After)
* **Query condition**:
  * `b.status = 'confirmed'`
  * `b.feedback_sent_at IS NULL`
  * `s.date = CURRENT_DATE (Asia/Kolkata)`
  * `s.end_time BETWEEN CURRENT_TIME - interval '90 minutes' AND CURRENT_TIME - interval '60 minutes'`
* **WhatsApp Message Delivered**:
  ```text
  Hope your squad had a blast tonight at Shri Trimurti Sports Arena! 🏆🔥

  How was your turf and pitch experience?
  ```
* **Interactive Quick Buttons**:
  * `[⭐️⭐️⭐️⭐️⭐️ Loved it!]` (`BTN_FEEDBACK_5STAR_<bookingId>`)
  * `[💬 Give Feedback]` (`BTN_FEEDBACK_IMPROVE_<bookingId>`)
* **Mark Sent**: `UPDATE bookings SET feedback_sent_at = NOW() WHERE id = $1`.

---

## 4. Bot Interaction & Review Routing (`backend/services/whatsappBot.js`)

When the customer taps a response button on their phone:

### Scenario A: Player taps `[⭐️⭐️⭐️⭐️⭐️ Loved it!]`
* The bot records `feedback_rating = 5` in Neon DB.
* Instantly sends the Google Maps Review prompt:
  ```text
  Thank you so much, {Captain Name}! 🙌

  Could you take 10 seconds to leave us a quick 5-star review on Google? It really helps other sports lovers find our arena:

  ⭐⭐⭐⭐⭐
  👉 {GOOGLE_REVIEW_LINK}

  Looking forward to hosting your squad again soon! 🏏🔥
  ```

### Scenario B: Player taps `[💬 Give Feedback]`
* The bot records `feedback_rating = 3` (or asks for input).
* The bot sends:
  ```text
  Thank you for letting us know! 🙏

  Our management team is committed to keeping the turf in championship condition. Please type your suggestions below, or call our arena manager directly at +91 7083738373.
  ```
* Any follow-up text sent by the user is saved to `bookings.feedback_comment` and flagged for the admin.

---

## 5. Environment Variables & Settings

Add the Google Maps Review Link to `.env`:
* `GOOGLE_REVIEW_URL=https://g.page/r/YOUR_GOOGLE_CID_OR_REVIEW_LINK/review`

---

## 6. Implementation Steps

1. **Database Migration**: Run SQL migration script to add `reminder_sent_at`, `feedback_sent_at`, and feedback columns.
2. **Install `node-cron`**: Add lightweight, battle-tested `node-cron` dependency to `backend/package.json`.
3. **Build Worker Service**: Create `backend/services/scheduler.js` with idempotent queries and timezone-accurate matching.
4. **Mount Scheduler in Server**: Initialize the cron worker on server startup in `backend/server.js`.
5. **Add Feedback Handlers in Bot**: Wire `BTN_FEEDBACK_5STAR` and `BTN_FEEDBACK_IMPROVE` in `whatsappBot.js`.
6. **Automated End-to-End Simulation**: Run a local test simulating pre-match reminders and post-match feedback loops.
