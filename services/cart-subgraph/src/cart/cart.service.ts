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
  userId?: string;
  sessionId?: string;
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
    actor: AuthActor | null,
    sessionId?: string | null,
  ): Promise<CartEntity | null> {
    const key = this.getKeyForRead(actor, sessionId ?? undefined);
    if (!key) return null;

    const raw = await this.redisService.getJson<CartSerialized>(key);
    if (!raw) return null;
    return this.deserializeCart(raw);
  }

  async addToCart(
    actor: AuthActor | null,
    input: { productId: string; quantity: number; sessionId?: string },
  ): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, input.sessionId);

    const cart = await this.getOrCreateCart(key, actor, input.sessionId);

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
    actor: AuthActor | null,
    input: {
      itemId?: string;
      productId?: string;
      quantity: number;
      sessionId?: string;
    },
  ): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, input.sessionId);
    const cart = await this.getOrCreateCart(key, actor, input.sessionId);

    if (!input.itemId && !input.productId) {
      throw new BadRequestException('itemId or productId is required');
    }

    if (input.quantity === 0) {
      return this.removeCartItem(actor, {
        itemId: input.itemId,
        productId: input.productId,
        sessionId: input.sessionId,
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
    actor: AuthActor | null,
    input: { itemId?: string; productId?: string; sessionId?: string },
  ): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, input.sessionId);
    const cart = await this.getOrCreateCart(key, actor, input.sessionId);

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

  async clearCart(actor: AuthActor | null, sessionId?: string): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, sessionId);
    const cart = await this.getOrCreateCart(key, actor, sessionId);

    const now = new Date();
    cart.items = [];
    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);
    await this.saveCart(key, cart, actor);

    return cart;
  }

  async mergeCart(actor: AuthActor, fromSessionId: string): Promise<CartEntity> {
    const userKey = this.getKeyForWrite(actor, undefined);

    const sessionKey = this.getSessionKey(fromSessionId);

    const userCart = await this.getOrCreateCart(userKey, actor, undefined);
    const sessionCartRaw = await this.redisService.getJson<CartSerialized>(sessionKey);
    const sessionCart = sessionCartRaw ? this.deserializeCart(sessionCartRaw) : null;

    if (!sessionCart) {
      return userCart;
    }

    const now = new Date();

    for (const sessionItem of sessionCart.items) {
      const userItem = userCart.items.find((it) => it.productId === sessionItem.productId);
      if (!userItem) {
        const maxDistinctItems = this.redisService.maxDistinctItems;
        if (userCart.items.length >= maxDistinctItems) {
          // policy: keep user cart, skip extra session items
          continue;
        }

        userCart.items.push({ ...sessionItem });
        continue;
      }

      // policy: sum quantity, keep the newest snapshot
      const newest = userItem.updatedAt >= sessionItem.updatedAt ? userItem : sessionItem;
      userItem.quantity = userItem.quantity + sessionItem.quantity;
      userItem.unitPrice = newest.unitPrice;
      userItem.titleSnapshot = newest.titleSnapshot;
      userItem.imageSnapshot = newest.imageSnapshot;
      userItem.updatedAt = newest.updatedAt;
    }

    userCart.updatedAt = now;
    userCart.totals = this.recalculateTotals(userCart);

    await this.saveCart(userKey, userCart, actor);
    await this.redisService.del([sessionKey]);

    return userCart;
  }

  private getKeyForRead(actor: AuthActor | null, sessionId?: string): string | null {
    if (actor?.userId) {
      return this.getUserKey(actor.userId);
    }

    if (sessionId) {
      return this.getSessionKey(sessionId);
    }

    return null;
  }

  private getKeyForWrite(actor: AuthActor | null, sessionId?: string): string {
    if (actor?.userId) {
      return this.getUserKey(actor.userId);
    }

    if (!sessionId) {
      throw new BadRequestException('sessionId is required for guest cart');
    }

    return this.getSessionKey(sessionId);
  }

  private getUserKey(userId: string): string {
    return `cart:user:${userId}`;
  }

  private getSessionKey(sessionId: string): string {
    return `cart:session:${sessionId}`;
  }

  private async getOrCreateCart(
    key: string,
    actor: AuthActor | null,
    sessionId?: string,
  ): Promise<CartEntity> {
    const existingRaw = await this.redisService.getJson<CartSerialized>(key);
    if (existingRaw) {
      return this.deserializeCart(existingRaw);
    }

    const currency = this.configService.get<string>('cart.defaultCurrency') ?? 'VND';
    const now = new Date();

    const cart: CartEntity = {
      id: `c_${randomUUID()}`,
      userId: actor?.userId,
      sessionId: actor?.userId ? undefined : sessionId,
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

  private async saveCart(key: string, cart: CartEntity, actor: AuthActor | null): Promise<void> {
    const payload = this.serializeCart(cart);

    if (!actor?.userId) {
      await this.redisService.setJson(key, payload, this.redisService.guestTtlSeconds);
      return;
    }

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
