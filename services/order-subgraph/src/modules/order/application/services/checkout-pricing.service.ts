import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { CartReaderService } from '../../infrastructure/integrations/cart-reader.service';
import { ProductReaderService } from '../../infrastructure/integrations/product-reader.service';
import { OrderItemSnapshot } from '../../domain/value-objects/order-item.vo';

export interface OrderPricingPreview {
  items: OrderItemSnapshot[];
  sellerIds: string[];
  totalAmount: number;
  currency: string;
  cartId?: string;
}

@Injectable()
export class CheckoutPricingService {
  constructor(
    private readonly cartReader: CartReaderService,
    private readonly productReader: ProductReaderService,
  ) {}

  async previewFromCart(
    buyerId: string,
    accessToken?: string,
    cartId?: string,
  ): Promise<OrderPricingPreview> {
    const cart = await this.cartReader.readBuyerCart(buyerId, accessToken, cartId);
    const productSnapshots = await this.productReader.revalidateProducts(
      cart.items.map((item) => item.productId),
    );

    const snapshotByProductId = new Map(
      productSnapshots.map((snapshot) => [snapshot.productId, snapshot]),
    );

    const items = cart.items.map((cartItem) => {
      const productSnapshot = snapshotByProductId.get(cartItem.productId);
      if (!productSnapshot) {
        throw new Error(`Missing product snapshot for ${cartItem.productId}`);
      }

      return {
        lineId: `line_${randomUUID()}`,
        productId: productSnapshot.productId,
        sellerId: productSnapshot.sellerId,
        titleSnapshot: productSnapshot.titleSnapshot,
        imageSnapshot: productSnapshot.imageSnapshot ?? null,
        quantity: cartItem.quantity,
        unitPriceAmount: productSnapshot.unitPriceAmount,
        currency: productSnapshot.currency,
      } satisfies OrderItemSnapshot;
    });

    return {
      items,
      sellerIds: [...new Set(items.map((item) => item.sellerId))],
      totalAmount: items.reduce(
        (sum, item) => sum + item.unitPriceAmount * item.quantity,
        0,
      ),
      currency: this.resolveCurrency(items.map((item) => item.currency)),
      cartId: cart.cartId,
    };
  }

  async previewDirect(
    productId: string,
    quantity: number,
  ): Promise<OrderPricingPreview> {
    const productSnapshot = await this.productReader.previewDirectOrder(productId, quantity);
    const items: OrderItemSnapshot[] = [
      {
        lineId: `line_${randomUUID()}`,
        productId: productSnapshot.productId,
        sellerId: productSnapshot.sellerId,
        titleSnapshot: productSnapshot.titleSnapshot,
        imageSnapshot: productSnapshot.imageSnapshot ?? null,
        quantity: productSnapshot.quantity,
        unitPriceAmount: productSnapshot.unitPriceAmount,
        currency: productSnapshot.currency,
      },
    ];

    return {
      items,
      sellerIds: [productSnapshot.sellerId],
      totalAmount: productSnapshot.unitPriceAmount * productSnapshot.quantity,
      currency: productSnapshot.currency,
    };
  }

  private resolveCurrency(currencies: string[]): string {
    const normalized = [...new Set(currencies.filter(Boolean))];
    if (normalized.length === 0) {
      return 'VND';
    }

    if (normalized.length > 1) {
      throw new Error(`Mixed currencies are not supported yet: ${normalized.join(', ')}`);
    }

    return normalized[0];
  }
}
