import { Injectable } from '@nestjs/common';

export interface DirectProductPreview {
  productId: string;
  quantity: number;
  currency: string;
}

@Injectable()
export class ProductReaderService {
  async revalidateProducts(productIds: string[]): Promise<void> {
    void productIds;
  }

  async previewDirectOrder(productId: string, quantity: number): Promise<DirectProductPreview> {
    return {
      productId,
      quantity,
      currency: 'VND',
    };
  }
}
