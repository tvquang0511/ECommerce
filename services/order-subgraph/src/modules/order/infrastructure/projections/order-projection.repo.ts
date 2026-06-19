import { Injectable } from '@nestjs/common';

import {
  Order,
  OrderInventoryStatus,
  OrderPaymentStatus,
  OrderStatus,
} from '../../graphql/order.gql.type';

@Injectable()
export class OrderProjectionRepo {
  private readonly orders: Order[] = [];

  async findVisibleById(orderId: string, actorId: string): Promise<Order | null> {
    return (
      this.orders.find(
        (order) =>
          order.id === orderId &&
          (order.buyerId === actorId || order.sellerIds.includes(actorId)),
      ) ?? null
    );
  }

  async listByBuyerId(buyerId: string): Promise<Order[]> {
    return this.orders.filter((order) => order.buyerId === buyerId);
  }

  markSubmitted(orderId: string): void {
    const order = this.orders.find((entry) => entry.id === orderId);
    if (!order) {
      return;
    }

    order.status = OrderStatus.SUBMITTED;
    order.inventoryStatus = OrderInventoryStatus.PENDING;
    order.paymentStatus = OrderPaymentStatus.PENDING;
    order.version += 1;
    order.updatedAt = new Date().toISOString();
  }

  seedDraft(orderId: string, buyerId: string, currency: string): Order {
    const order: Order = {
      id: orderId,
      buyerId,
      sellerIds: [],
      status: OrderStatus.DRAFT,
      inventoryStatus: OrderInventoryStatus.NOT_REQUESTED,
      paymentStatus: OrderPaymentStatus.NOT_REQUESTED,
      total: { amount: 0, currency },
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
    this.orders.push(order);
    return order;
  }
}
