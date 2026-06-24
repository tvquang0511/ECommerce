import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';

import { CheckoutPricingService } from '../../services/checkout-pricing.service';
import { OrderCommandResult, OrderStatus } from '../../../graphql/order.gql.type';
import { OrderAggregate } from '../../../domain/aggregate/order.aggregate';
import { OrderItemSnapshot } from '../../../domain/value-objects/order-item.vo';
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
    private readonly checkoutPricingService: CheckoutPricingService,
    private readonly cartWriterService: CartWriterService,
  ) {}

  async execute(command: SubmitOrderCommand): Promise<OrderCommandResult> {
    const history = await this.eventStoreRepo.loadStream(command.orderId);
    const aggregate = OrderAggregate.rehydrate(history);

    const repriced = await this.checkoutPricingService.repriceDraftItems(
      aggregate.items.map((item) => item.toSnapshot()),
    );

    if (this.hasPricingChanges(aggregate, repriced)) {
      aggregate.reprice({
        items: repriced.items,
        sellerIds: repriced.sellerIds,
        totalAmount: repriced.totalAmount,
        currency: repriced.currency,
      });
    }

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

  private hasPricingChanges(
    aggregate: OrderAggregate,
    repriced: {
      items: OrderItemSnapshot[];
      sellerIds: string[];
      totalAmount: number;
      currency: string;
    },
  ): boolean {
    if (aggregate.totalAmount !== repriced.totalAmount || aggregate.currency !== repriced.currency) {
      return true;
    }

    const currentSellerIds = [...aggregate.sellerIds].sort();
    const nextSellerIds = [...repriced.sellerIds].sort();
    if (currentSellerIds.length !== nextSellerIds.length) {
      return true;
    }

    if (currentSellerIds.some((sellerId, index) => sellerId !== nextSellerIds[index])) {
      return true;
    }

    const currentItems = aggregate.items.map((item) => item.toSnapshot());
    if (currentItems.length !== repriced.items.length) {
      return true;
    }

    return currentItems.some((item, index) => {
      const next = repriced.items[index];
      return (
        item.lineId !== next.lineId ||
        item.productId !== next.productId ||
        item.sellerId !== next.sellerId ||
        item.titleSnapshot !== next.titleSnapshot ||
        (item.imageSnapshot ?? null) !== (next.imageSnapshot ?? null) ||
        item.quantity !== next.quantity ||
        item.unitPriceAmount !== next.unitPriceAmount ||
        item.currency !== next.currency
      );
    });
  }
}
