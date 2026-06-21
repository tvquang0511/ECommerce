import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { CheckoutPricingService } from '../../services/checkout-pricing.service';
import { CreateOrderDirectCommand } from './create-order-direct.command';

@CommandHandler(CreateOrderDirectCommand)
export class CreateOrderDirectHandler
  implements ICommandHandler<CreateOrderDirectCommand, OrderCommandResult>
{
  constructor(
    private readonly checkoutPricingService: CheckoutPricingService,
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderDirectCommand): Promise<OrderCommandResult> {
    const pricingPreview = await this.checkoutPricingService.previewDirect(
      command.productId,
      command.quantity,
    );

    const aggregate = OrderAggregate.createDirect({
      buyerId: command.buyerId,
      productId: pricingPreview.productId,
      quantity: pricingPreview.quantity,
      currency: pricingPreview.currency,
    });

    await this.eventStoreRepo.append(aggregate.id, 0, aggregate.uncommittedEvents);
    await this.eventBus.publishAll(aggregate.uncommittedEvents);

    return {
      orderId: aggregate.id,
      status: OrderStatus.DRAFT,
      version: 0,
      correlationId: command.idempotencyKey,
      message: 'Direct order draft created successfully.',
    };
  }
}
