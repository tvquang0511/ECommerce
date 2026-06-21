import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderConfirmedEvent } from '../../../domain/events/order-confirmed.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';

@EventsHandler(OrderConfirmedEvent)
export class OrderConfirmedProjectorHandler
  implements IEventHandler<OrderConfirmedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderConfirmedEvent): Promise<void> {
    await this.projectionRepo.markConfirmed(event.orderId);
  }
}
