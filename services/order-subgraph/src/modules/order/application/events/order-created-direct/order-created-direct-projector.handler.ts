import { EventsHandler, IEventHandler } from '@nestjs/cqrs/dist';

import { OrderCreatedDirectEvent } from '../../../domain/events/order-created-direct.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderCreatedDirectEvent)
export class OrderCreatedDirectProjectorHandler
  implements IEventHandler<OrderCreatedDirectEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderCreatedDirectEvent): Promise<void> {
    await this.projectionRepo.seedDraft({
      orderId: event.orderId,
      buyerId: event.buyerId,
      sellerIds: event.sellerIds,
      items: event.items,
      totalAmount: event.totalAmount,
      currency: event.currency,
      sequence: getEventSequenceOrThrow(event),
    });
  }
}

