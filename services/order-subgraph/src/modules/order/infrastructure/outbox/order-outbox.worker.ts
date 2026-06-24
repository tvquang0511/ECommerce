import { Injectable, Logger } from '@nestjs/common';

import { InventoryPublisherService } from '../integrations/inventory-publisher.service';
import { PaymentPublisherService } from '../integrations/payment-publisher.service';
import { OrderOutboxRepo } from './order-outbox.repo';

@Injectable()
export class OrderOutboxWorker {
  private readonly logger = new Logger(OrderOutboxWorker.name);

  constructor(
    private readonly outboxRepo: OrderOutboxRepo,
    private readonly inventoryPublisher: InventoryPublisherService,
    private readonly paymentPublisher: PaymentPublisherService,
  ) {}

  async flushPending(limit = 50): Promise<number> {
    const pending = await this.outboxRepo.listPending(limit);

    for (const entry of pending) {
      try {
        await this.publishEntry(entry.eventType, entry.payload);
        await this.outboxRepo.markPublished(entry.id);
      } catch (error) {
        await this.outboxRepo.incrementRetryCount(entry.id);
        this.logger.error(
          `Failed to publish outbox entry ${entry.id} (${entry.eventType}).`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return pending.length;
  }

  private async publishEntry(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (eventType === 'order.submitted') {
      const orderId = this.requireOrderId(payload);
      await this.inventoryPublisher.publishReservationRequested(orderId);
      await this.paymentPublisher.publishPaymentRequested(orderId);
      return;
    }

    if (eventType === 'order.created-from-cart') {
      this.logger.log(
        `Outbox acknowledged ${eventType} for order ${this.requireOrderId(payload)}.`,
      );
      return;
    }

    this.logger.warn(`No publisher strategy registered for outbox event ${eventType}.`);
  }

  private requireOrderId(payload: Record<string, unknown>): string {
    if (typeof payload.orderId !== 'string' || payload.orderId.length === 0) {
      throw new Error('Outbox payload is missing orderId.');
    }

    return payload.orderId;
  }
}
