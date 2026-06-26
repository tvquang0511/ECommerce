import { Injectable } from '@nestjs/common';

import {
  CheckInventoryRequestDto,
  ReleaseInventoryRequestDto,
  ReserveInventoryRequestDto,
  UpsertStockRequestDto,
} from './dto/inventory.dto';

interface InventoryStockRecord {
  productId: string;
  available: number;
  reserved: number;
}

interface InventoryReservationRecord {
  orderId: string;
  buyerId?: string;
  expectedVersion: number;
  correlationId: string;
  status: 'RESERVED' | 'REJECTED' | 'RELEASED';
  items: Array<{
    productId: string;
    sellerId: string;
    quantity: number;
  }>;
  reason?: string;
}

@Injectable()
export class InventoryService {
  private readonly stock = new Map<string, InventoryStockRecord>([
    ['p1001', { productId: 'p1001', available: 8, reserved: 0 }],
    ['p1002', { productId: 'p1002', available: 4, reserved: 0 }],
    ['p1003', { productId: 'p1003', available: 3, reserved: 0 }],
    ['p1004', { productId: 'p1004', available: 0, reserved: 0 }],
    ['p1005', { productId: 'p1005', available: 2, reserved: 0 }],
    ['p1006', { productId: 'p1006', available: 12, reserved: 0 }],
  ]);

  private readonly reservations = new Map<string, InventoryReservationRecord>();

  getHealth() {
    return {
      ok: true,
      service: 'inventory-service',
    };
  }

  getStock(productId: string) {
    const record =
      this.stock.get(productId) ??
      ({ productId, available: 0, reserved: 0 } satisfies InventoryStockRecord);

    return {
      productId: record.productId,
      available: record.available,
      reserved: record.reserved,
      inStock: record.available > 0,
    };
  }

  listStock() {
    return [...this.stock.values()].map((record) => ({
      productId: record.productId,
      available: record.available,
      reserved: record.reserved,
      inStock: record.available > 0,
    }));
  }

  checkAvailability(input: CheckInventoryRequestDto) {
    return {
      items: input.items.map((item) => {
        const stock = this.getOrCreateStock(item.productId);
        return {
          productId: item.productId,
          requestedQuantity: item.quantity,
          available: stock.available,
          inStock: stock.available > 0,
          canReserve: stock.available >= item.quantity,
        };
      }),
    };
  }

  getReservation(orderId: string) {
    const existing = this.reservations.get(orderId);
    if (!existing) {
      return null;
    }

    return {
      orderId: existing.orderId,
      buyerId: existing.buyerId ?? null,
      status: existing.status,
      items: existing.items,
      reason: existing.reason ?? null,
    };
  }

  reserve(input: ReserveInventoryRequestDto) {
    const existing = this.reservations.get(input.orderId);
    if (existing) {
      return {
        orderId: existing.orderId,
        status: existing.status,
        expectedVersion: existing.expectedVersion,
        correlationId: existing.correlationId,
        items: existing.items,
        reason: existing.reason ?? null,
        idempotentReplay: true,
      };
    }

    const insufficientItem = input.items.find((item) => {
      const stock = this.stock.get(item.productId);
      return !stock || stock.available < item.quantity;
    });

    if (insufficientItem) {
      const reason = `Insufficient stock for product ${insufficientItem.productId}`;
      const expectedVersion = this.resolveExpectedVersion(input);
      this.reservations.set(input.orderId, {
        orderId: input.orderId,
        buyerId: input.buyerId,
        expectedVersion,
        correlationId: input.orderId,
        status: 'REJECTED',
        items: input.items,
        reason,
      });

      return {
        orderId: input.orderId,
        status: 'REJECTED' as const,
        expectedVersion,
        correlationId: input.orderId,
        items: input.items,
        reason,
        idempotentReplay: false,
      };
    }

    input.items.forEach((item) => {
      const stock = this.getOrCreateStock(item.productId);
      stock.available -= item.quantity;
      stock.reserved += item.quantity;
    });

    const expectedVersion = this.resolveExpectedVersion(input);
    this.reservations.set(input.orderId, {
      orderId: input.orderId,
      buyerId: input.buyerId,
      expectedVersion,
      correlationId: input.orderId,
      status: 'RESERVED',
      items: input.items,
    });

    return {
      orderId: input.orderId,
      status: 'RESERVED' as const,
      expectedVersion,
      correlationId: input.orderId,
      items: input.items,
      reason: null,
      idempotentReplay: false,
    };
  }

  upsertStock(input: UpsertStockRequestDto) {
    input.items.forEach((item) => {
      const existing = this.getOrCreateStock(item.productId);
      existing.available = item.available;
    });

    return this.listStock();
  }

  release(input: ReleaseInventoryRequestDto) {
    const existing = this.reservations.get(input.orderId);
    if (!existing) {
      return {
        orderId: input.orderId,
        status: 'NOT_FOUND' as const,
      };
    }

    if (existing.status === 'RELEASED') {
      return {
        orderId: input.orderId,
        status: 'RELEASED' as const,
        idempotentReplay: true,
      };
    }

    if (existing.status === 'RESERVED') {
      existing.items.forEach((item) => {
        const stock = this.getOrCreateStock(item.productId);
        stock.available += item.quantity;
        stock.reserved = Math.max(0, stock.reserved - item.quantity);
      });
    }

    existing.status = 'RELEASED';
    this.reservations.set(input.orderId, existing);

    return {
      orderId: input.orderId,
      status: 'RELEASED' as const,
      idempotentReplay: false,
    };
  }

  private getOrCreateStock(productId: string): InventoryStockRecord {
    const existing = this.stock.get(productId);
    if (existing) {
      return existing;
    }

    const created = {
      productId,
      available: 0,
      reserved: 0,
    } satisfies InventoryStockRecord;
    this.stock.set(productId, created);
    return created;
  }

  private resolveExpectedVersion(input: ReserveInventoryRequestDto): number {
    const candidate = (input as ReserveInventoryRequestDto & {
      expectedVersion?: number;
      orderVersion?: number;
    }).expectedVersion;

    if (typeof candidate === 'number') {
      return candidate;
    }

    const orderVersion = (input as ReserveInventoryRequestDto & {
      orderVersion?: number;
    }).orderVersion;

    if (typeof orderVersion === 'number') {
      return orderVersion;
    }

    return 1;
  }
}
