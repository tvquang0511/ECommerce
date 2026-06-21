import { OrderAggregate } from '../domain/aggregate/order.aggregate';
import { OrderStatusEnum } from '../domain/enums/order-status.enum';
import { OrderInventoryStatusEnum } from '../domain/enums/order-inventory-status.enum';
import { OrderPaymentStatusEnum } from '../domain/enums/order-payment-status.enum';
import { OrderCancelledEvent } from '../domain/events/order-cancelled.event';
import { OrderConfirmedEvent } from '../domain/events/order-confirmed.event';
import { OrderCreatedFromCartEvent } from '../domain/events/order-created-from-cart.event';
import { OrderInventoryRejectedEvent } from '../domain/events/order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from '../domain/events/order-inventory-reserved.event';
import { OrderPaymentAuthorizedEvent } from '../domain/events/order-payment-authorized.event';
import { OrderPaymentFailedEvent } from '../domain/events/order-payment-failed.event';
import { OrderSubmittedEvent } from '../domain/events/order-submitted.event';

describe('OrderAggregate', () => {
  it('creates a draft order from cart', () => {
    const aggregate = OrderAggregate.createDraft({
      buyerId: 'buyer-1',
      currency: 'VND',
    });

    expect(aggregate.status).toBe(OrderStatusEnum.DRAFT);
    expect(aggregate.inventoryStatus).toBe(OrderInventoryStatusEnum.NOT_REQUESTED);
    expect(aggregate.paymentStatus).toBe(OrderPaymentStatusEnum.NOT_REQUESTED);
    expect(aggregate.uncommittedEvents).toHaveLength(1);
    expect(aggregate.uncommittedEvents[0]).toBeInstanceOf(OrderCreatedFromCartEvent);
  });

  it('submits a draft order', () => {
    const aggregate = OrderAggregate.createDraft({
      buyerId: 'buyer-1',
      currency: 'VND',
    });

    aggregate.submit();

    expect(aggregate.status).toBe(OrderStatusEnum.SUBMITTED);
    expect(aggregate.inventoryStatus).toBe(OrderInventoryStatusEnum.PENDING);
    expect(aggregate.paymentStatus).toBe(OrderPaymentStatusEnum.PENDING);
    expect(aggregate.uncommittedEvents.at(-1)).toBeInstanceOf(OrderSubmittedEvent);
  });

  it('cancels an order before confirmation', () => {
    const aggregate = OrderAggregate.rehydrate([
      new OrderCreatedFromCartEvent('ord_test_1', 'buyer-1', 'VND'),
      new OrderSubmittedEvent('ord_test_1'),
    ]);

    aggregate.cancel('buyer changed mind');

    expect(aggregate.status).toBe(OrderStatusEnum.CANCELLED);
    expect(aggregate.uncommittedEvents.at(-1)).toBeInstanceOf(OrderCancelledEvent);
  });

  it('confirms the order when payment and inventory are both satisfied', () => {
    const aggregate = OrderAggregate.rehydrate([
      new OrderCreatedFromCartEvent('ord_test_2', 'buyer-1', 'VND'),
      new OrderSubmittedEvent('ord_test_2'),
    ]);

    aggregate.markInventoryReserved();
    aggregate.markPaymentAuthorized();

    expect(aggregate.inventoryStatus).toBe(OrderInventoryStatusEnum.RESERVED);
    expect(aggregate.paymentStatus).toBe(OrderPaymentStatusEnum.AUTHORIZED);
    expect(aggregate.status).toBe(OrderStatusEnum.CONFIRMED);
    expect(aggregate.uncommittedEvents.some((event) => event instanceof OrderConfirmedEvent)).toBe(
      true,
    );
  });

  it('fails and cancels the order when inventory is rejected', () => {
    const aggregate = OrderAggregate.rehydrate([
      new OrderCreatedFromCartEvent('ord_test_3', 'buyer-1', 'VND'),
      new OrderSubmittedEvent('ord_test_3'),
    ]);

    aggregate.markInventoryRejected('out of stock');

    expect(aggregate.inventoryStatus).toBe(OrderInventoryStatusEnum.REJECTED);
    expect(aggregate.status).toBe(OrderStatusEnum.CANCELLED);
    expect(
      aggregate.uncommittedEvents.some((event) => event instanceof OrderInventoryRejectedEvent),
    ).toBe(true);
    expect(
      aggregate.uncommittedEvents.some((event) => event instanceof OrderCancelledEvent),
    ).toBe(true);
  });

  it('fails and cancels the order when payment fails', () => {
    const aggregate = OrderAggregate.rehydrate([
      new OrderCreatedFromCartEvent('ord_test_4', 'buyer-1', 'VND'),
      new OrderSubmittedEvent('ord_test_4'),
    ]);

    aggregate.markPaymentFailed('card declined');

    expect(aggregate.paymentStatus).toBe(OrderPaymentStatusEnum.FAILED);
    expect(aggregate.status).toBe(OrderStatusEnum.CANCELLED);
    expect(
      aggregate.uncommittedEvents.some((event) => event instanceof OrderPaymentFailedEvent),
    ).toBe(true);
    expect(
      aggregate.uncommittedEvents.some((event) => event instanceof OrderCancelledEvent),
    ).toBe(true);
  });

  it('rehydrates the current state from event history', () => {
    const aggregate = OrderAggregate.rehydrate([
      new OrderCreatedFromCartEvent('ord_test_5', 'buyer-1', 'VND'),
      new OrderSubmittedEvent('ord_test_5'),
      new OrderInventoryReservedEvent('ord_test_5'),
      new OrderPaymentAuthorizedEvent('ord_test_5'),
      new OrderConfirmedEvent('ord_test_5'),
    ]);

    expect(aggregate.id).toBe('ord_test_5');
    expect(aggregate.status).toBe(OrderStatusEnum.CONFIRMED);
    expect(aggregate.inventoryStatus).toBe(OrderInventoryStatusEnum.RESERVED);
    expect(aggregate.paymentStatus).toBe(OrderPaymentStatusEnum.AUTHORIZED);
    expect(aggregate.uncommittedEvents).toHaveLength(0);
  });
});
