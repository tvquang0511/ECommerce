import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from '../auth/auth.module';
import { RedisModule } from '../redis/redis.module';
import { CartResolver, CartItemResolver } from './cart.resolver';
import { CartService } from './cart.service';
import { ProductCatalogService } from './product-catalog.service';

@Module({
  imports: [ConfigModule, AuthModule, RedisModule],
  providers: [CartService, ProductCatalogService, CartResolver, CartItemResolver],
})
export class CartModule {}
