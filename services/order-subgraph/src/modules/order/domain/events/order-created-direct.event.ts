import { OrderItemSnapshot } from '../value-objects/order-item.vo';

export class OrderCreatedDirectEvent {
  readonly type = 'OrderCreatedDirect';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly items: OrderItemSnapshot[],
    public readonly sellerIds: string[],
    public readonly totalAmount: number,
    public readonly currency: string,
  ) {}
}
