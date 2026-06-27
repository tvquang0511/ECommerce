import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import {
  OrderCommandResult,
  OrderStatus,
} from '../../../interfaces/graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderPaymentStatusEnum } from '../../../domain/enums/order-payment-status.enum';
import { OrderStatusEnum } from '../../../domain/enums/order-status.enum';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { MarkPaymentAuthorizedCommand } from './mark-payment-authorized.command';

@CommandHandler(MarkPaymentAuthorizedCommand)
export class MarkPaymentAuthorizedHandler
  implements ICommandHandler<MarkPaymentAuthorizedCommand, OrderCommandResult>
{
  constructor(
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkPaymentAuthorizedCommand): Promise<OrderCommandResult> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const history = await this.eventStoreRepo.loadStream(command.orderId);
      const aggregate = OrderAggregate.rehydrate(history);

      if (
        aggregate.paymentStatus === OrderPaymentStatusEnum.AUTHORIZED ||
        aggregate.status === OrderStatusEnum.CONFIRMED
      ) {
        return {
          orderId: aggregate.id,
          status: aggregate.status as OrderStatus,
          version: aggregate.version,
          correlationId: command.correlationId,
          message: 'Payment authorized callback already applied.',
        };
      }

      const currentVersion = aggregate.version;
      aggregate.markPaymentAuthorized();

      try {
        await this.eventStoreRepo.append(
          aggregate.id,
          currentVersion,
          aggregate.uncommittedEvents,
          { correlationId: command.correlationId, source: 'payment' },
        );
        await this.eventBus.publishAll(aggregate.uncommittedEvents);

        return {
          orderId: aggregate.id,
          status: aggregate.status as OrderStatus,
          version: aggregate.version,
          correlationId: command.correlationId,
          message: 'Payment authorized callback applied.',
        };
      } catch (error) {
        if (attempt === 1 || !this.isConcurrencyConflict(error)) {
          throw error;
        }
      }
    }

    throw new Error('Payment authorized callback retry budget exhausted.');
  }

  private isConcurrencyConflict(error: unknown): boolean {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return true;
    }

    return (
      error instanceof Error &&
      error.message.includes('Order event stream version mismatch')
    );
  }
}


