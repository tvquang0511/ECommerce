import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { CheckoutPricingService } from '../../services/checkout-pricing.service';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { CreateOrderFromCartCommand } from './create-order-from-cart.command';

@CommandHandler(CreateOrderFromCartCommand)
export class CreateOrderFromCartHandler
  implements ICommandHandler<CreateOrderFromCartCommand, OrderCommandResult>
{
  constructor(
    private readonly checkoutPricingService: CheckoutPricingService,
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: CreateOrderFromCartCommand): Promise<OrderCommandResult> {
    const pricingPreview = await this.checkoutPricingService.previewFromCart(
      command.buyerId,
      command.cartId,
    );

    const aggregate = OrderAggregate.createDraft({
      buyerId: command.buyerId,
      currency: pricingPreview.currency,
    });

    await this.eventStoreRepo.append(aggregate.id, 0, aggregate.uncommittedEvents);
    await this.eventBus.publishAll(aggregate.uncommittedEvents);

    return {
      orderId: aggregate.id,
      status: OrderStatus.DRAFT,
      version: 0,
      correlationId: command.idempotencyKey,
      message:
        'Skeleton create-order-from-cart handler ready. Replace placeholder integrations next.',
    };
  }
}
