import { OrderItemSnapshot } from '../../domain/value-objects/order-item.vo';

export interface OrderOutboxHeaders extends Record<string, unknown> {
  messageId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: 'order';
  eventType: string;
  occurredAt: string;
  source: 'order-subgraph';
  sequence?: number;
}

export interface OrderSubmittedOutboxPayload extends Record<string, unknown> {
  orderId: string;
  buyerId: string;
  sellerIds: string[];
  items: OrderItemSnapshot[];
  totalAmount: number;
  currency: string;
  submittedAt: string;
  orderVersion: number;
}
