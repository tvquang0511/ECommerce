import { EventBus } from '@nestjs/cqrs';

import { SubmitOrderHandler } from '../application/commands/submit-order/submit-order.handler';
import { SubmitOrderCommand } from '../application/commands/submit-order/submit-order.command';
import { CheckoutPricingService } from '../application/services/checkout-pricing.service';
import { OrderAggregate } from '../domain/aggregate/order.aggregate';
import { OrderCreatedFromCartEvent } from '../domain/events/order-created-from-cart.event';
import { OrderRepricedEvent } from '../domain/events/order-repriced.event';
import { OrderSubmittedEvent } from '../domain/events/order-submitted.event';
import { OrderEventStoreRepo } from '../infrastructure/event-store/order-event-store.repo';
import { CartWriterService } from '../infrastructure/integrations/cart-writer.service';

describe('SubmitOrderHandler', () => {
  it('submits order and removes only selected cart items after success', async () => {
    const history = [
      new OrderCreatedFromCartEvent(
        'ord_test_submit_1',
        'buyer-1',
        [
          {
            lineId: 'line-1',
            productId: 'p1003',
            sellerId: 'seller-1',
            titleSnapshot: 'Dell UltraSharp 27 4K',
            imageSnapshot: 'products/p1003/cover.jpg',
            quantity: 1,
            unitPriceAmount: 11290000,
            currency: 'VND',
          },
        ],
        ['seller-1'],
        11290000,
        'VND',
        'cart-1',
        ['ci-1', 'ci-2'],
      ),
    ];

    const eventStoreRepo = {
      loadStream: jest.fn().mockResolvedValue(history),
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderEventStoreRepo>;

    const eventBus = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventBus>;

    const checkoutPricingService = {
      repriceDraftItems: jest.fn().mockResolvedValue({
        items: [
          {
            lineId: 'line-1',
            productId: 'p1003',
            sellerId: 'seller-1',
            titleSnapshot: 'Dell UltraSharp 27 4K',
            imageSnapshot: 'products/p1003/cover.jpg',
            quantity: 1,
            unitPriceAmount: 11290000,
            currency: 'VND',
          },
        ],
        sellerIds: ['seller-1'],
        totalAmount: 11290000,
        currency: 'VND',
      }),
    } as unknown as jest.Mocked<CheckoutPricingService>;

    const cartWriterService = {
      removeSelectedItems: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CartWriterService>;

    const handler = new SubmitOrderHandler(
      eventStoreRepo,
      eventBus,
      checkoutPricingService,
      cartWriterService,
    );

    const command = new SubmitOrderCommand(
      'ord_test_submit_1',
      'buyer-1',
      0,
      'submit-order-001',
      'token-123',
    );

    const result = await handler.execute(command);

    expect(eventStoreRepo.loadStream).toHaveBeenCalledWith('ord_test_submit_1');
    expect(eventStoreRepo.append).toHaveBeenCalledTimes(1);
    expect(eventBus.publishAll).toHaveBeenCalledTimes(1);
    expect(cartWriterService.removeSelectedItems).toHaveBeenCalledWith(
      'buyer-1',
      ['ci-1', 'ci-2'],
      'token-123',
    );

    const [, expectedVersion, events] = (eventStoreRepo.append as jest.Mock).mock.calls[0];
    expect(expectedVersion).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderSubmittedEvent);

    expect(result.orderId).toBe('ord_test_submit_1');
    expect(result.status).toBe(OrderAggregate.rehydrate([...history, ...events]).status);
    expect(result.version).toBe(1);
  });

  it('does not remove cart items when submit append fails', async () => {
    const history = [
      new OrderCreatedFromCartEvent(
        'ord_test_submit_2',
        'buyer-1',
        [],
        [],
        0,
        'VND',
        'cart-2',
        ['ci-3'],
      ),
    ];

    const eventStoreRepo = {
      loadStream: jest.fn().mockResolvedValue(history),
      append: jest.fn().mockRejectedValue(new Error('append failed')),
    } as unknown as jest.Mocked<OrderEventStoreRepo>;

    const eventBus = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventBus>;

    const checkoutPricingService = {
      repriceDraftItems: jest.fn().mockResolvedValue({
        items: [],
        sellerIds: [],
        totalAmount: 0,
        currency: 'VND',
      }),
    } as unknown as jest.Mocked<CheckoutPricingService>;

    const cartWriterService = {
      removeSelectedItems: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CartWriterService>;

    const handler = new SubmitOrderHandler(
      eventStoreRepo,
      eventBus,
      checkoutPricingService,
      cartWriterService,
    );

    await expect(
      handler.execute(
        new SubmitOrderCommand(
          'ord_test_submit_2',
          'buyer-1',
          0,
          'submit-order-002',
          'token-123',
        ),
      ),
    ).rejects.toThrow('append failed');

    expect(eventBus.publishAll).not.toHaveBeenCalled();
    expect(cartWriterService.removeSelectedItems).not.toHaveBeenCalled();
  });

  it('reprices draft before submit when product price changes', async () => {
    const history = [
      new OrderCreatedFromCartEvent(
        'ord_test_submit_3',
        'buyer-1',
        [
          {
            lineId: 'line-1',
            productId: 'p1003',
            sellerId: 'seller-1',
            titleSnapshot: 'Dell UltraSharp 27 4K',
            imageSnapshot: 'products/p1003/cover.jpg',
            quantity: 1,
            unitPriceAmount: 11290000,
            currency: 'VND',
          },
        ],
        ['seller-1'],
        11290000,
        'VND',
        'cart-3',
        ['ci-9'],
      ),
    ];

    const eventStoreRepo = {
      loadStream: jest.fn().mockResolvedValue(history),
      append: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderEventStoreRepo>;

    const eventBus = {
      publishAll: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventBus>;

    const checkoutPricingService = {
      repriceDraftItems: jest.fn().mockResolvedValue({
        items: [
          {
            lineId: 'line-1',
            productId: 'p1003',
            sellerId: 'seller-1',
            titleSnapshot: 'Dell UltraSharp 27 4K',
            imageSnapshot: 'products/p1003/cover.jpg',
            quantity: 1,
            unitPriceAmount: 10590000,
            currency: 'VND',
          },
        ],
        sellerIds: ['seller-1'],
        totalAmount: 10590000,
        currency: 'VND',
      }),
    } as unknown as jest.Mocked<CheckoutPricingService>;

    const cartWriterService = {
      removeSelectedItems: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<CartWriterService>;

    const handler = new SubmitOrderHandler(
      eventStoreRepo,
      eventBus,
      checkoutPricingService,
      cartWriterService,
    );

    await handler.execute(
      new SubmitOrderCommand(
        'ord_test_submit_3',
        'buyer-1',
        0,
        'submit-order-003',
        'token-123',
      ),
    );

    const [, , events] = (eventStoreRepo.append as jest.Mock).mock.calls[0];
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(OrderRepricedEvent);
    expect(events[1]).toBeInstanceOf(OrderSubmittedEvent);
  });
});


