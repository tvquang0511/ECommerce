import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { OrderSubmittedOutboxPayload } from '../outbox/order-outbox-message.type';

@Injectable()
export class InventoryPublisherService {
  constructor(private readonly configService: ConfigService) {}

  async publishReservationRequested(
    payload: OrderSubmittedOutboxPayload,
  ): Promise<void> {
    const baseUrl =
      this.configService.get<string>('order.inventoryServiceBaseUrl') ??
      'http://localhost:4010';

    const response = await fetch(`${baseUrl.replace(/\/+$/g, '')}/api/inventory/reserve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        orderId: payload.orderId,
        buyerId: payload.buyerId,
        expectedVersion: payload.orderVersion,
        orderVersion: payload.orderVersion,
        items: payload.items.map((item) => ({
          productId: item.productId,
          sellerId: item.sellerId,
          quantity: item.quantity,
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Inventory service reserve request failed with status ${response.status}.`,
      );
    }
  }
}
