import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { OrderDomainEvent } from '../../domain/events/order-domain-event';
import { OrderEventMapper } from './order-event.mapper';
import { OrderEventMetadata, OrderEventRecord } from './order-event-record.type';
import { OrderPrismaService } from '../prisma/order-prisma.service';

@Injectable()
export class OrderEventStoreRepo {
  constructor(
    private readonly eventMapper: OrderEventMapper,
    private readonly prisma: OrderPrismaService,
  ) {}

  async append(
    aggregateId: string,
    expectedVersion: number,
    events: OrderDomainEvent[],
    metadata?: OrderEventMetadata,
  ): Promise<void> {
    const aggregate = await this.prisma.orderEvent.aggregate({
      where: { aggregateId },
      _max: { sequence: true },
    });
    const currentVersionRaw = aggregate._max.sequence ?? null;
    const currentVersion = currentVersionRaw ?? 0;

    if (currentVersion !== expectedVersion) {
      throw new Error(
        `Order event stream version mismatch for ${aggregateId}. Expected ${expectedVersion}, received ${currentVersion}.`,
      );
    }

    const persisted = events.map((event, index) =>
      this.eventMapper.toPersistence({
        aggregateId,
        event,
        metadata,
        sequence:
          currentVersionRaw === null ? index : currentVersion + index + 1,
      }),
    );

    await this.prisma.orderEvent.createMany({
      data: persisted.map((record) => ({
        id: record.id,
        aggregateId: record.aggregateId,
        aggregateType: record.aggregateType,
        sequence: record.sequence,
        eventType: record.eventType,
        eventData: record.eventData as Prisma.InputJsonValue,
        metadata: record.metadata as Prisma.InputJsonValue,
        occurredAt: new Date(record.occurredAt),
      })),
    });
  }

  async loadStream(aggregateId: string): Promise<OrderDomainEvent[]> {
    const currentStream = await this.prisma.orderEvent.findMany({
      where: { aggregateId },
      orderBy: { sequence: 'asc' },
    });

    return currentStream.map((record) =>
      this.eventMapper.toDomain({
        id: record.id,
        aggregateId: record.aggregateId,
        aggregateType: 'order',
        sequence: record.sequence,
        eventType: record.eventType,
        eventData: record.eventData as Record<string, unknown>,
        metadata: record.metadata as OrderEventMetadata,
        occurredAt: record.occurredAt.toISOString(),
      } satisfies OrderEventRecord),
    );
  }
}
