export class OrderCancelledEvent {
  readonly type = 'OrderCancelled';

  constructor(
    public readonly orderId: string,
    public readonly reason?: string,
  ) {}
}
