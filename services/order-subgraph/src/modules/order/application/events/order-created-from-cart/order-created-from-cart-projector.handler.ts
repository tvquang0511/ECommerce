import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderCreatedFromCartEvent } from '../../../domain/events/order-created-from-cart.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';

@EventsHandler(OrderCreatedFromCartEvent)
export class OrderCreatedFromCartProjectorHandler
  implements IEventHandler<OrderCreatedFromCartEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderCreatedFromCartEvent): Promise<void> {
    await this.projectionRepo.seedDraft(event.orderId, event.buyerId, event.currency);
  }
}
