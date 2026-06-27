import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

import { MarkPaymentAuthorizedCommand } from '../../application/commands/mark-payment-authorized/mark-payment-authorized.command';
import { MarkPaymentFailedCommand } from '../../application/commands/mark-payment-failed/mark-payment-failed.command';

class PaymentAuthorizedCallbackDto {
  @IsString()
  orderId!: string;

  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @IsString()
  correlationId!: string;
}

class PaymentFailedCallbackDto {
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

@Controller('internal/order-callbacks/payment')
export class OrderPaymentCallbacksController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('authorized')
  async markAuthorized(@Body() input: PaymentAuthorizedCallbackDto) {
    return this.commandBus.execute(
      new MarkPaymentAuthorizedCommand(
        input.orderId,
        input.expectedVersion,
        input.correlationId,
      ),
    );
  }

  @Post('failed')
  async markFailed(@Body() input: PaymentFailedCallbackDto) {
    return this.commandBus.execute(
      new MarkPaymentFailedCommand(
        input.orderId,
        input.expectedVersion,
        input.correlationId,
        input.reason,
      ),
    );
  }
}
