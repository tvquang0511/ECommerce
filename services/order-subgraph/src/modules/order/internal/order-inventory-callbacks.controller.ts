import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import { MarkInventoryRejectedCommand } from '../application/commands/mark-inventory-rejected/mark-inventory-rejected.command';
import { MarkInventoryReservedCommand } from '../application/commands/mark-inventory-reserved/mark-inventory-reserved.command';

class InventoryReservedCallbackDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  correlationId!: string;
}

class InventoryRejectedCallbackDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  correlationId!: string;

  @IsOptional()
  @IsString()
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


