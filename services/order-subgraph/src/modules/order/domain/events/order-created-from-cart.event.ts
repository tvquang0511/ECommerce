import { OrderItemSnapshot } from '../value-objects/order-item.vo';

export class OrderCreatedFromCartEvent {
  readonly type = 'OrderCreatedFromCart';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly items: OrderItemSnapshot[],
    public readonly sellerIds: string[],
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly cartId?: string,
  ) {}
}
