export class OrderInventoryReservedEvent {
  readonly type = 'OrderInventoryReserved';

  constructor(public readonly orderId: string) {}
}
