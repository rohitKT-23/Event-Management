import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

/**
 * We keep two distinct Redis clients:
 *  - `redis`       — general purpose (sessions, rate-limit, caches).
 *  - `redisQueue`  — exclusively for BullMQ (needs maxRetriesPerRequest=null
 *                    and enableReadyCheck=false per BullMQ docs).
 */

const baseOptions = {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

export const redis = new Redis(env.REDIS_URL, baseOptions);

redis.on('error', (err) => logger.error({ err }, 'redis error'));
redis.on('connect', () => logger.info('redis connected'));

export const redisQueue = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});
redisQueue.on('error', (err) => logger.error({ err }, 'redis queue error'));
