import { Injectable } from '@nestjs/common';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { CancelOrderCommand } from './cancel-order.command';

@Injectable()
export class CancelOrderHandler {
  async execute(command: CancelOrderCommand): Promise<OrderCommandResult> {
    return {
      orderId: command.orderId,
      status: OrderStatus.CANCELLED,
      version: command.expectedVersion + 1,
      correlationId: command.idempotencyKey,
      message: command.reason
        ? `Skeleton cancel-order handler ready. Reason captured: ${command.reason}`
        : 'Skeleton cancel-order handler ready.',
    };
  }
}
