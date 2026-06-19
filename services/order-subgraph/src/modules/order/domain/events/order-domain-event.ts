import { OrderCancelledEvent } from './order-cancelled.event';
import { OrderConfirmedEvent } from './order-confirmed.event';
import { OrderCreatedFromCartEvent } from './order-created-from-cart.event';
import { OrderSubmittedEvent } from './order-submitted.event';

export type OrderDomainEvent =
  | OrderCreatedFromCartEvent
  | OrderSubmittedEvent
  | OrderConfirmedEvent
  | OrderCancelledEvent;
