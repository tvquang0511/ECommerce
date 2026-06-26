import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { MarkInventoryRejectedCommand } from './mark-inventory-rejected.command';

@CommandHandler(MarkInventoryRejectedCommand)
export class MarkInventoryRejectedHandler
  implements ICommandHandler<MarkInventoryRejectedCommand, OrderCommandResult>
{
  constructor(
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: MarkInventoryRejectedCommand): Promise<OrderCommandResult> {
    const history = await this.eventStoreRepo.loadStream(command.orderId);
    const aggregate = OrderAggregate.rehydrate(history);

    aggregate.markInventoryRejected(command.reason);

    await this.eventStoreRepo.append(
      aggregate.id,
      command.expectedVersion,
      aggregate.uncommittedEvents,
      { correlationId: command.correlationId, source: 'inventory' },
    );
    await this.eventBus.publishAll(aggregate.uncommittedEvents);

    return {
      orderId: aggregate.id,
      status: aggregate.status as OrderStatus,
      version: aggregate.version,
      correlationId: command.correlationId,
      message: command.reason
        ? `Inventory rejected callback applied: ${command.reason}`
        : 'Inventory rejected callback applied.',
    };
  }
}


