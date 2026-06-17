export class CancelOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly actorId: string,
    public readonly expectedVersion: number,
    public readonly idempotencyKey: string,
    public readonly reason?: string,
  ) {}
}
