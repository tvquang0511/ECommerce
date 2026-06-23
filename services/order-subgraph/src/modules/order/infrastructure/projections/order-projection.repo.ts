import { Injectable } from '@nestjs/common';

import {
  Order,
  OrderInventoryStatus,
  OrderItem,
  OrderPaymentStatus,
  OrderStatus,
} from '../../graphql/order.gql.type';
import { OrderPrismaService } from '../prisma/order-prisma.service';
import { OrderItemSnapshot } from '../../domain/value-objects/order-item.vo';

@Injectable()
export class OrderProjectionRepo {
  constructor(private readonly prisma: OrderPrismaService) {}

  async findVisibleById(orderId: string, actorId: string): Promise<Order | null> {
    const row = await this.prisma.orderRead.findFirst({
      where: {
        orderId,
        OR: [{ buyerId: actorId }, { sellerIds: { has: actorId } }],
      },
      include: {
        items: true,
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
      include: {
        items: true,
      },
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

  async seedDraft(params: {
    orderId: string;
    buyerId: string;
    sellerIds: string[];
    items: OrderItemSnapshot[];
    totalAmount: number;
    currency: string;
  }): Promise<Order> {
    const now = new Date();

    const row = await this.prisma.$transaction(async (tx) => {
      const orderRow = await tx.orderRead.upsert({
        where: { orderId: params.orderId },
        update: {
          buyerId: params.buyerId,
          sellerIds: params.sellerIds,
          totalAmount: params.totalAmount,
          currency: params.currency,
          updatedAt: now,
        },
        create: {
          orderId: params.orderId,
          buyerId: params.buyerId,
          sellerIds: params.sellerIds,
          status: OrderStatus.DRAFT,
          inventoryStatus: OrderInventoryStatus.NOT_REQUESTED,
          paymentStatus: OrderPaymentStatus.NOT_REQUESTED,
          totalAmount: params.totalAmount,
          currency: params.currency,
          version: 0,
          createdAt: now,
          updatedAt: now,
        },
      });

      await tx.orderItemRead.deleteMany({
        where: { orderId: params.orderId },
      });

      if (params.items.length > 0) {
        await tx.orderItemRead.createMany({
          data: params.items.map((item) => ({
            lineId: item.lineId,
            orderId: params.orderId,
            productId: item.productId,
            sellerId: item.sellerId,
            titleSnapshot: item.titleSnapshot,
            quantity: item.quantity,
            unitPriceAmount: item.unitPriceAmount,
            currency: item.currency,
          })),
        });
      }

      return tx.orderRead.findUniqueOrThrow({
        where: { orderId: params.orderId },
        include: {
          items: true,
        },
      });
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
      items: (row.items ?? []).map((item) => this.toOrderItem(item)),
    };
  }

  private toOrderItem(row: OrderItemProjectionRow): OrderItem {
    return {
      lineId: row.lineId,
      productId: row.productId,
      sellerId: row.sellerId,
      titleSnapshot: row.titleSnapshot,
      quantity: row.quantity,
      unitPrice: {
        amount: row.unitPriceAmount,
        currency: row.currency,
      },
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
  items?: OrderItemProjectionRow[];
}

interface OrderItemProjectionRow {
  lineId: string;
  productId: string;
  sellerId: string;
  titleSnapshot: string;
  quantity: number;
  unitPriceAmount: number;
  currency: string;
}
