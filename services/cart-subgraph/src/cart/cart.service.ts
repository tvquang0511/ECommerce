import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { AuthActor } from '../auth/auth-actor.type';
import { RedisService } from '../redis/redis.service';
import { ProductCatalogService } from './product-catalog.service';

export type CartItemEntity = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: { amount: number; currency: string };
  titleSnapshot: string;
  imageSnapshot?: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CartEntity = {
  id: string;
  userId: string;
  items: CartItemEntity[];
  totals: {
    subtotal: { amount: number; currency: string };
    discount: { amount: number; currency: string };
    tax: { amount: number; currency: string };
    total: { amount: number; currency: string };
  };
  currency: string;
  updatedAt: Date;
};

type CartItemSerialized = Omit<CartItemEntity, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type CartSerialized = Omit<CartEntity, 'updatedAt' | 'items'> & {
  updatedAt: string;
  items: CartItemSerialized[];
};

@Injectable()
export class CartService {
  constructor(
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    private readonly productCatalogService: ProductCatalogService,
  ) {}

  async getCart(
    actor: AuthActor,
  ): Promise<CartEntity | null> {
    const key = this.getUserKey(actor.userId);
    const raw = await this.redisService.getJson<CartSerialized>(key);
    if (!raw) return null;
    return this.deserializeCart(raw);
  }

  async addToCart(
    actor: AuthActor,
    input: { productId: string; quantity: number },
  ): Promise<CartEntity> {
    const key = this.getUserKey(actor.userId);
    const cart = await this.getOrCreateCart(key, actor);

    const snapshot = await this.productCatalogService.getApprovedProductSnapshot(
      input.productId,
    );

    const now = new Date();

    const existing = cart.items.find((it) => it.productId === input.productId);
    if (existing) {
      existing.quantity += input.quantity;
      existing.updatedAt = now;
      // refresh snapshots (keeps it close to product state on add)
      existing.unitPrice = { amount: snapshot.unitPriceAmount, currency: snapshot.currency };
      existing.titleSnapshot = snapshot.titleSnapshot;
      existing.imageSnapshot = snapshot.imageSnapshot ?? undefined;
    } else {
      const maxDistinctItems = this.redisService.maxDistinctItems;
      if (cart.items.length >= maxDistinctItems) {
        throw new BadRequestException(
          `Cart reached the maximum number of items (${maxDistinctItems})`,
        );
      }

      cart.items.push({
        id: `ci_${randomUUID()}`,
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: { amount: snapshot.unitPriceAmount, currency: snapshot.currency },
        titleSnapshot: snapshot.titleSnapshot,
        imageSnapshot: snapshot.imageSnapshot ?? undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    cart.currency = snapshot.currency || cart.currency;
    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);

    await this.saveCart(key, cart, actor);
    return cart;
  }

  async updateCartItem(
    actor: AuthActor,
    input: {
      itemId?: string;
      productId?: string;
      quantity: number;
    },
  ): Promise<CartEntity> {
    const key = this.getUserKey(actor.userId);
    const cart = await this.getOrCreateCart(key, actor);

    if (!input.itemId && !input.productId) {
      throw new BadRequestException('itemId or productId is required');
    }

    if (input.quantity === 0) {
      return this.removeCartItem(actor, {
        itemId: input.itemId,
        productId: input.productId,
      });
    }

    const item = cart.items.find(
      (it) => (input.itemId && it.id === input.itemId) || (input.productId && it.productId === input.productId),
    );
    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    const now = new Date();
    item.quantity = input.quantity;
    item.updatedAt = now;

    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);
    await this.saveCart(key, cart, actor);

    return cart;
  }

  async removeCartItem(
    actor: AuthActor,
    input: { itemId?: string; productId?: string },
  ): Promise<CartEntity> {
    const key = this.getUserKey(actor.userId);
    const cart = await this.getOrCreateCart(key, actor);

    if (!input.itemId && !input.productId) {
      throw new BadRequestException('itemId or productId is required');
    }

    const before = cart.items.length;
    cart.items = cart.items.filter(
      (it) => (input.itemId ? it.id !== input.itemId : true) && (input.productId ? it.productId !== input.productId : true),
    );

    if (cart.items.length === before) {
      throw new NotFoundException('Cart item not found');
    }

    const now = new Date();
    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);
    await this.saveCart(key, cart, actor);

    return cart;
  }

  async clearCart(actor: AuthActor): Promise<CartEntity> {
    const key = this.getUserKey(actor.userId);
    const cart = await this.getOrCreateCart(key, actor);

    const now = new Date();
    cart.items = [];
    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);
    await this.saveCart(key, cart, actor);

    return cart;
  }

  private getUserKey(userId: string): string {
    return `cart:user:${userId}`;
  }

  private async getOrCreateCart(
    key: string,
    actor: AuthActor,
  ): Promise<CartEntity> {
    const existingRaw = await this.redisService.getJson<CartSerialized>(key);
    if (existingRaw) {
      return this.deserializeCart(existingRaw);
    }

    const currency = this.configService.get<string>('cart.defaultCurrency') ?? 'VND';
    const now = new Date();

    const cart: CartEntity = {
      id: `c_${randomUUID()}`,
      userId: actor.userId,
      items: [],
      currency,
      totals: {
        subtotal: { amount: 0, currency },
        discount: { amount: 0, currency },
        tax: { amount: 0, currency },
        total: { amount: 0, currency },
      },
      updatedAt: now,
    };

    await this.saveCart(key, cart, actor);
    return cart;
  }

  private async saveCart(key: string, cart: CartEntity, _actor: AuthActor): Promise<void> {
    const payload = this.serializeCart(cart);
    await this.redisService.setJson(key, payload);
  }

  private serializeCart(cart: CartEntity): CartSerialized {
    return {
      ...cart,
      updatedAt: cart.updatedAt.toISOString(),
      items: cart.items.map((it) => ({
        ...it,
        createdAt: it.createdAt.toISOString(),
        updatedAt: it.updatedAt.toISOString(),
      })),
    };
  }

  private deserializeCart(raw: CartSerialized): CartEntity {
    return {
      ...raw,
      updatedAt: new Date(raw.updatedAt),
      items: raw.items.map((it) => ({
        ...it,
        createdAt: new Date(it.createdAt),
        updatedAt: new Date(it.updatedAt),
      })),
    };
  }

  private recalculateTotals(cart: CartEntity): CartEntity['totals'] {
    const currency = cart.currency;
    const subtotalAmount = cart.items.reduce(
      (sum, it) => sum + it.unitPrice.amount * it.quantity,
      0,
    );

    const zero = { amount: 0, currency };
    const subtotal = { amount: subtotalAmount, currency };

    return {
      subtotal,
      discount: { ...zero },
      tax: { ...zero },
      total: { amount: subtotalAmount, currency },
    };
  }
}
