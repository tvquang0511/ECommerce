import { OrderCreatedFromCartOutboxHandler } from './order-created-from-cart/order-created-from-cart-outbox.handler';
import { OrderCreatedFromCartProjectorHandler } from './order-created-from-cart/order-created-from-cart-projector.handler';
import { OrderSubmittedOutboxHandler } from './order-submitted/order-submitted-outbox.handler';
import { OrderSubmittedProjectorHandler } from './order-submitted/order-submitted-projector.handler';

export const OrderEventHandlers = [
  OrderCreatedFromCartProjectorHandler,
  OrderCreatedFromCartOutboxHandler,
  OrderSubmittedProjectorHandler,
  OrderSubmittedOutboxHandler,
];
