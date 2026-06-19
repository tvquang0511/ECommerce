import { Injectable } from '@nestjs/common';

@Injectable()
export class CartReaderService {
  async readBuyerCart(buyerId: string, cartId?: string): Promise<void> {
    void buyerId;
    void cartId;
  }
}
