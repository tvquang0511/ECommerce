import { Injectable } from '@nestjs/common';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { InventoryPublisherService } from '../../../infrastructure/integrations/inventory-publisher.service';
import { PaymentPublisherService } from '../../../infrastructure/integrations/payment-publisher.service';
import { SubmitOrderCommand } from './submit-order.command';

@Injectable()
export class SubmitOrderHandler {
  constructor(
    private readonly inventoryPublisher: InventoryPublisherService,
    private readonly paymentPublisher: PaymentPublisherService,
  ) {}

  async execute(command: SubmitOrderCommand): Promise<OrderCommandResult> {
    await this.inventoryPublisher.publishReservationRequested(command.orderId);
    await this.paymentPublisher.publishPaymentRequested(command.orderId);

    return {
      orderId: command.orderId,
      status: OrderStatus.SUBMITTED,
      version: command.expectedVersion + 1,
      correlationId: command.idempotencyKey,
      message:
        'Skeleton submit-order handler ready. Connect event store and outbox in next phase.',
    };
  }
}
