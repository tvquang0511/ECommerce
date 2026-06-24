import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderInventoryReservedEvent } from '../../../domain/events/order-inventory-reserved.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderInventoryReservedEvent)
export class OrderInventoryReservedProjectorHandler
  implements IEventHandler<OrderInventoryReservedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderInventoryReservedEvent): Promise<void> {
    await this.projectionRepo.markInventoryReserved(
      event.orderId,
      getEventSequenceOrThrow(event),
    );
  }
}
