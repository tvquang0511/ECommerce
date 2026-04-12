import { Redis } from 'ioredis';

import { env } from '../env.js';

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createRedisClient() {
  // Keep rate limiting best-effort: if Redis is down, handlers can choose to fail-open.
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}
