import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  listTtlSeconds: Number(process.env.PRODUCT_LIST_CACHE_TTL ?? 300),
  detailTtlSeconds: Number(process.env.PRODUCT_DETAIL_CACHE_TTL ?? 600),
}));
