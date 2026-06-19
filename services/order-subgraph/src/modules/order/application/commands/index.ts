import { CancelOrderHandler } from './cancel-order/cancel-order.handler';
import { CreateOrderFromCartHandler } from './create-order-from-cart/create-order-from-cart.handler';
import { SubmitOrderHandler } from './submit-order/submit-order.handler';

export const OrderCommandHandlers = [
  CreateOrderFromCartHandler,
  SubmitOrderHandler,
  CancelOrderHandler,
];
