import { GetOrderHandler } from './get-order/get-order.handler';
import { ListMyOrdersHandler } from './list-my-orders/list-my-orders.handler';

export const OrderQueryHandlers = [GetOrderHandler, ListMyOrdersHandler];
