export class CreateOrderDirectCommand {
  constructor(
    public readonly buyerId: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly idempotencyKey: string,
  ) {}
}
