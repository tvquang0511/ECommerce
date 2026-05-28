import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

import { AuthActor } from '../auth/auth-actor.type';
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

@Injectable()
export class CartService {
  private readonly store = new Map<string, CartEntity>();

  constructor(
    private readonly configService: ConfigService,
    private readonly productCatalogService: ProductCatalogService,
  ) {}

  async getCart(
    actor: AuthActor | null,
    sessionId?: string | null,
  ): Promise<CartEntity | null> {
    const key = this.getKeyForRead(actor, sessionId ?? undefined);
    if (!key) return null;

    return this.store.get(key) ?? null;
  }

  async addToCart(
    actor: AuthActor | null,
    input: { productId: string; quantity: number; sessionId?: string },
  ): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, input.sessionId);

    const cart = this.ensureCart(key, actor, input.sessionId);

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

    this.store.set(key, cart);
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
    const cart = this.ensureCart(key, actor, input.sessionId);

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
    this.store.set(key, cart);

    return cart;
  }

  async removeCartItem(
    actor: AuthActor | null,
    input: { itemId?: string; productId?: string; sessionId?: string },
  ): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, input.sessionId);
    const cart = this.ensureCart(key, actor, input.sessionId);

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
    this.store.set(key, cart);

    return cart;
  }

  async clearCart(actor: AuthActor | null, sessionId?: string): Promise<CartEntity> {
    const key = this.getKeyForWrite(actor, sessionId);
    const cart = this.ensureCart(key, actor, sessionId);

    const now = new Date();
    cart.items = [];
    cart.updatedAt = now;
    cart.totals = this.recalculateTotals(cart);
    this.store.set(key, cart);

    return cart;
  }

  async mergeCart(actor: AuthActor, fromSessionId: string): Promise<CartEntity> {
    const userKey = this.getKeyForWrite(actor, undefined);
    const sessionKey = `session:${fromSessionId}`;

    const userCart = this.ensureCart(userKey, actor, undefined);
    const sessionCart = this.store.get(sessionKey);

    if (!sessionCart) {
      return userCart;
    }

    const now = new Date();

    for (const sessionItem of sessionCart.items) {
      const userItem = userCart.items.find((it) => it.productId === sessionItem.productId);
      if (!userItem) {
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

    this.store.set(userKey, userCart);
    this.store.delete(sessionKey);

    return userCart;
  }

  private ensureCart(
    key: string,
    actor: AuthActor | null,
    sessionId?: string,
  ): CartEntity {
    const existing = this.store.get(key);
    if (existing) return existing;

    const currency =
      this.configService.get<string>('cart.defaultCurrency') ?? 'VND';
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

    this.store.set(key, cart);
    return cart;
  }

  private getKeyForRead(actor: AuthActor | null, sessionId?: string): string | null {
    if (actor?.userId) {
      return `user:${actor.userId}`;
    }

    if (sessionId) {
      return `session:${sessionId}`;
    }

    return null;
  }

  private getKeyForWrite(actor: AuthActor | null, sessionId?: string): string {
    if (actor?.userId) {
      return `user:${actor.userId}`;
    }

    if (!sessionId) {
      throw new BadRequestException('sessionId is required for guest cart');
    }

    return `session:${sessionId}`;
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
