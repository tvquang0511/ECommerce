export class OrderConfirmedEvent {
  readonly type = 'OrderConfirmed';

  constructor(public readonly orderId: string) {}
}
