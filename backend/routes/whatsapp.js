const express = require('express');
const router = express.Router();
const whatsappBot = require('../services/whatsappBot');

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

    // 1. Handle delivery status pulses (sent, delivered, read)
    if (value.statuses && value.statuses.length > 0) {
      const statusObj = value.statuses[0];
      const wamid = statusObj.id;
      const status = statusObj.status;
      console.log(`[WHATSAPP STATUS] Message ${wamid} changed to: ${status}`);
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
      }

      console.log(`[WHATSAPP INCOMING] From: ${from} | Text: "${textContent}" | Payload: "${buttonPayload}"`);

      // Hand off to the Bot Engine
      await whatsappBot.handleIncomingMessage({
        from,
        text: textContent,
        buttonPayload,
        messageId,
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
 * Body: { from: "917083738373", text: "cricket slots" }
 */
router.post('/simulate', async (req, res) => {
  try {
    const { from = '917083738373', text = 'hi', buttonPayload = '' } = req.body;
    const result = await whatsappBot.handleIncomingMessage({
      from,
      text,
      buttonPayload,
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

module.exports = router;
