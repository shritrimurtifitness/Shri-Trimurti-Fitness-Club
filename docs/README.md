# Shri Trimurti Fitness — Project Documentation Index

This directory contains the complete technical architecture, setup guides, and system documentation for the **Shri Trimurti Fitness** booking and automation platform (Cricket Turf & Football Turf).

---

## 📚 Table of Contents

### 1. External Integrations & Setup
- **[Google Business Profile API Setup](google-business-api-setup.md)**  
  Step-by-step OAuth 2.0 configuration, client credentials, refresh token, verified Location ID (`8011133562872577261`), and Google Support Case (`0-3671000041644`) for AI-powered review replies.
- **[WhatsApp Cloud API Bot Implementation](whatsapp-bot-implementation-plan.md)**  
  Architecture and setup for the Meta WhatsApp Cloud API interactive booking engine, slot inquiry, and automated responses.
- **[Bank SMS Auto-Verification Engine](bank-sms-auto-verification-plan.md)**  
  MacroDroid integration for real-time bank credit SMS reconciliation, auto-confirming pending UPI slot reservations instantly.

---

### 2. Loyalty, Promotions & Pricing Logic
- **[Trimurti Coins Loyalty Rewards System](trimurti-coins-loyalty-system-plan.md)**  
  Full specification for player rewards (`1 Coin = ₹1`), tier progression, automatic 30-day expiry crons, churn bonuses, and the strict ₹300 operational price floor.
- **[Private Coupons & Stealth Architecture](private-coupons-stealth-architecture-plan.md)**  
  Targeted promotional coupons, redemption caps, validation engines, and anti-abuse safeguards.
- **[WhatsApp Engine Coupon & Loyalty Stacking](whatsapp-engine-coupon-integration-plan.md)**  
  Bidirectional stacking logic allowing players to combine coupons and Trimurti Coins on a single reservation with dynamic UPI QR generation.

---

### 3. Automated Workflows & Customer Retention
- **[Smart Churn Re-Engagement Engine](smart-churn-reengagement-plan.md)**  
  Automated retention crons identifying dormant players at 7, 14, and 30-day intervals with personalized WhatsApp incentives.
- **[WhatsApp Reminders & Post-Match Feedback](whatsapp-reminders-feedback-plan.md)**  
  Automated 2-hour pre-match reminders, calendar invites, and post-match Google Review collection prompts.
- **[Weekly BI Executive Summary Automation](automated-weekly-bi-executive-summary-plan.md)**  
  Automated Monday morning management reports tracking revenue, turf utilization, peak hours, and player repeat rates.

---

### 4. UI/UX & Web Engine
- **[Landing Page & Conversion Analysis](landing-page-analysis.md)**  
  UX/UI breakdown, design system standards, and conversion optimization for the web booking engine.

---

*Last Updated: November 17, 2026*
