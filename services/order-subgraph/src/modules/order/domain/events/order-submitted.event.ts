export class OrderSubmittedEvent {
  readonly type = 'OrderSubmitted';

  constructor(public readonly orderId: string) {}
}
