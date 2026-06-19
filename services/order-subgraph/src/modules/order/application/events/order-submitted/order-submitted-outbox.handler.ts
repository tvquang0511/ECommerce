import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderSubmittedEvent } from '../../../domain/events/order-submitted.event';
import { OrderOutboxRepo } from '../../../infrastructure/outbox/order-outbox.repo';

@EventsHandler(OrderSubmittedEvent)
export class OrderSubmittedOutboxHandler
  implements IEventHandler<OrderSubmittedEvent>
{
  constructor(private readonly outboxRepo: OrderOutboxRepo) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    await this.outboxRepo.enqueue('order.submitted', {
      orderId: event.orderId,
    });
  }
}
