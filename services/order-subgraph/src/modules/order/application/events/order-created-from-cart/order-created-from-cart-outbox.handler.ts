import { EventsHandler, IEventHandler } from '@nestjs/cqrs/dist';

import { OrderCreatedFromCartEvent } from '../../../domain/events/order-created-from-cart.event';
import { OrderOutboxRepo } from '../../../infrastructure/outbox/order-outbox.repo';

@EventsHandler(OrderCreatedFromCartEvent)
export class OrderCreatedFromCartOutboxHandler
  implements IEventHandler<OrderCreatedFromCartEvent>
{
  constructor(private readonly outboxRepo: OrderOutboxRepo) {}

  async handle(event: OrderCreatedFromCartEvent): Promise<void> {
    await this.outboxRepo.enqueue('order.created-from-cart', {
      orderId: event.orderId,
      buyerId: event.buyerId,
      items: event.items,
      sellerIds: event.sellerIds,
      totalAmount: event.totalAmount,
      currency: event.currency,
      cartId: event.cartId ?? null,
      selectedItemIds: event.selectedItemIds,
    });
  }
}

