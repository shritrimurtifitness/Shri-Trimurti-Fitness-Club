const { rateLimit } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { client } = require('../config/redis');

// Base configuration for Redis store
const getStore = (prefix) => {
  try {
    return new RedisStore({
      // @ts-expect-error - ioredis client is compatible
      sendCommand: (...args) => client.call(...args),
      prefix: `ratelimit:${prefix}:`,
    });
  } catch (err) {
    console.warn(`[RATE-LIMIT] Failed to initialize RedisStore for ${prefix}, falling back to MemoryStore.`);
    return undefined; // express-rate-limit defaults to MemoryStore
  }
};

// Global limiter: 100 requests per minute
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  store: getStore('global'),
});

// Login limiter: 3 attempts per hour
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again after 1 hour.' },
  store: getStore('login'),
  skipSuccessfulRequests: true, // Only count failures towards the limit
});

// Testimonial/Review limiter: 3 reviews per hour
const reviewLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'You have reached the limit for submitting reviews. Please try again after 1 hour.' },
  store: getStore('review'),
});

// Booking limiter: 10 bookings per hour
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many booking attempts. Please try again after an hour.' },
  store: getStore('booking'),
});

// Payment verification limiter: 10 per hour
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment verification attempts.' },
  store: getStore('payment'),
});

// Table session limiter: 20 per hour
const sessionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many session start attempts.' },
  store: getStore('session'),
});

module.exports = {
  globalLimiter,
  loginLimiter,
  reviewLimiter,
  bookingLimiter,
  paymentLimiter,
  sessionLimiter,
};
