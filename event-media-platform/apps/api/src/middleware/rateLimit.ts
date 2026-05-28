import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';

const store = new RedisStore({
  sendCommand: (...args: string[]) => redis.call(args[0]!, ...args.slice(1)) as Promise<any>,
  prefix: 'rl:',
});

export const generalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store,
  message: { status: 429, code: 'RATE_LIMIT', message: 'Too many requests, slow down.' },
});

// Tighter limiter for auth routes (brute-force protection).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store,
  skipSuccessfulRequests: true,
  message: { status: 429, code: 'RATE_LIMIT', message: 'Too many auth attempts, try again later.' },
});
