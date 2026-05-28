import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // Guest carts should expire to avoid unbounded memory growth
  guestTtlSeconds: Number(process.env.CART_GUEST_TTL_SECONDS ?? 2592000),

  // Common UX limit: 99 distinct items in cart
  maxDistinctItems: Number(process.env.CART_MAX_DISTINCT_ITEMS ?? 99),
}));
