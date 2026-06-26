import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderSubmittedEvent } from '../../../domain/events/order-submitted.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderSubmittedEvent)
export class OrderSubmittedProjectorHandler
  implements IEventHandler<OrderSubmittedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    await this.projectionRepo.markSubmitted(event.orderId, getEventSequenceOrThrow(event));
  }
}


