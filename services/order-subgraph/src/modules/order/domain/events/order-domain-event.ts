import { OrderCancelledEvent } from './order-cancelled.event';
import { OrderConfirmedEvent } from './order-confirmed.event';
import { OrderCreatedFromCartEvent } from './order-created-from-cart.event';
import { OrderInventoryRejectedEvent } from './order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from './order-inventory-reserved.event';
import { OrderPaymentAuthorizedEvent } from './order-payment-authorized.event';
import { OrderPaymentFailedEvent } from './order-payment-failed.event';
import { OrderSubmittedEvent } from './order-submitted.event';

export type OrderDomainEvent =
  | OrderCreatedFromCartEvent
  | OrderSubmittedEvent
  | OrderInventoryReservedEvent
  | OrderInventoryRejectedEvent
  | OrderPaymentAuthorizedEvent
  | OrderPaymentFailedEvent
  | OrderConfirmedEvent
  | OrderCancelledEvent;
