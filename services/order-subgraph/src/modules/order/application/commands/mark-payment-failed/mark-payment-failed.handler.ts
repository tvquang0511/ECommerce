import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs/dist';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { MarkPaymentFailedCommand } from './mark-payment-failed.command';

@CommandHandler(MarkPaymentFailedCommand)
export class MarkPaymentFailedHandler
  implements ICommandHandler<MarkPaymentFailedCommand, OrderCommandResult>
{
  constructor(
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkPaymentFailedCommand): Promise<OrderCommandResult> {
    const history = await this.eventStoreRepo.loadStream(command.orderId);
    const aggregate = OrderAggregate.rehydrate(history);

    aggregate.markPaymentFailed(command.reason);

    await this.eventStoreRepo.append(
      aggregate.id,
      command.expectedVersion,
      aggregate.uncommittedEvents,
      { correlationId: command.correlationId, source: 'payment' },
    );
    await this.eventBus.publishAll(aggregate.uncommittedEvents);

    return {
      orderId: aggregate.id,
      status: aggregate.status as OrderStatus,
      version: aggregate.version,
      correlationId: command.correlationId,
      message: command.reason
        ? `Payment failed callback applied: ${command.reason}`
        : 'Payment failed callback applied.',
    };
  }
}

