import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { OrderCancelledEvent } from '../../domain/events/order-cancelled.event';
import { OrderConfirmedEvent } from '../../domain/events/order-confirmed.event';
import { OrderCreatedDirectEvent } from '../../domain/events/order-created-direct.event';
import { OrderCreatedFromCartEvent } from '../../domain/events/order-created-from-cart.event';
import { OrderDomainEvent } from '../../domain/events/order-domain-event';
import { OrderInventoryRejectedEvent } from '../../domain/events/order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from '../../domain/events/order-inventory-reserved.event';
import { OrderPaymentAuthorizedEvent } from '../../domain/events/order-payment-authorized.event';
import { OrderPaymentFailedEvent } from '../../domain/events/order-payment-failed.event';
import { OrderSubmittedEvent } from '../../domain/events/order-submitted.event';
import { OrderItemSnapshot } from '../../domain/value-objects/order-item.vo';
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
          this.asOrderItemSnapshots(record.eventData.items),
          this.asStringArray(record.eventData.sellerIds),
          this.asNumber(record.eventData.totalAmount),
          String(record.eventData.currency),
          this.asOptionalString(record.eventData.cartId),
        );
      case 'OrderCreatedDirect':
        return new OrderCreatedDirectEvent(
          String(record.eventData.orderId),
          String(record.eventData.buyerId),
          this.asOrderItemSnapshots(record.eventData.items),
          this.asStringArray(record.eventData.sellerIds),
          this.asNumber(record.eventData.totalAmount),
          String(record.eventData.currency),
        );
      case 'OrderSubmitted':
        return new OrderSubmittedEvent(String(record.eventData.orderId));
      case 'OrderInventoryReserved':
        return new OrderInventoryReservedEvent(String(record.eventData.orderId));
      case 'OrderInventoryRejected':
        return new OrderInventoryRejectedEvent(
          String(record.eventData.orderId),
          this.asOptionalString(record.eventData.reason),
        );
      case 'OrderPaymentAuthorized':
        return new OrderPaymentAuthorizedEvent(String(record.eventData.orderId));
      case 'OrderPaymentFailed':
        return new OrderPaymentFailedEvent(
          String(record.eventData.orderId),
          this.asOptionalString(record.eventData.reason),
        );
      case 'OrderConfirmed':
        return new OrderConfirmedEvent(String(record.eventData.orderId));
      case 'OrderCancelled':
        return new OrderCancelledEvent(
          String(record.eventData.orderId),
          this.asOptionalString(record.eventData.reason),
        );
      default:
        throw new Error(`Unsupported order event type: ${record.eventType}`);
    }
  }

  private serializeEvent(event: OrderDomainEvent): Record<string, unknown> {
    if (event instanceof OrderCreatedFromCartEvent) {
      return {
        orderId: event.orderId,
        buyerId: event.buyerId,
        items: event.items,
        sellerIds: event.sellerIds,
        totalAmount: event.totalAmount,
        currency: event.currency,
        cartId: event.cartId ?? null,
      };
    }

    if (event instanceof OrderCreatedDirectEvent) {
      return {
        orderId: event.orderId,
        buyerId: event.buyerId,
        items: event.items,
        sellerIds: event.sellerIds,
        totalAmount: event.totalAmount,
        currency: event.currency,
      };
    }

    if (event instanceof OrderSubmittedEvent) {
      return {
        orderId: event.orderId,
      };
    }

    if (event instanceof OrderInventoryReservedEvent) {
      return {
        orderId: event.orderId,
      };
    }

    if (event instanceof OrderInventoryRejectedEvent) {
      return {
        orderId: event.orderId,
        reason: event.reason ?? null,
      };
    }

    if (event instanceof OrderPaymentAuthorizedEvent) {
      return {
        orderId: event.orderId,
      };
    }

    if (event instanceof OrderPaymentFailedEvent) {
      return {
        orderId: event.orderId,
        reason: event.reason ?? null,
      };
    }

    if (event instanceof OrderConfirmedEvent) {
      return {
        orderId: event.orderId,
      };
    }

    if (event instanceof OrderCancelledEvent) {
      return {
        orderId: event.orderId,
        reason: event.reason ?? null,
      };
    }

    throw new Error('Unsupported order event instance.');
  }

  private asOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    return value;
  }

  private asStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private asNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }

  private asOrderItemSnapshots(value: unknown): OrderItemSnapshot[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.lineId !== 'string' ||
        typeof candidate.productId !== 'string' ||
        typeof candidate.sellerId !== 'string' ||
        typeof candidate.titleSnapshot !== 'string' ||
        typeof candidate.quantity !== 'number' ||
        typeof candidate.unitPriceAmount !== 'number' ||
        typeof candidate.currency !== 'string'
      ) {
        return [];
      }

      return [
        {
          lineId: candidate.lineId,
          productId: candidate.productId,
          sellerId: candidate.sellerId,
          titleSnapshot: candidate.titleSnapshot,
          imageSnapshot:
            typeof candidate.imageSnapshot === 'string' ? candidate.imageSnapshot : null,
          quantity: candidate.quantity,
          unitPriceAmount: candidate.unitPriceAmount,
          currency: candidate.currency,
        },
      ];
    });
  }
}
