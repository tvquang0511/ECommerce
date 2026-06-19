export class OrderCreatedFromCartEvent {
  readonly type = 'OrderCreatedFromCart';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly currency: string,
  ) {}
}
