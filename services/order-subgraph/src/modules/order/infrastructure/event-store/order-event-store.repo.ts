import { Injectable } from '@nestjs/common';

import { OrderDomainEvent } from '../../domain/events/order-domain-event';
import { OrderEventMapper } from './order-event.mapper';
import { OrderEventMetadata, OrderEventRecord } from './order-event-record.type';

@Injectable()
export class OrderEventStoreRepo {
  private readonly streams = new Map<string, OrderEventRecord[]>();

  constructor(private readonly eventMapper: OrderEventMapper) {}

  async append(
    aggregateId: string,
    expectedVersion: number,
    events: OrderDomainEvent[],
    metadata?: OrderEventMetadata,
  ): Promise<void> {
    const currentStream = this.streams.get(aggregateId) ?? [];
    const currentVersion = currentStream.length === 0 ? 0 : currentStream.length - 1;

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
        sequence: currentStream.length + index,
      }),
    );

    this.streams.set(aggregateId, [...currentStream, ...persisted]);
  }

  async loadStream(aggregateId: string): Promise<OrderDomainEvent[]> {
    const currentStream = this.streams.get(aggregateId) ?? [];
    return currentStream
      .slice()
      .sort((left, right) => left.sequence - right.sequence)
      .map((record) => this.eventMapper.toDomain(record));
  }
}
