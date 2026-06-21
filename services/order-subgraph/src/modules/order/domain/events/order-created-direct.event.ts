export class OrderCreatedDirectEvent {
  readonly type = 'OrderCreatedDirect';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly currency: string,
  ) {}
}
