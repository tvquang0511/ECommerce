import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { MarkInventoryRejectedCommand } from '../application/commands/mark-inventory-rejected/mark-inventory-rejected.command';
import { MarkInventoryReservedCommand } from '../application/commands/mark-inventory-reserved/mark-inventory-reserved.command';

class InventoryReservedCallbackDto {
  orderId!: string;
  expectedVersion!: number;
  correlationId!: string;
}

class InventoryRejectedCallbackDto {
  orderId!: string;
  expectedVersion!: number;
  correlationId!: string;
  reason?: string;
}

@Controller('internal/order-callbacks/inventory')
export class OrderInventoryCallbacksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('reserved')
  async markReserved(@Body() input: InventoryReservedCallbackDto) {
    return this.commandBus.execute(
      new MarkInventoryReservedCommand(
        input.orderId,
        input.expectedVersion,
        input.correlationId,
      ),
    );
  }

  @Post('rejected')
  async markRejected(@Body() input: InventoryRejectedCallbackDto) {
    return this.commandBus.execute(
      new MarkInventoryRejectedCommand(
        input.orderId,
        input.expectedVersion,
        input.correlationId,
        input.reason,
      ),
    );
  }
}
