import { Injectable } from '@nestjs/common';

import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { CheckoutPricingService } from '../../services/checkout-pricing.service';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderEventStoreRepo } from '../../../infrastructure/event-store/order-event-store.repo';
import { OrderProjectorService } from '../../../infrastructure/projections/order-projector.service';
import { CreateOrderFromCartCommand } from './create-order-from-cart.command';

@Injectable()
export class CreateOrderFromCartHandler {
  constructor(
    private readonly checkoutPricingService: CheckoutPricingService,
    private readonly eventStoreRepo: OrderEventStoreRepo,
    private readonly projector: OrderProjectorService,
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
    await this.projector.project(aggregate.uncommittedEvents);

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
