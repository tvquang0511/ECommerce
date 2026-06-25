import { EventsHandler, IEventHandler } from '@nestjs/cqrs/dist';

import { OrderPaymentAuthorizedEvent } from '../../../domain/events/order-payment-authorized.event';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { getEventSequenceOrThrow } from '../projector-sequence.util';

@EventsHandler(OrderPaymentAuthorizedEvent)
export class OrderPaymentAuthorizedProjectorHandler
  implements IEventHandler<OrderPaymentAuthorizedEvent>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async handle(event: OrderPaymentAuthorizedEvent): Promise<void> {
    await this.projectionRepo.markPaymentAuthorized(
      event.orderId,
      getEventSequenceOrThrow(event),
    );
  }
}

