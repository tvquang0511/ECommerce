import type { RequestHandler } from 'express';
import { ApiError } from '@repo/common/errors';

import { redis } from '../../db/redis.js';

type RateLimitRule = {
  name: string;
  limit: number;
  windowSeconds: number;
  // Return one or more identifiers (e.g., ["ip:...", "email:..."]).
  identifiers: (req: Parameters<RequestHandler>[0]) => Array<string>;
};

const INCR_EXPIRE_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

let redisWarned = false;

export function rateLimit(rule: RateLimitRule): RequestHandler {
  return async (req, _res, next) => {
    try {
      const ids = rule.identifiers(req);
      if (!ids.length) return next();

      const nowWindow = Math.floor(Date.now() / (rule.windowSeconds * 1000));

      // Fail if any identifier exceeds its limit.
      for (const id of ids) {
        const key = `rl:${rule.name}:${id}:${nowWindow}`;
        const count = (await redis.eval(INCR_EXPIRE_LUA, 1, key, String(rule.windowSeconds))) as number;
        if (count > rule.limit) {
          throw new ApiError(429, 'RATE_LIMITED', 'Too many requests', {
            rule: rule.name,
            limit: rule.limit,
            windowSeconds: rule.windowSeconds,
          });
        }
      }

      return next();
    } catch (err: any) {
      // If Redis is unavailable, fail open (auth should still work).
      if (isRedisConnectionError(err)) {
        if (!redisWarned) {
          redisWarned = true;
          // eslint-disable-next-line no-console
          console.warn('[rateLimit] Redis unavailable; failing open', err?.message ?? err);
        }
        return next();
      }

      return next(err);
    }
  };
}

function isRedisConnectionError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const anyErr = err as any;
  const message = String(anyErr.message ?? '');
  return (
    anyErr.code === 'ECONNREFUSED' ||
    anyErr.code === 'ETIMEDOUT' ||
    anyErr.code === 'NR_CLOSED' ||
    message.toLowerCase().includes('connect') ||
    message.toLowerCase().includes('connection')
  );
}
