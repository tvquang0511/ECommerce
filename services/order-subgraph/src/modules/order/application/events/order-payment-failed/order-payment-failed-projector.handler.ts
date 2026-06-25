import { EventsHandler, IEventHandler } from '@nestjs/cqrs/dist';

import { OrderPaymentFailedEvent } from '../../../domain/events/order-payment-failed.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderPaymentFailedEvent)
export class OrderPaymentFailedProjectorHandler
  implements IEventHandler<OrderPaymentFailedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderPaymentFailedEvent): Promise<void> {
    await this.projectionRepo.markPaymentFailed(event.orderId, getEventSequenceOrThrow(event));
  }
}

