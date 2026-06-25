import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import {
  CheckInventoryRequestDto,
  ReleaseInventoryRequestDto,
  ReserveInventoryRequestDto,
  UpsertStockRequestDto,
} from './dto/inventory.dto';
import { InventoryOrderCallbackService } from './inventory-order-callback.service';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly orderCallbackService: InventoryOrderCallbackService,
  ) {}

  @Get('health')
  getHealth() {
    return this.inventoryService.getHealth();
  }

  @Get('api/inventory/stock')
  listStock() {
    return this.inventoryService.listStock();
  }

  @Get('api/inventory/stock/:productId')
  getStock(@Param('productId') productId: string) {
    return this.inventoryService.getStock(productId);
  }

  @Post('api/inventory/stock/check')
  checkAvailability(@Body() input: CheckInventoryRequestDto) {
    return this.inventoryService.checkAvailability(input);
  }

  @Post('api/inventory/stock/upsert')
  upsertStock(@Body() input: UpsertStockRequestDto) {
    return this.inventoryService.upsertStock(input);
  }

  @Post('api/inventory/reserve')
  async reserve(@Body() input: ReserveInventoryRequestDto) {
    const result = this.inventoryService.reserve(input);

    if (result.status === 'RESERVED') {
      await this.orderCallbackService.sendReserved({
        orderId: result.orderId,
        expectedVersion: result.expectedVersion,
        correlationId: result.correlationId,
      });
    }

    if (result.status === 'REJECTED') {
      await this.orderCallbackService.sendRejected({
        orderId: result.orderId,
        expectedVersion: result.expectedVersion,
        correlationId: result.correlationId,
        reason: result.reason,
      });
    }

    return result;
  }

  @Get('api/inventory/reservations/:orderId')
  getReservation(@Param('orderId') orderId: string) {
    return this.inventoryService.getReservation(orderId);
  }

  @Post('api/inventory/release')
  release(@Body() input: ReleaseInventoryRequestDto) {
    return this.inventoryService.release(input);
  }
}
