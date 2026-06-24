import { OrderCancelledEvent } from './order-cancelled.event';
import { OrderConfirmedEvent } from './order-confirmed.event';
import { OrderCreatedFromCartEvent } from './order-created-from-cart.event';
import { OrderCreatedDirectEvent } from './order-created-direct.event';
import { OrderInventoryRejectedEvent } from './order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from './order-inventory-reserved.event';
import { OrderPaymentAuthorizedEvent } from './order-payment-authorized.event';
import { OrderPaymentFailedEvent } from './order-payment-failed.event';
import { OrderSubmittedEvent } from './order-submitted.event';
import { OrderEventEnvelope } from './order-event-envelope.type';

export type OrderDomainEvent =
  | (OrderCreatedFromCartEvent & OrderEventEnvelope)
  | (OrderCreatedDirectEvent & OrderEventEnvelope)
  | (OrderSubmittedEvent & OrderEventEnvelope)
  | (OrderInventoryReservedEvent & OrderEventEnvelope)
  | (OrderInventoryRejectedEvent & OrderEventEnvelope)
  | (OrderPaymentAuthorizedEvent & OrderEventEnvelope)
  | (OrderPaymentFailedEvent & OrderEventEnvelope)
  | (OrderConfirmedEvent & OrderEventEnvelope)
  | (OrderCancelledEvent & OrderEventEnvelope);
