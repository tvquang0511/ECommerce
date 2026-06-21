import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { OrderPrismaService } from '../prisma/order-prisma.service';

export interface OrderOutboxEntry {
  id: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  headers: Record<string, unknown>;
  publishedAt: string | null;
  retryCount: number;
  createdAt: string;
}

@Injectable()
export class OrderOutboxRepo {
  constructor(private readonly prisma: OrderPrismaService) {}

  async enqueue(
    eventType: string,
    payload: Record<string, unknown>,
    headers: Record<string, unknown> = {},
  ): Promise<void> {
    const aggregateId =
      typeof payload.orderId === 'string' ? payload.orderId : randomUUID();

    await this.prisma.orderOutbox.create({
      data: {
        id: randomUUID(),
        aggregateId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        headers: headers as Prisma.InputJsonValue,
      },
    });
  }

  async listPending(limit = 50): Promise<OrderOutboxEntry[]> {
    const rows = await this.prisma.orderOutbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      payload: row.payload as Record<string, unknown>,
      headers: row.headers as Record<string, unknown>,
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
}
