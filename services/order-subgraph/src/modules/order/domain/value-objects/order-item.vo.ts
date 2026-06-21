import { MoneyVo } from './money.vo';

export interface OrderItemSnapshot {
  lineId: string;
  productId: string;
  sellerId: string;
  titleSnapshot: string;
  imageSnapshot?: string | null;
  quantity: number;
  unitPriceAmount: number;
  currency: string;
}

export class OrderItemVo {
  constructor(
    public readonly lineId: string,
    public readonly productId: string,
    public readonly sellerId: string,
    public readonly titleSnapshot: string,
    public readonly imageSnapshot: string | null,
    public readonly quantity: number,
    public readonly unitPrice: MoneyVo,
  ) {}

  get lineTotalAmount(): number {
    return this.quantity * this.unitPrice.amount;
  }

  toSnapshot(): OrderItemSnapshot {
    return {
      lineId: this.lineId,
      productId: this.productId,
      sellerId: this.sellerId,
      titleSnapshot: this.titleSnapshot,
      imageSnapshot: this.imageSnapshot,
      quantity: this.quantity,
      unitPriceAmount: this.unitPrice.amount,
      currency: this.unitPrice.currency,
    };
  }

  static fromSnapshot(snapshot: OrderItemSnapshot): OrderItemVo {
    return new OrderItemVo(
      snapshot.lineId,
      snapshot.productId,
      snapshot.sellerId,
      snapshot.titleSnapshot,
      snapshot.imageSnapshot ?? null,
      snapshot.quantity,
      new MoneyVo(snapshot.unitPriceAmount, snapshot.currency),
    );
  }
}
