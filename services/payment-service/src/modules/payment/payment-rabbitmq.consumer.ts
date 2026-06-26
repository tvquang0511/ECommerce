import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel, ConsumeMessage } from 'amqplib';

import { PaymentCallbackService } from './payment-callback.service';
import { PaymentService } from './payment.service';

interface PaymentAuthorizationRequestedMessage {
  orderId: string;
  buyerId?: string;
  expectedVersion?: number;
  orderVersion?: number;
  correlationId?: string;
  totalAmount: number;
  currency: string;
}

@Injectable()
export class PaymentRabbitMqConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentRabbitMqConsumer.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private consumerTag?: string;
  private connectPromise?: Promise<Channel>;

  constructor(
    private readonly configService: ConfigService,
    private readonly paymentService: PaymentService,
    private readonly callbackService: PaymentCallbackService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureConsumer();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ is not ready during payment startup. Consumer will retry on next restart. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
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
      ) as PaymentAuthorizationRequestedMessage;

      const result = this.paymentService.authorize(payload);

      await this.callbackService.sendAuthorized({
        orderId: result.orderId,
        expectedVersion: result.expectedVersion,
        correlationId: result.correlationId,
      });

      this.channel.ack(message);
    } catch (error) {
      this.logger.error(
        'Failed to process payment authorization message.',
        error instanceof Error ? error.stack : undefined,
      );
      this.channel.nack(message, false, true);
    }
  }

  private async ensureConsumer(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const url =
      this.configService.get<string>('payment.rabbitmqUrl') ??
      'amqp://rabbit:rabbit@localhost:5672';
    const exchange =
      this.configService.get<string>('payment.rabbitmqExchange') ??
      'order.integration';
    const queue =
      this.configService.get<string>('payment.authorizationQueue') ??
      'payment.authorization.requested.q';

    this.connectPromise = (async () => {
      try {
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        await channel.assertExchange(exchange, 'topic', { durable: true });
        await channel.assertQueue(queue, { durable: true });
        await channel.bindQueue(queue, exchange, 'payment.authorization.requested');
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
        this.logger.log(`Payment consumer is listening on queue ${queue}.`);

        return channel;
      } finally {
        this.connectPromise = undefined;
      }
    })();

    return this.connectPromise;
  }
}
