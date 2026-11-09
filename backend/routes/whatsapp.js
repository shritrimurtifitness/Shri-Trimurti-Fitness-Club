const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// Public: Meta Webhook Verification Challenge
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    // Basic verification token validation
    if (mode === 'subscribe' && token === process.env.WHATSAPP_TOKEN) {
      console.log('META_WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Public: Meta Webhook Incoming Stream
router.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (body.object) {
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.statuses) {
        // Handle read-receipts / status updates
        const statusObj = body.entry[0].changes[0].value.statuses[0];
        const wamid = statusObj.id; // Unique Meta Message ID
        const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
        
        // At this specific scale, we don't have wamid saved inherently initially, 
        // but we normally log the webhook pulse for auditing natively:
        console.log(`WhatsApp Status Pulse: ID ${wamid} changed to ${status}`);
      }
      
      if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
        const msg = body.entry[0].changes[0].value.messages[0];
        console.log(`Incoming WhatsApp Message from ${msg.from}: ${msg.text?.body}`);
      }
      
      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (err) {
    console.error("WhatsApp Webhook Error:", err.message);
    res.sendStatus(500);
  }
});

module.exports = router;
