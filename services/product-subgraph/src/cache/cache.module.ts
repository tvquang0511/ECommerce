import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { ProductCacheService } from '../modules/products/infrastructure/product-cache.service';

@Module({
  providers: [RedisService, ProductCacheService],
  exports: [RedisService, ProductCacheService],
})
export class CacheModule {}
