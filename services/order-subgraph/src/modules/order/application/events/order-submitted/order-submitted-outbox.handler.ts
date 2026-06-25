import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderSubmittedEvent } from '../../../domain/events/order-submitted.event';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { OrderOutboxRepo } from '../../../infrastructure/outbox/order-outbox.repo';
import {
  OrderOutboxHeaders,
  OrderSubmittedOutboxPayload,
} from '../../../infrastructure/outbox/order-outbox-message.type';

@EventsHandler(OrderSubmittedEvent)
export class OrderSubmittedOutboxHandler
  implements IEventHandler<OrderSubmittedEvent>
{
  constructor(
    private readonly outboxRepo: OrderOutboxRepo,
    private readonly eventStoreRepo: OrderEventStoreRepo,
  ) {}

  async handle(event: OrderSubmittedEvent): Promise<void> {
    const eventEnvelope = event as OrderSubmittedEvent & {
      eventId?: string;
      sequence?: number;
      occurredAt?: string;
    };
    const history = await this.eventStoreRepo.loadStream(event.orderId);
    const aggregate = OrderAggregate.rehydrate(history);
    const submittedAt = eventEnvelope.occurredAt ?? new Date().toISOString();

    const payload: OrderSubmittedOutboxPayload = {
      orderId: event.orderId,
      buyerId: aggregate.buyerId,
      sellerIds: aggregate.sellerIds,
      items: aggregate.items.map((item) => item.toSnapshot()),
      totalAmount: aggregate.totalAmount,
      currency: aggregate.currency,
      submittedAt,
      orderVersion: aggregate.version,
    };

    const headers: OrderOutboxHeaders = {
      messageId: eventEnvelope.eventId ?? event.orderId,
      correlationId: event.orderId,
      aggregateId: event.orderId,
      aggregateType: 'order',
      eventType: 'order.submitted',
      occurredAt: submittedAt,
      source: 'order-subgraph',
      sequence: eventEnvelope.sequence,
    };

    await this.outboxRepo.enqueue('order.submitted', payload, headers);
  }
}
