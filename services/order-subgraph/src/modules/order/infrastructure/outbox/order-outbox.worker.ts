import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

import { InventoryPublisherService } from '../integrations/inventory-publisher.service';
import { PaymentPublisherService } from '../integrations/payment-publisher.service';
import { OrderOutboxRepo } from './order-outbox.repo';

@Injectable()
export class OrderOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderOutboxWorker.name);
  private readonly intervalName = 'order-outbox-flush';
  private isFlushing = false;

  constructor(
    private readonly outboxRepo: OrderOutboxRepo,
    private readonly inventoryPublisher: InventoryPublisherService,
    private readonly paymentPublisher: PaymentPublisherService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.configService.get<boolean>('app.outboxWorkerEnabled') ?? true;

    if (!enabled) {
      this.logger.log('Order outbox worker is disabled by configuration.');
      return;
    }

    const intervalMs =
      this.configService.get<number>('app.outboxWorkerIntervalMs') ?? 1000;

    const interval = setInterval(() => {
      void this.runScheduledFlush();
    }, intervalMs);

    this.schedulerRegistry.addInterval(this.intervalName, interval);
    this.logger.log(
      `Order outbox worker scheduled every ${intervalMs}ms.`,
    );
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('interval', this.intervalName)) {
      this.schedulerRegistry.deleteInterval(this.intervalName);
    }
  }

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

  private async runScheduledFlush(): Promise<void> {
    if (this.isFlushing) {
      this.logger.debug(
        'Skip outbox flush because the previous flush is still running.',
      );
      return;
    }

    const batchSize =
      this.configService.get<number>('app.outboxWorkerBatchSize') ?? 20;
    this.isFlushing = true;

    try {
      const pendingBefore = await this.outboxRepo.countPending();
      if (pendingBefore === 0) {
        return;
      }

      const processed = await this.flushPending(batchSize);
      this.logger.log(
        `Order outbox flush processed ${processed} entr${
          processed === 1 ? 'y' : 'ies'
        } (pending before flush: ${pendingBefore}).`,
      );
    } finally {
      this.isFlushing = false;
    }
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
