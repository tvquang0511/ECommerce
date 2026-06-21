export class MarkPaymentFailedCommand {
  constructor(
    public readonly orderId: string,
    public readonly expectedVersion: number,
    public readonly correlationId: string,
    public readonly reason?: string,
  ) {}
}
