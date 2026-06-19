import { Injectable } from '@nestjs/common';

import { Order, OrderStatus } from '../../graphql/order.gql.type';

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

  seedDraft(orderId: string, buyerId: string, currency: string): Order {
    const order: Order = {
      id: orderId,
      buyerId,
      sellerIds: [],
      status: OrderStatus.DRAFT,
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
