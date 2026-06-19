import { MoneyVo } from './money.vo';

export class OrderItemVo {
  constructor(
    public readonly lineId: string,
    public readonly productId: string,
    public readonly sellerId: string,
    public readonly titleSnapshot: string,
    public readonly quantity: number,
    public readonly unitPrice: MoneyVo,
  ) {}
}
