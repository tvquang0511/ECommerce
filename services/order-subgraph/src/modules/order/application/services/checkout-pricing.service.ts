import { Injectable } from '@nestjs/common';

import { CartReaderService } from '../../infrastructure/integrations/cart-reader.service';
import { ProductReaderService } from '../../infrastructure/integrations/product-reader.service';

@Injectable()
export class CheckoutPricingService {
  constructor(
    private readonly cartReader: CartReaderService,
    private readonly productReader: ProductReaderService,
  ) {}

  async previewFromCart(buyerId: string, cartId?: string) {
    await this.cartReader.readBuyerCart(buyerId, cartId);
    await this.productReader.revalidateProducts([]);

    return {
      currency: 'VND',
    };
  }

  async previewDirect(productId: string, quantity: number) {
    return this.productReader.previewDirectOrder(productId, quantity);
  }
}
