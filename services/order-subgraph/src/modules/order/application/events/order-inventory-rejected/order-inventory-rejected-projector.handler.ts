import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderInventoryRejectedEvent } from '../../../domain/events/order-inventory-rejected.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';

@EventsHandler(OrderInventoryRejectedEvent)
export class OrderInventoryRejectedProjectorHandler
  implements IEventHandler<OrderInventoryRejectedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderInventoryRejectedEvent): Promise<void> {
    await this.projectionRepo.markInventoryRejected(event.orderId);
  }
}
