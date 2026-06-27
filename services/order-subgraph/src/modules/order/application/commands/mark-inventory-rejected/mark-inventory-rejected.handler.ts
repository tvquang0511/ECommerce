import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import {
  OrderCommandResult,
  OrderStatus,
} from '../../../interfaces/graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderInventoryStatusEnum } from '../../../domain/enums/order-inventory-status.enum';
import { OrderStatusEnum } from '../../../domain/enums/order-status.enum';
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const history = await this.eventStoreRepo.loadStream(command.orderId);
      const aggregate = OrderAggregate.rehydrate(history);

      if (
        aggregate.inventoryStatus === OrderInventoryStatusEnum.REJECTED ||
        aggregate.status === OrderStatusEnum.CANCELLED ||
        aggregate.status === OrderStatusEnum.FAILED
      ) {
        return {
          orderId: aggregate.id,
          status: aggregate.status as OrderStatus,
          version: aggregate.version,
          correlationId: command.correlationId,
          message: command.reason
            ? `Inventory rejected callback already applied: ${command.reason}`
            : 'Inventory rejected callback already applied.',
        };
      }

      const currentVersion = aggregate.version;
      aggregate.markInventoryRejected(command.reason);

      try {
        await this.eventStoreRepo.append(
          aggregate.id,
          currentVersion,
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
      } catch (error) {
        if (attempt === 1 || !this.isConcurrencyConflict(error)) {
          throw error;
        }
      }
    }

    throw new Error('Inventory rejected callback retry budget exhausted.');
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


