import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // Common UX limit: 99 distinct items in cart
  maxDistinctItems: Number(process.env.CART_MAX_DISTINCT_ITEMS ?? 99),
}));
