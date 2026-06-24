import { EventBus } from '@nestjs/cqrs';

import { CreateOrderFromCartHandler } from '../application/commands/create-order-from-cart/create-order-from-cart.handler';
import { CreateOrderFromCartCommand } from '../application/commands/create-order-from-cart/create-order-from-cart.command';
import { CheckoutPricingService, OrderPricingPreview } from '../application/services/checkout-pricing.service';
import { OrderCreatedFromCartEvent } from '../domain/events/order-created-from-cart.event';
import { OrderEventStoreRepo } from '../infrastructure/event-store/order-event-store.repo';

describe('CreateOrderFromCartHandler', () => {
  const pricingPreview: OrderPricingPreview = {
    items: [
      {
        lineId: 'line-1',
        productId: 'p1003',
        sellerId: 'seller-1',
        titleSnapshot: 'Dell UltraSharp 27 4K',
        imageSnapshot: 'products/p1003/cover.jpg',
        quantity: 2,
        unitPriceAmount: 11290000,
        currency: 'VND',
      },
    ],
    sellerIds: ['seller-1'],
    totalAmount: 22580000,
    currency: 'VND',
    cartId: 'cart-1',
  };

  it('creates a draft order from repriced cart snapshots', async () => {
    const checkoutPricingService = {
      previewFromCart: jest.fn().mockResolvedValue(pricingPreview),
    } as unknown as jest.Mocked<CheckoutPricingService>;

    const eventStoreRepo = {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderEventStoreRepo>;

    const eventBus = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventBus>;

    const handler = new CreateOrderFromCartHandler(
      checkoutPricingService,
      eventStoreRepo,
      eventBus,
    );

    const command = new CreateOrderFromCartCommand(
      'buyer-1',
      'cart-1',
      ['ci-1'],
      'order-create-001',
      'token-123',
    );

    const result = await handler.execute(command);

    expect(checkoutPricingService.previewFromCart).toHaveBeenCalledWith(
      'buyer-1',
      'token-123',
      'cart-1',
      ['ci-1'],
    );
    expect(eventStoreRepo.append).toHaveBeenCalledTimes(1);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

    const [, expectedVersion, events] = (eventStoreRepo.append as jest.Mock).mock.calls[0];
    expect(expectedVersion).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCreatedFromCartEvent);
    expect((events[0] as OrderCreatedFromCartEvent).items).toEqual(pricingPreview.items);
    expect((events[0] as OrderCreatedFromCartEvent).selectedItemIds).toEqual(['ci-1']);
    expect((events[0] as OrderCreatedFromCartEvent).sellerIds).toEqual(['seller-1']);
    expect((events[0] as OrderCreatedFromCartEvent).totalAmount).toBe(22580000);
    expect(eventBus.publishAll).toHaveBeenCalledWith(events);

    expect(result.status).toBe('DRAFT');
    expect(result.version).toBe(0);
    expect(result.correlationId).toBe('order-create-001');
    expect(result.message).toContain('repriced product snapshots');
    expect(result.orderId).toMatch(/^ord_/);
  });
});
