import { EventBus } from '@nestjs/cqrs';

import { CreateOrderDirectCommand } from '../application/commands/create-order-direct/create-order-direct.command';
import { CreateOrderDirectHandler } from '../application/commands/create-order-direct/create-order-direct.handler';
import { CheckoutPricingService, OrderPricingPreview } from '../application/services/checkout-pricing.service';
import { OrderCreatedDirectEvent } from '../domain/events/order-created-direct.event';
import { OrderEventStoreRepo } from '../infrastructure/event-store/order-event-store.repo';

describe('CreateOrderDirectHandler', () => {
  const pricingPreview: OrderPricingPreview = {
    items: [
      {
        lineId: 'line-1',
        productId: 'p1006',
        sellerId: 'seller-2',
        titleSnapshot: 'Webcam Full HD',
        imageSnapshot: 'products/p1006/cover.jpg',
        quantity: 1,
        unitPriceAmount: 1290000,
        currency: 'VND',
      },
    ],
    sellerIds: ['seller-2'],
    totalAmount: 1290000,
    currency: 'VND',
  };

  it('creates a direct draft order from live product pricing', async () => {
    const checkoutPricingService = {
      previewDirect: jest.fn().mockResolvedValue(pricingPreview),
    } as unknown as jest.Mocked<CheckoutPricingService>;

    const eventStoreRepo = {
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderEventStoreRepo>;

    const eventBus = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventBus>;

    const handler = new CreateOrderDirectHandler(
      checkoutPricingService,
      eventStoreRepo,
      eventBus,
    );

    const command = new CreateOrderDirectCommand(
      'buyer-2',
      'p1006',
      1,
      'order-direct-001',
    );

    const result = await handler.execute(command);

    expect(checkoutPricingService.previewDirect).toHaveBeenCalledWith('p1006', 1);
    expect(eventStoreRepo.append).toHaveBeenCalledTimes(1);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);

    const [, expectedVersion, events] = (eventStoreRepo.append as jest.Mock).mock.calls[0];
    expect(expectedVersion).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderCreatedDirectEvent);
    expect((events[0] as OrderCreatedDirectEvent).items).toEqual(pricingPreview.items);
    expect((events[0] as OrderCreatedDirectEvent).sellerIds).toEqual(['seller-2']);
    expect((events[0] as OrderCreatedDirectEvent).totalAmount).toBe(1290000);
    expect(eventBus.publishAll).toHaveBeenCalledWith(events);

    expect(result.status).toBe('DRAFT');
    expect(result.version).toBe(0);
    expect(result.correlationId).toBe('order-direct-001');
    expect(result.message).toContain('Direct order draft created successfully');
    expect(result.orderId).toMatch(/^ord_/);
  });
});


