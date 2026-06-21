import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCreatedDirectEvent } from '../../../domain/events/order-created-direct.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';

@EventsHandler(OrderCreatedDirectEvent)
export class OrderCreatedDirectProjectorHandler
  implements IEventHandler<OrderCreatedDirectEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderCreatedDirectEvent): Promise<void> {
    await this.projectionRepo.seedDraft(event.orderId, event.buyerId, event.currency);
  }
}
