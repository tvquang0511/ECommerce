import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCancelledEvent } from '../../../domain/events/order-cancelled.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderCancelledEvent)
export class OrderCancelledProjectorHandler
  implements IEventHandler<OrderCancelledEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderCancelledEvent): Promise<void> {
    await this.projectionRepo.markCancelled(event.orderId, getEventSequenceOrThrow(event));
  }
}
