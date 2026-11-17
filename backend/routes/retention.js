/**
 * Smart Churn & Re-Engagement Predictor Routes
 * Triggered automatically by cron-job.org or manually via Admin Dashboard.
 */

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const retentionService = require('../services/retentionService');

/**
 * Webhook handler for cron-job.org
 * Accepts POST or GET requests with secret token verification
 */
async function handleChurnAnalysisTrigger(req, res) {
  try {
    const providedSecret =
      req.headers['x-retention-secret'] ||
      req.headers['x-cron-secret'] ||
      req.query?.secret ||
      req.body?.secret;

    const validSecrets = [
      (process.env.RETENTION_SECRET || '').trim(),
      (process.env.BANK_SMS_SECRET || '').trim(),
      'trimurti_retention_secret_2026',
      'trimurti_bank_secret_2026',
    ].filter(Boolean);

    // If request has admin auth token or matching secret, permit
    const isAuthorized =
      (req.user && req.user.role === 'admin') ||
      (providedSecret && validSecrets.includes(providedSecret.trim()));

    if (!isAuthorized) {
      console.warn('[RETENTION] Unauthorized churn analysis trigger attempt.');
      return res.status(401).json({ error: 'Unauthorized: Invalid retention secret token' });
    }

    const io = req.app.get('io');
    const sendDigest = req.query?.digest !== 'false';

    const result = await retentionService.runChurnAnalysis({
      io,
      sendWhatsAppDigest: sendDigest,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('[RETENTION TRIGGER ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// cron-job.org webhook trigger & Admin manual trigger
router.post('/churn-analysis', authMiddleware.optional, handleChurnAnalysisTrigger);
router.get('/churn-analysis', authMiddleware.optional, handleChurnAnalysisTrigger);

// Admin: Get retention logs & at-risk regular squads
router.get('/logs', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const status = req.query.status || null;
    const logs = await retentionService.getRetentionLogs({ limit, status });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Snooze player outreach
router.post('/logs/:id/snooze', authMiddleware, async (req, res) => {
  try {
    const days = parseInt(req.body.days, 10) || 14;
    const updated = await retentionService.snoozePlayerOutreach(req.params.id, days);
    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Mark outreach as sent
router.post('/logs/:id/mark-sent', authMiddleware, async (req, res) => {
  try {
    const updated = await retentionService.markOutreachSent(req.params.id);
    res.json({ success: true, log: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Dispatch WhatsApp message directly to player via Cloud API
router.post('/logs/:id/dispatch', authMiddleware, async (req, res) => {
  try {
    const result = await retentionService.dispatchOutreachDirectly(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
