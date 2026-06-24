export class OrderInventoryRejectedEvent {
  readonly type = 'OrderInventoryRejected';

  constructor(
    public readonly orderId: string,
    public readonly reason?: string,
  ) {}
}
