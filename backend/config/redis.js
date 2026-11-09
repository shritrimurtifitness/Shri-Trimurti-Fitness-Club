// ============================================
// REDIS CLIENT - Graceful Connection with Fallback
// ============================================
// Uses REDIS_URL from .env (default: redis://localhost:6379)
// If Redis is unavailable, the app continues using DB directly.
// Swap to Upstash later by changing REDIS_URL to your Upstash endpoint.
// ============================================

const Redis = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let client = null;
let isReady = false;

try {
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 3) {
        console.warn('[REDIS] Max retries reached. Falling back to DB.');
        return null; // Stop retrying
      }
      return Math.min(times * 500, 3000);
    },
    lazyConnect: false,
    // Enable offline queue so commands queue until connection is ready.
    // This prevents startup crashes if Redis is briefly unavailable.
    enableOfflineQueue: true,
  });

  client.on('connect', () => {
    console.log('[REDIS] Connected to', REDIS_URL.replace(/\/\/.*@/, '//***@'));
    isReady = true;
  });

  client.on('ready', () => {
    isReady = true;
  });

  client.on('error', (err) => {
    // Only log once when transitioning from ready to not-ready
    if (isReady) {
      console.warn('[REDIS] Connection lost:', err.message);
    }
    isReady = false;
  });

  client.on('close', () => {
    isReady = false;
  });

  client.on('end', () => {
    isReady = false;
  });
} catch (err) {
  console.warn('[REDIS] Failed to initialize client:', err.message);
}

module.exports = { client, isConnected: () => isReady };
