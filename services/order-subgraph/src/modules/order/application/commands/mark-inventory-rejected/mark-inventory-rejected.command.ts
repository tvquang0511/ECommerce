export class MarkInventoryRejectedCommand {
  constructor(
    public readonly orderId: string,
    public readonly expectedVersion: number,
    public readonly correlationId: string,
    public readonly reason?: string,
  ) {}
}
