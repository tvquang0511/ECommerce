export class CreateOrderFromCartCommand {
  constructor(
    public readonly buyerId: string,
    public readonly cartId: string | undefined,
    public readonly selectedItemIds: string[],
    public readonly idempotencyKey: string,
    public readonly accessToken?: string,
  ) {}
}
