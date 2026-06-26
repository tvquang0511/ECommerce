import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma as PrismaTypes } from '../../../../../prisma/.client';

import { OrderPrismaService } from '../prisma/order-prisma.service';
import {
  OrderOutboxHeaders,
} from './order-outbox-message.type';

export interface OrderOutboxEntry<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  THeaders extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: TPayload;
  headers: THeaders;
  publishedAt: string | null;
  retryCount: number;
  createdAt: string;
}

@Injectable()
export class OrderOutboxRepo {
  constructor(private readonly prisma: OrderPrismaService) {}

  async enqueue<TPayload extends Record<string, unknown>>(
    eventType: string,
    payload: TPayload,
    headers: Partial<OrderOutboxHeaders> = {},
  ): Promise<void> {
    const aggregateId =
      typeof payload.orderId === 'string' ? payload.orderId : randomUUID();
    const occurredAt =
      typeof headers.occurredAt === 'string' ? headers.occurredAt : new Date().toISOString();

    await this.prisma.orderOutbox.create({
      data: {
        id: randomUUID(),
        aggregateId,
        eventType,
        payload: payload as PrismaTypes.InputJsonValue,
        headers: {
          aggregateId,
          aggregateType: 'order',
          eventType,
          source: 'order-subgraph',
          occurredAt,
          ...headers,
        } as PrismaTypes.InputJsonValue,
      },
    });
  }

  async listPending(limit = 50): Promise<OrderOutboxEntry[]> {
    const rows = await this.prisma.orderOutbox.findMany({
      where: { publishedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: this.asRecord(row.payload),
      headers: this.asRecord(row.headers),
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
      retryCount: row.retryCount,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markPublished(id: string): Promise<void> {
    await this.prisma.orderOutbox.update({
      where: { id },
      data: {
        publishedAt: new Date(),
      },
    });
  }

  async incrementRetryCount(id: string): Promise<void> {
    await this.prisma.orderOutbox.update({
      where: { id },
      data: {
        retryCount: { increment: 1 },
      },
    });
  }

  async countPending(): Promise<number> {
    return this.prisma.orderOutbox.count({
      where: { publishedAt: null },
    });
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}
