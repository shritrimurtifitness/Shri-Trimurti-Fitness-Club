const express = require('express');
const router = express.Router();
const whatsappBot = require('../services/whatsappBot');
const whatsappService = require('../services/whatsapp');
const pool = require('../config/db');

// Cache to prevent duplicate processing of the same message
const processedMessages = new Set();

/**
 * Public: Meta Webhook Verification Handshake
 * Meta sends GET /api/whatsapp/webhook when registering the webhook in developer dashboard.
 */
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken =
    process.env.WHATSAPP_VERIFY_TOKEN ||
    process.env.WHATSAPP_TOKEN ||
    'trimurti_arena_secret_2026';

  if (mode && token) {
    if (mode === 'subscribe' && token === expectedToken) {
      console.log('[WHATSAPP WEBHOOK] Handshake verified successfully with Meta!');
      return res.status(200).send(challenge);
    }
    console.warn('[WHATSAPP WEBHOOK] Verification token mismatch. Received:', token);
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
});

/**
 * Public: Meta Webhook Incoming Message Stream
 * Meta sends POST /api/whatsapp/webhook whenever a customer sends a message or status changes.
 */
router.post('/webhook', async (req, res) => {
  // Always acknowledge immediately with 200 OK so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  try {
    const body = req.body;
    if (!body || body.object !== 'whatsapp_business_account') {
      return;
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value) return;

    // 1. Handle delivery status pulses (sent, delivered, read, failed)
    if (value.statuses && value.statuses.length > 0) {
      const statusObj = value.statuses[0];
      const wamid = statusObj.id;
      const status = statusObj.status;
      const errorDetails = statusObj.errors ? ` | Error: ${JSON.stringify(statusObj.errors)}` : '';
      console.log(`[WHATSAPP STATUS] Message ${wamid} changed to: ${status}${errorDetails}`);
      return;
    }

    // 2. Handle incoming customer messages
    if (value.messages && value.messages.length > 0) {
      const msg = value.messages[0];
      const messageId = msg.id;

      // Prevent duplicate processing
      if (processedMessages.has(messageId)) {
        return;
      }
      processedMessages.add(messageId);
      // Clean memory after 10 minutes
      setTimeout(() => processedMessages.delete(messageId), 10 * 60 * 1000);

      const from = msg.from; // Phone number of customer
      const type = msg.type; // 'text', 'interactive', 'button', etc.
      const contact = value.contacts?.[0];
      const userName = contact?.profile?.name || '';

      let textContent = '';
      let buttonPayload = '';

      if (type === 'text') {
        textContent = msg.text?.body || '';
      } else if (type === 'interactive') {
        const interactive = msg.interactive;
        if (interactive?.type === 'button_reply') {
          buttonPayload = interactive.button_reply?.id || '';
          textContent = interactive.button_reply?.title || '';
        } else if (interactive?.type === 'list_reply') {
          buttonPayload = interactive.list_reply?.id || '';
          textContent = interactive.list_reply?.title || '';
        }
      } else if (type === 'button') {
        buttonPayload = msg.button?.payload || '';
        textContent = msg.button?.text || '';
      } else if (type === 'image') {
        textContent = msg.image?.caption || 'PAYMENT_SCREENSHOT_UPLOADED';
      }

      console.log(`[WHATSAPP INCOMING] From: ${from} (${userName}) | Text: "${textContent}" | Payload: "${buttonPayload}"`);

      // Hand off to the Bot Engine
      await whatsappBot.handleIncomingMessage({
        from,
        text: textContent,
        buttonPayload,
        messageId,
        userName,
        io: req.app.get('io'),
      });
    }
  } catch (err) {
    console.error('[WHATSAPP WEBHOOK ERROR]', err.message);
  }
});

/**
 * Development & Testing Helper Route
 * Allows simulating an incoming WhatsApp message without needing Meta API keys.
 * POST /api/whatsapp/simulate
 * Body: { from: "919595153006", text: "cricket slots" }
 */
router.post('/simulate', async (req, res) => {
  try {
    const { from = '919595153006', text = 'hi', buttonPayload = '', userName = 'Test Player' } = req.body;
    const result = await whatsappBot.handleIncomingMessage({
      from,
      text,
      buttonPayload,
      userName,
      io: req.app.get('io'),
    });
    res.json({
      success: true,
      simulatedFor: from,
      input: { text, buttonPayload },
      botResult: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Missed Call Webhook Trigger
 * Called by Android phone (MacroDroid) or cloud telephony whenever an incoming call is missed.
 * POST /api/whatsapp/missed-call
 * Accepts:
 *   - Header: 'x-missedcall-secret' or 'x-webhook-secret'
 *   - Query: ?secret=...
 *   - Body: { phone: "9876543210", secret?: "..." }
 */
router.post('/missed-call', async (req, res) => {
  try {
    const providedSecret =
      req.headers['x-missedcall-secret'] ||
      req.headers['x-webhook-secret'] ||
      req.query.secret ||
      req.body.secret;

    const validSecrets = [
      (process.env.MISSED_CALL_SECRET || '').trim(),
      (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
      'trimurti_missed_call_2026',
      'trimurti_arena_secret_2026',
    ].filter(Boolean);

    if (!providedSecret || !validSecrets.includes(providedSecret.trim())) {
      console.warn('[MISSED CALL] Unauthorized attempt. Received secret:', providedSecret);
      return res.status(401).json({ error: 'Unauthorized: Invalid secret token' });
    }

    const phone = req.body.phone || req.body.from || req.query.phone;
    if (!phone) {
      return res.status(400).json({ error: 'Missing phone number in request' });
    }

    console.log(`[MISSED CALL WEBHOOK] Triggered for caller: ${phone}`);

    const result = await whatsappService.sendMissedCallNotification({
      phone,
      template_name: process.env.WHATSAPP_MISSED_CALL_TEMPLATE || 'trimurti_missed_call',
    });

    // Notify active Admin web dashboard via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.emit('missed_call', {
        phone: result.phone || phone,
        status: result.status || (result.success ? 'sent' : 'failed'),
        cooldown: !!result.cooldown,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json({
      success: true,
      lead: result,
    });
  } catch (err) {
    console.error('[MISSED CALL ROUTE ERROR]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get Recent Missed Call Leads
 * GET /api/whatsapp/missed-calls
 */
router.get('/missed-calls', async (req, res) => {
  try {
    const providedSecret =
      req.headers['x-missedcall-secret'] ||
      req.headers['x-webhook-secret'] ||
      req.query.secret;

    const validSecrets = [
      (process.env.MISSED_CALL_SECRET || '').trim(),
      (process.env.WHATSAPP_VERIFY_TOKEN || '').trim(),
      'trimurti_missed_call_2026',
      'trimurti_arena_secret_2026',
    ].filter(Boolean);

    const authHeader = req.headers['authorization'];

    // Require either secret token or admin bearer token
    if (!authHeader && (!providedSecret || !validSecrets.includes(providedSecret.trim()))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(`
      SELECT id, phone, status, template_name, response, created_at 
      FROM missed_calls 
      ORDER BY created_at DESC 
      LIMIT 100
    `);

    res.json({ success: true, count: result.rows.length, missed_calls: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
