import { OrderItemSnapshot } from '../value-objects/order-item.vo';

export class OrderRepricedEvent {
  readonly type = 'OrderRepriced';

  constructor(
    public readonly orderId: string,
    public readonly items: OrderItemSnapshot[],
    public readonly sellerIds: string[],
    public readonly totalAmount: number,
    public readonly currency: string,
    public readonly reason: string = 'Product data revalidated before submit.',
  ) {}
}
