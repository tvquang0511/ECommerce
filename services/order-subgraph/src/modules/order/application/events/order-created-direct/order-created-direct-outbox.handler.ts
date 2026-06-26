import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCreatedDirectEvent } from '../../../domain/events/order-created-direct.event';
import { OrderOutboxRepo } from '../../../infrastructure/outbox/order-outbox.repo';

@EventsHandler(OrderCreatedDirectEvent)
export class OrderCreatedDirectOutboxHandler
  implements IEventHandler<OrderCreatedDirectEvent>
{
  constructor(private readonly outboxRepo: OrderOutboxRepo) {}

  async handle(event: OrderCreatedDirectEvent): Promise<void> {
    await this.outboxRepo.enqueue('order.created-direct', {
      orderId: event.orderId,
      buyerId: event.buyerId,
      items: event.items,
      sellerIds: event.sellerIds,
      totalAmount: event.totalAmount,
      currency: event.currency,
    });
  }
}


