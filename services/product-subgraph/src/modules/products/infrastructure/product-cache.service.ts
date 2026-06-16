import { Injectable } from '@nestjs/common';
import { RedisService } from '../../../cache/redis.service';
import { Product } from '../domain/product.domain.type';
import { AuthActor } from '../../auth/auth.types';

@Injectable()
export class ProductCacheService {
  constructor(private readonly redis: RedisService) {}

  async getList(actor: AuthActor | null): Promise<Product[] | null> {
    const key = this.listKey(actor);
    if (!key) return null;
    return this.redis.getJson<Product[]>(key);
  }

  async setList(actor: AuthActor | null, data: Product[]): Promise<void> {
    const key = this.listKey(actor);
    if (!key) return;
    await this.redis.setJson(key, data, this.redis.listTtlSeconds);
  }

  async getDetail(actor: AuthActor | null, id: string): Promise<Product | null> {
    const key = this.detailKey(actor, id);
    if (!key) return null;
    return this.redis.getJson<Product>(key);
  }

  async setDetail(
    actor: AuthActor | null,
    id: string,
    data: Product,
  ): Promise<void> {
    const key = this.detailKey(actor, id);
    if (!key) return;
    await this.redis.setJson(key, data, this.redis.detailTtlSeconds);
  }

  async invalidateProduct(id: string, sellerId: string): Promise<void> {
    const keys = [
      this.listKey(null),
      this.listKey({ userId: sellerId, roles: ['SELLER'] } as AuthActor),
      this.detailKey(null, id),
      this.detailKey({ userId: sellerId, roles: ['SELLER'] } as AuthActor, id),
    ].filter((key): key is string => Boolean(key));

    await this.redis.del(keys);
  }

  private listKey(actor: AuthActor | null): string | null {
    if (!actor) return 'product:list:public';
    if (actor.roles.some((role) => role.startsWith('ADMIN_') || role === 'SUPER_ADMIN')) {
      return null;
    }
    if (actor.roles.includes('SELLER')) {
      return `product:list:seller:${actor.userId}`;
    }
    return 'product:list:public';
  }

  private detailKey(actor: AuthActor | null, id: string): string | null {
    if (!actor) return `product:detail:public:${id}`;
    if (actor.roles.some((role) => role.startsWith('ADMIN_') || role === 'SUPER_ADMIN')) {
      return null;
    }
    if (actor.roles.includes('SELLER')) {
      return `product:detail:seller:${actor.userId}:${id}`;
    }
    return `product:detail:public:${id}`;
  }
}
