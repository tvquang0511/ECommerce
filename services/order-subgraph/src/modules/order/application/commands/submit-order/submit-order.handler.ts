import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { CartWriterService } from '../../../infrastructure/integrations/cart-writer.service';
import { SubmitOrderCommand } from './submit-order.command';

@CommandHandler(SubmitOrderCommand)
export class SubmitOrderHandler
  implements ICommandHandler<SubmitOrderCommand, OrderCommandResult>
{
  constructor(
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
    private readonly cartWriterService: CartWriterService,
  ) {}

  async execute(command: SubmitOrderCommand): Promise<OrderCommandResult> {
    const history = await this.eventStoreRepo.loadStream(command.orderId);
    const aggregate = OrderAggregate.rehydrate(history);

    aggregate.submit();

    await this.eventStoreRepo.append(
      aggregate.id,
      command.expectedVersion,
      aggregate.uncommittedEvents,
    );
    await this.eventBus.publishAll(aggregate.uncommittedEvents);
    await this.cartWriterService.removeSelectedItems(
      command.actorId,
      aggregate.selectedCartItemIds,
      command.accessToken,
    );

    return {
      orderId: command.orderId,
      status: aggregate.status as OrderStatus,
      version: aggregate.version,
      correlationId: command.idempotencyKey,
      message:
        'Submit-order command now follows the event-sourced flow. Wire inventory/payment consumers in the next phase.',
    };
  }
}
