import { Injectable } from '@nestjs/common';

import { OrderSubmittedOutboxPayload } from '../outbox/order-outbox-message.type';
import { OrderRabbitMqPublisherService } from './order-rabbitmq-publisher.service';

@Injectable()
export class InventoryPublisherService {
  constructor(
    private readonly rabbitMqPublisher: OrderRabbitMqPublisherService,
  ) {}

  async publishReservationRequested(
    payload: OrderSubmittedOutboxPayload,
  ): Promise<void> {
    await this.rabbitMqPublisher.publish(
      'inventory.reservation.requested',
      {
        orderId: payload.orderId,
        buyerId: payload.buyerId,
        expectedVersion: payload.orderVersion,
        orderVersion: payload.orderVersion,
        correlationId: `inventory-${payload.orderId}-${payload.orderVersion}`,
        items: payload.items.map((item) => ({
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
        })),
      },
      {
        eventType: 'inventory.reservation.requested',
        orderId: payload.orderId,
      },
    );
  }
}
