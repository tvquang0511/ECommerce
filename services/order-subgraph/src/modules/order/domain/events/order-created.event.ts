export class OrderCreatedEvent {
  readonly type = 'OrderCreated';

  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly currency: string,
  ) {}
}
