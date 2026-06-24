import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
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
    const history = await this.eventStoreRepo.loadStream(command.orderId);
    const aggregate = OrderAggregate.rehydrate(history);

    aggregate.markPaymentAuthorized();

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
      message: 'Payment authorized callback applied.',
    };
  }
}
