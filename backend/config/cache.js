// ============================================
// CACHE UTILITY - Cache-Aside Pattern
// ============================================
// Reusable get/set/del/delPattern methods with:
// - Graceful fallback (returns null on Redis failure)
// - JSON serialization/deserialization
// - Logging for hits, misses, and invalidations
// - Debug bypass via ?nocache=1 query param
// ============================================

const { client, isConnected } = require('./redis');

const cache = {
  /**
   * Get a cached value by key.
   * Returns parsed JSON or null on miss/error.
   */
  async get(key) {
    if (!isConnected() || !client) return null;
    try {
      const data = await client.get(key);
      if (data) {
        console.log(`[CACHE HIT] ${key}`);
        return JSON.parse(data);
      }
      console.log(`[CACHE MISS] ${key}`);
      return null;
    } catch (err) {
      console.warn(`[CACHE ERROR] get(${key}):`, err.message);
      return null;
    }
  },

  /**
   * Store a value in cache with TTL (in seconds).
   */
  async set(key, data, ttlSeconds = 300) {
    if (!isConnected() || !client) return;
    try {
      await client.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    } catch (err) {
      console.warn(`[CACHE ERROR] set(${key}):`, err.message);
    }
  },

  /**
   * Delete a single cache key.
   */
  async del(key) {
    if (!isConnected() || !client) return;
    try {
      await client.del(key);
      console.log(`[CACHE INVALIDATE] ${key}`);
    } catch (err) {
      console.warn(`[CACHE ERROR] del(${key}):`, err.message);
    }
  },

  /**
   * Delete all keys matching a glob pattern using SCAN (non-blocking).
   * Example: delPattern('slots:*')
   */
  async delPattern(pattern) {
    if (!isConnected() || !client) return;
    try {
      let cursor = '0';
      let deletedCount = 0;
      do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await client.del(...keys);
          deletedCount += keys.length;
        }
      } while (cursor !== '0');
      if (deletedCount > 0) {
        console.log(`[CACHE INVALIDATE] ${pattern} (${deletedCount} keys)`);
      }
    } catch (err) {
      console.warn(`[CACHE ERROR] delPattern(${pattern}):`, err.message);
    }
  },

  /**
   * Completely clear the entire Redis cache.
   */
  async flush() {
    if (!isConnected() || !client) return;
    try {
      await client.flushall();
      console.log(`[CACHE FLUSH] Entire cache invalidated.`);
    } catch (err) {
      console.warn(`[CACHE ERROR] flush():`, err.message);
    }
  },

  /**
   * Check if cache should be bypassed (via ?nocache=1 query param).
   */
  shouldBypass(req) {
    return req.query.nocache === '1';
  },
};

module.exports = cache;
