export class OrderPaymentFailedEvent {
  readonly type = 'OrderPaymentFailed';

  constructor(
    public readonly orderId: string,
    public readonly reason?: string,
  ) {}
}
