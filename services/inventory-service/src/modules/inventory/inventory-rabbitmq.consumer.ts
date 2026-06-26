import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import { InventoryOrderCallbackService } from './inventory-order-callback.service';
import { InventoryService } from './inventory.service';

interface InventoryReservationRequestedMessage {
  orderId: string;
  buyerId?: string;
  expectedVersion?: number;
  orderVersion?: number;
  correlationId?: string;
  items: Array<{
    productId: string;
    sellerId: string;
    quantity: number;
  }>;
}

@Injectable()
export class InventoryRabbitMqConsumer
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(InventoryRabbitMqConsumer.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private consumerTag?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
    private readonly orderCallbackService: InventoryOrderCallbackService,
  ) {}

  async onModuleInit(): Promise<void> {
    const url =
      this.configService.get<string>('inventory.rabbitmqUrl') ??
      'amqp://rabbit:rabbit@localhost:5672';
    const exchange =
      this.configService.get<string>('inventory.rabbitmqExchange') ??
      'order.integration';
    const queue =
      this.configService.get<string>('inventory.reservationQueue') ??
      'inventory.reservation.requested.q';

    const connection = await amqp.connect(url);
    const channel = await connection.createChannel();
    await channel.assertExchange(exchange, 'topic', { durable: true });
    await channel.assertQueue(queue, { durable: true });
    await channel.bindQueue(queue, exchange, 'inventory.reservation.requested');
    await channel.prefetch(10);

    const consumeResult = await channel.consume(
      queue,
      (message) => {
        void this.handleMessage(message);
      },
      { noAck: false },
    );

    this.connection = connection;
    this.channel = channel;
    this.consumerTag = consumeResult.consumerTag;
    this.logger.log(`Inventory consumer is listening on queue ${queue}.`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.channel && this.consumerTag) {
      await this.channel.cancel(this.consumerTag).catch(() => undefined);
    }
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    try {
      const payload = JSON.parse(
        message.content.toString(),
      ) as InventoryReservationRequestedMessage;

      const result = this.inventoryService.reserve({
        orderId: payload.orderId,
        buyerId: payload.buyerId,
        expectedVersion: payload.expectedVersion,
        orderVersion: payload.orderVersion,
        items: payload.items,
      });

      if (result.status === 'RESERVED') {
        await this.orderCallbackService.sendReserved({
          orderId: result.orderId,
          expectedVersion: result.expectedVersion,
          correlationId: payload.correlationId ?? result.correlationId,
        });
      } else if (result.status === 'REJECTED') {
        await this.orderCallbackService.sendRejected({
          orderId: result.orderId,
          expectedVersion: result.expectedVersion,
          correlationId: payload.correlationId ?? result.correlationId,
          reason: result.reason,
        });
      }

      this.channel.ack(message);
    } catch (error) {
      this.logger.error(
        'Failed to process inventory reservation message.',
        error instanceof Error ? error.stack : undefined,
      );
      this.channel.nack(message, false, true);
    }
  }
}
