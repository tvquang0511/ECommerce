import { OrderCancelledProjectorHandler } from './order-cancelled/order-cancelled-projector.handler';
import { OrderConfirmedProjectorHandler } from './order-confirmed/order-confirmed-projector.handler';
import { OrderCreatedDirectOutboxHandler } from './order-created-direct/order-created-direct-outbox.handler';
import { OrderCreatedDirectProjectorHandler } from './order-created-direct/order-created-direct-projector.handler';
import { OrderCreatedFromCartOutboxHandler } from './order-created-from-cart/order-created-from-cart-outbox.handler';
import { OrderCreatedFromCartProjectorHandler } from './order-created-from-cart/order-created-from-cart-projector.handler';
import { OrderInventoryRejectedProjectorHandler } from './order-inventory-rejected/order-inventory-rejected-projector.handler';
import { OrderInventoryReservedProjectorHandler } from './order-inventory-reserved/order-inventory-reserved-projector.handler';
import { OrderPaymentAuthorizedProjectorHandler } from './order-payment-authorized/order-payment-authorized-projector.handler';
import { OrderPaymentFailedProjectorHandler } from './order-payment-failed/order-payment-failed-projector.handler';
import { OrderSubmittedOutboxHandler } from './order-submitted/order-submitted-outbox.handler';
import { OrderSubmittedProjectorHandler } from './order-submitted/order-submitted-projector.handler';

export const OrderEventHandlers = [
  OrderCreatedDirectProjectorHandler,
  OrderCreatedDirectOutboxHandler,
  OrderCreatedFromCartProjectorHandler,
  OrderCreatedFromCartOutboxHandler,
  OrderSubmittedProjectorHandler,
  OrderSubmittedOutboxHandler,
  OrderCancelledProjectorHandler,
  OrderConfirmedProjectorHandler,
  OrderPaymentAuthorizedProjectorHandler,
  OrderPaymentFailedProjectorHandler,
  OrderInventoryReservedProjectorHandler,
  OrderInventoryRejectedProjectorHandler,
];
