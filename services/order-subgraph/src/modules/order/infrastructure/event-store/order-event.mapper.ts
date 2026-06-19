import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { OrderCreatedFromCartEvent } from '../../domain/events/order-created-from-cart.event';
import { OrderDomainEvent } from '../../domain/events/order-domain-event';
import { OrderSubmittedEvent } from '../../domain/events/order-submitted.event';
import { OrderEventMetadata, OrderEventRecord } from './order-event-record.type';

@Injectable()
export class OrderEventMapper {
  toPersistence(params: {
    aggregateId: string;
    event: OrderDomainEvent;
    metadata?: OrderEventMetadata;
    sequence: number;
  }): OrderEventRecord {
    return {
      id: randomUUID(),
      aggregateId: params.aggregateId,
      aggregateType: 'order',
      sequence: params.sequence,
      eventType: params.event.type,
      eventData: this.serializeEvent(params.event),
      metadata: params.metadata ?? {},
      occurredAt: new Date().toISOString(),
    };
  }

  toDomain(record: OrderEventRecord): OrderDomainEvent {
    switch (record.eventType) {
      case 'OrderCreatedFromCart':
        return new OrderCreatedFromCartEvent(
          String(record.eventData.orderId),
          String(record.eventData.buyerId),
          String(record.eventData.currency),
        );
      case 'OrderSubmitted':
        return new OrderSubmittedEvent(String(record.eventData.orderId));
      default:
        throw new Error(`Unsupported order event type: ${record.eventType}`);
    }
  }

  private serializeEvent(event: OrderDomainEvent): Record<string, unknown> {
    if (event instanceof OrderCreatedFromCartEvent) {
      return {
        orderId: event.orderId,
        buyerId: event.buyerId,
        currency: event.currency,
      };
    }

    if (event instanceof OrderSubmittedEvent) {
      return {
        orderId: event.orderId,
      };
    }

    throw new Error(`Unsupported order event instance: ${event.constructor.name}`);
  }
}
