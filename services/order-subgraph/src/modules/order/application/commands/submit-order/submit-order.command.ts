export class SubmitOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly actorId: string,
    public readonly expectedVersion: number,
    public readonly idempotencyKey: string,
  ) {}
}
