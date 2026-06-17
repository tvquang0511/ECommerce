import { randomUUID } from 'node:crypto';

import { OrderCreatedEvent } from '../events/order-created.event';

export class OrderAggregate {
  public readonly id: string;
  public readonly buyerId: string;
  public readonly currency: string;
  public readonly uncommittedEvents: OrderCreatedEvent[];

  private constructor(params: {
    id: string;
    buyerId: string;
    currency: string;
    uncommittedEvents: OrderCreatedEvent[];
  }) {
    this.id = params.id;
    this.buyerId = params.buyerId;
    this.currency = params.currency;
    this.uncommittedEvents = params.uncommittedEvents;
  }

  static createDraft(params: { buyerId: string; currency: string }): OrderAggregate {
    const event = new OrderCreatedEvent(
      `ord_${randomUUID()}`,
      params.buyerId,
      params.currency,
    );

    return new OrderAggregate({
      id: event.orderId,
      buyerId: event.buyerId,
      currency: event.currency,
      uncommittedEvents: [event],
    });
  }
}
