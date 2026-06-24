export class OrderPaymentAuthorizedEvent {
  readonly type = 'OrderPaymentAuthorized';

  constructor(public readonly orderId: string) {}
}
