import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderRepricedEvent } from '../../../domain/events/order-repriced.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderRepricedEvent)
export class OrderRepricedProjectorHandler
  implements IEventHandler<OrderRepricedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderRepricedEvent): Promise<void> {
    await this.projectionRepo.repriceDraft(
      event.orderId,
      getEventSequenceOrThrow(event),
      {
        sellerIds: event.sellerIds,
        items: event.items,
        totalAmount: event.totalAmount,
        currency: event.currency,
      },
    );
  }
}
