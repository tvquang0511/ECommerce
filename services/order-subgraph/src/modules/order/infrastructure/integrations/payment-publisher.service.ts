import { Injectable } from '@nestjs/common';

import { OrderSubmittedOutboxPayload } from '../outbox/order-outbox-message.type';
import { OrderRabbitMqPublisherService } from './order-rabbitmq-publisher.service';

@Injectable()
export class PaymentPublisherService {
  constructor(
    private readonly rabbitMqPublisher: OrderRabbitMqPublisherService,
  ) {}

  async publishPaymentRequested(
    payload: OrderSubmittedOutboxPayload,
  ): Promise<void> {
    await this.rabbitMqPublisher.publish(
      'payment.authorization.requested',
      {
        orderId: payload.orderId,
        buyerId: payload.buyerId,
        expectedVersion: payload.orderVersion,
        orderVersion: payload.orderVersion,
        correlationId: `payment-${payload.orderId}-${payload.orderVersion}`,
        sellerIds: payload.sellerIds,
        totalAmount: payload.totalAmount,
        currency: payload.currency,
        items: payload.items.map((item) => ({
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
          unitPriceAmount: item.unitPriceAmount,
          currency: item.currency,
        })),
      },
      {
        eventType: 'payment.authorization.requested',
        orderId: payload.orderId,
      },
    );
  }
}
