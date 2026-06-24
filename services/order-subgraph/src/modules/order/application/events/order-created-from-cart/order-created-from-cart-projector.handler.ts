import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCreatedFromCartEvent } from '../../../domain/events/order-created-from-cart.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderCreatedFromCartEvent)
export class OrderCreatedFromCartProjectorHandler
  implements IEventHandler<OrderCreatedFromCartEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderCreatedFromCartEvent): Promise<void> {
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
