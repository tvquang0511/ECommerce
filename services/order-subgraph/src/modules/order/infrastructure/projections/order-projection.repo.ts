import { Injectable } from '@nestjs/common';

import {
  Order,
  OrderInventoryStatus,
  OrderPaymentStatus,
  OrderStatus,
} from '../../graphql/order.gql.type';
import { OrderPrismaService } from '../prisma/order-prisma.service';

@Injectable()
export class OrderProjectionRepo {
  constructor(private readonly prisma: OrderPrismaService) {}

  async findVisibleById(orderId: string, actorId: string): Promise<Order | null> {
    const row = await this.prisma.orderRead.findFirst({
      where: {
        orderId,
        OR: [{ buyerId: actorId }, { sellerIds: { has: actorId } }],
      },
    });

    if (!row) {
      return null;
    }

    return this.toOrder(row);
  }

  async listByBuyerId(buyerId: string): Promise<Order[]> {
    const rows = await this.prisma.orderRead.findMany({
      where: { buyerId },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => this.toOrder(row));
  }

  async markSubmitted(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        status: OrderStatus.SUBMITTED,
        inventoryStatus: OrderInventoryStatus.PENDING,
        paymentStatus: OrderPaymentStatus.PENDING,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markCancelled(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        status: OrderStatus.CANCELLED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markConfirmed(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        status: OrderStatus.CONFIRMED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markPaymentAuthorized(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        paymentStatus: OrderPaymentStatus.AUTHORIZED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markPaymentFailed(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        paymentStatus: OrderPaymentStatus.FAILED,
        status: OrderStatus.FAILED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markInventoryReserved(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        inventoryStatus: OrderInventoryStatus.RESERVED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async markInventoryRejected(orderId: string): Promise<void> {
    await this.prisma.orderRead.update({
      where: { orderId },
      data: {
        inventoryStatus: OrderInventoryStatus.REJECTED,
        status: OrderStatus.FAILED,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
  }

  async seedDraft(orderId: string, buyerId: string, currency: string): Promise<Order> {
    const row = await this.prisma.orderRead.upsert({
      where: { orderId },
      update: {
        buyerId,
        currency,
        updatedAt: new Date(),
      },
      create: {
        orderId,
        buyerId,
        sellerIds: [],
        status: OrderStatus.DRAFT,
        inventoryStatus: OrderInventoryStatus.NOT_REQUESTED,
        paymentStatus: OrderPaymentStatus.NOT_REQUESTED,
        totalAmount: 0,
        currency,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return this.toOrder(row);
  }

  private toOrder(row: OrderProjectionRow): Order {
    return {
      id: row.orderId ?? row.id ?? '',
      buyerId: row.buyerId,
      sellerIds: row.sellerIds ?? [],
      status: row.status as OrderStatus,
      inventoryStatus: row.inventoryStatus as OrderInventoryStatus,
      paymentStatus: row.paymentStatus as OrderPaymentStatus,
      total: {
        amount: row.totalAmount,
        currency: row.currency,
      },
      version: row.version,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      items: [],
    };
  }
}

interface OrderProjectionRow {
  orderId?: string;
  id?: string;
  buyerId: string;
  sellerIds: string[];
  status: string;
  inventoryStatus: string;
  paymentStatus: string;
  totalAmount: number;
  currency: string;
  version: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}
