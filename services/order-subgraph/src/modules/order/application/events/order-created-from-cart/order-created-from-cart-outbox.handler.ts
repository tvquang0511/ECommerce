import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCreatedFromCartEvent } from '../../../domain/events/order-created-from-cart.event';
import { OrderOutboxRepo } from '../../../infrastructure/outbox/order-outbox.repo';

@EventsHandler(OrderCreatedFromCartEvent)
export class OrderCreatedFromCartOutboxHandler
  implements IEventHandler<OrderCreatedFromCartEvent>
{
  constructor(private readonly outboxRepo: OrderOutboxRepo) {}

  async handle(event: OrderCreatedFromCartEvent): Promise<void> {
    await this.outboxRepo.enqueue('order.created-from-cart', {
      orderId: event.orderId,
      buyerId: event.buyerId,
      currency: event.currency,
    });
  }
}
