import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@nestjs/cqrs';

import { OrderInventoryStatusEnum } from '../enums/order-inventory-status.enum';
import { OrderPaymentStatusEnum } from '../enums/order-payment-status.enum';
import { OrderStatusEnum } from '../enums/order-status.enum';
import { OrderCancelledEvent } from '../events/order-cancelled.event';
import { OrderConfirmedEvent } from '../events/order-confirmed.event';
import { OrderCreatedFromCartEvent } from '../events/order-created-from-cart.event';
import { OrderDomainEvent } from '../events/order-domain-event';
import { OrderInventoryRejectedEvent } from '../events/order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from '../events/order-inventory-reserved.event';
import { OrderPaymentAuthorizedEvent } from '../events/order-payment-authorized.event';
import { OrderPaymentFailedEvent } from '../events/order-payment-failed.event';
import { OrderSubmittedEvent } from '../events/order-submitted.event';

export class OrderAggregate extends AggregateRoot {
  public id: string;
  public buyerId: string;
  public currency: string;
  public status: OrderStatusEnum;
  public inventoryStatus: OrderInventoryStatusEnum;
  public paymentStatus: OrderPaymentStatusEnum;
  public version: number;
  public readonly uncommittedEvents: OrderDomainEvent[];

  private constructor(params: {
    id: string;
    buyerId: string;
    currency: string;
    status: OrderStatusEnum;
    inventoryStatus: OrderInventoryStatusEnum;
    paymentStatus: OrderPaymentStatusEnum;
    version: number;
    uncommittedEvents?: OrderDomainEvent[];
  }) {
    super();
    this.id = params.id;
    this.buyerId = params.buyerId;
    this.currency = params.currency;
    this.status = params.status;
    this.inventoryStatus = params.inventoryStatus;
    this.paymentStatus = params.paymentStatus;
    this.version = params.version;
    this.uncommittedEvents = params.uncommittedEvents ?? [];
  }

  static createDraft(params: { buyerId: string; currency: string }): OrderAggregate {
    const event = new OrderCreatedFromCartEvent(
      `ord_${randomUUID()}`,
      params.buyerId,
      params.currency,
    );

    const aggregate = new OrderAggregate({
      id: event.orderId,
      buyerId: event.buyerId,
      currency: event.currency,
      status: OrderStatusEnum.DRAFT,
      inventoryStatus: OrderInventoryStatusEnum.NOT_REQUESTED,
      paymentStatus: OrderPaymentStatusEnum.NOT_REQUESTED,
      version: -1,
      uncommittedEvents: [],
    });

    aggregate.uncommittedEvents.push(event);
    aggregate.apply(event);

    return aggregate;
  }

  static rehydrate(events: OrderDomainEvent[]): OrderAggregate {
    if (events.length === 0) {
      throw new Error('Cannot rehydrate order aggregate without events.');
    }

    const aggregate = new OrderAggregate({
      id: '',
      buyerId: '',
      currency: '',
      status: OrderStatusEnum.DRAFT,
      inventoryStatus: OrderInventoryStatusEnum.NOT_REQUESTED,
      paymentStatus: OrderPaymentStatusEnum.NOT_REQUESTED,
      version: -1,
    });

    events.forEach((event, index) => {
      aggregate.apply(event, true);
      aggregate.version = index;
    });

    return aggregate;
  }

  submit(): void {
    if (this.status !== OrderStatusEnum.DRAFT) {
      throw new Error('Only draft orders can be submitted.');
    }

    this.raise(new OrderSubmittedEvent(this.id));
  }

  cancel(reason?: string): void {
    if ([OrderStatusEnum.CONFIRMED, OrderStatusEnum.CANCELLED].includes(this.status)) {
      throw new Error(`Cannot cancel order in status ${this.status}.`);
    }

    this.raise(new OrderCancelledEvent(this.id, reason));
  }

  markInventoryReserved(): void {
    if (this.status === OrderStatusEnum.CANCELLED) {
      throw new Error('Cannot reserve inventory for a cancelled order.');
    }

    if (
      this.inventoryStatus === OrderInventoryStatusEnum.RESERVED ||
      this.status === OrderStatusEnum.CONFIRMED
    ) {
      return;
    }

    this.raise(new OrderInventoryReservedEvent(this.id));
    this.confirmIfReady();
  }

  markInventoryRejected(reason?: string): void {
    if (this.status === OrderStatusEnum.CANCELLED) {
      return;
    }

    this.raise(new OrderInventoryRejectedEvent(this.id, reason));
    this.raise(new OrderCancelledEvent(this.id, reason ?? 'Inventory reservation rejected.'));
  }

  markPaymentAuthorized(): void {
    if (this.status === OrderStatusEnum.CANCELLED) {
      throw new Error('Cannot authorize payment for a cancelled order.');
    }

    if (
      this.paymentStatus === OrderPaymentStatusEnum.AUTHORIZED ||
      this.status === OrderStatusEnum.CONFIRMED
    ) {
      return;
    }

    this.raise(new OrderPaymentAuthorizedEvent(this.id));
    this.confirmIfReady();
  }

  markPaymentFailed(reason?: string): void {
    if (this.status === OrderStatusEnum.CANCELLED) {
      return;
    }

    this.raise(new OrderPaymentFailedEvent(this.id, reason));
    this.raise(new OrderCancelledEvent(this.id, reason ?? 'Payment authorization failed.'));
  }

  private confirmIfReady(): void {
    const canConfirm =
      this.status === OrderStatusEnum.SUBMITTED &&
      this.inventoryStatus === OrderInventoryStatusEnum.RESERVED &&
      this.paymentStatus === OrderPaymentStatusEnum.AUTHORIZED;

    if (canConfirm) {
      this.raise(new OrderConfirmedEvent(this.id));
    }
  }

  private raise(event: OrderDomainEvent): void {
    this.version += 1;
    this.uncommittedEvents.push(event);
    this.apply(event);
  }

  onOrderCreatedFromCartEvent(event: OrderCreatedFromCartEvent): void {
    this.id = event.orderId;
    this.buyerId = event.buyerId;
    this.currency = event.currency;
    this.status = OrderStatusEnum.DRAFT;
    this.inventoryStatus = OrderInventoryStatusEnum.NOT_REQUESTED;
    this.paymentStatus = OrderPaymentStatusEnum.NOT_REQUESTED;
  }

  onOrderSubmittedEvent(_: OrderSubmittedEvent): void {
    this.status = OrderStatusEnum.SUBMITTED;
    this.inventoryStatus = OrderInventoryStatusEnum.PENDING;
    this.paymentStatus = OrderPaymentStatusEnum.PENDING;
  }

  onOrderInventoryReservedEvent(_: OrderInventoryReservedEvent): void {
    this.inventoryStatus = OrderInventoryStatusEnum.RESERVED;
  }

  onOrderInventoryRejectedEvent(_: OrderInventoryRejectedEvent): void {
    this.inventoryStatus = OrderInventoryStatusEnum.REJECTED;
    this.status = OrderStatusEnum.FAILED;
  }

  onOrderPaymentAuthorizedEvent(_: OrderPaymentAuthorizedEvent): void {
    this.paymentStatus = OrderPaymentStatusEnum.AUTHORIZED;
  }

  onOrderPaymentFailedEvent(_: OrderPaymentFailedEvent): void {
    this.paymentStatus = OrderPaymentStatusEnum.FAILED;
    this.status = OrderStatusEnum.FAILED;
  }

  onOrderConfirmedEvent(_: OrderConfirmedEvent): void {
    this.status = OrderStatusEnum.CONFIRMED;
  }

  onOrderCancelledEvent(_: OrderCancelledEvent): void {
    this.status = OrderStatusEnum.CANCELLED;
  }
}
