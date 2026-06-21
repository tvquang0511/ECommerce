export class MarkPaymentAuthorizedCommand {
  constructor(
    public readonly orderId: string,
    public readonly expectedVersion: number,
    public readonly correlationId: string,
  ) {}
}
