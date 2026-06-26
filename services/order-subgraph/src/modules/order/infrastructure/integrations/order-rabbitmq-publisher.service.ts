import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { Channel, ChannelModel } from 'amqplib';

@Injectable()
export class OrderRabbitMqPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderRabbitMqPublisherService.name);
  private connection?: ChannelModel;
  private channel?: Channel;
  private connectPromise?: Promise<Channel>;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureChannel();
    } catch (error) {
      this.logger.warn(
        `RabbitMQ is not ready during startup. Outbox publish will retry later. ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  async publish(
    routingKey: string,
    payload: Record<string, unknown>,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    const channel = await this.ensureChannel();
    const exchange = this.getExchange();
    const published = channel.publish(
      exchange,
      routingKey,
      Buffer.from(JSON.stringify(payload)),
      {
        contentType: 'application/json',
        persistent: true,
        headers,
      },
    );

    if (!published) {
      this.logger.warn(`RabbitMQ publish returned false for routing key ${routingKey}.`);
    }
  }

  private async ensureChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    const url =
      this.configService.get<string>('rabbitmq.url') ??
      'amqp://guest:guest@localhost:5672';

    this.connectPromise = (async () => {
      try {
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        await channel.assertExchange(this.getExchange(), 'topic', {
          durable: true,
        });
        this.connection = connection;
        this.channel = channel;

        return channel;
      } finally {
        this.connectPromise = undefined;
      }
    })();

    return this.connectPromise;
  }

  private getExchange(): string {
    return (
      this.configService.get<string>('rabbitmq.exchange') ?? 'order.integration'
    );
  }
}
