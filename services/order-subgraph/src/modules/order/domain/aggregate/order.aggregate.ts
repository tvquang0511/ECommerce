import { randomUUID } from 'node:crypto';
import { AggregateRoot } from '@nestjs/cqrs';

import { OrderInventoryStatusEnum } from '../enums/order-inventory-status.enum';
import { OrderPaymentStatusEnum } from '../enums/order-payment-status.enum';
import { OrderStatusEnum } from '../enums/order-status.enum';
import { OrderCreatedFromCartEvent } from '../events/order-created-from-cart.event';
import { OrderDomainEvent } from '../events/order-domain-event';
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
      version: 0,
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
      version: 0,
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

    const event = new OrderSubmittedEvent(this.id);
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
}
