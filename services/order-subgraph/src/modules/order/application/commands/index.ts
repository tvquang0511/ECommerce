import { CancelOrderHandler } from './cancel-order/cancel-order.handler';
import { CreateOrderDirectHandler } from './create-order-direct/create-order-direct.handler';
import { CreateOrderFromCartHandler } from './create-order-from-cart/create-order-from-cart.handler';
import { MarkInventoryRejectedHandler } from './mark-inventory-rejected/mark-inventory-rejected.handler';
import { MarkInventoryReservedHandler } from './mark-inventory-reserved/mark-inventory-reserved.handler';
import { MarkPaymentAuthorizedHandler } from './mark-payment-authorized/mark-payment-authorized.handler';
import { MarkPaymentFailedHandler } from './mark-payment-failed/mark-payment-failed.handler';
import { SubmitOrderHandler } from './submit-order/submit-order.handler';

export const OrderCommandHandlers = [
  CreateOrderFromCartHandler,
  CreateOrderDirectHandler,
  SubmitOrderHandler,
  CancelOrderHandler,
  MarkInventoryReservedHandler,
  MarkInventoryRejectedHandler,
  MarkPaymentAuthorizedHandler,
  MarkPaymentFailedHandler,
];
