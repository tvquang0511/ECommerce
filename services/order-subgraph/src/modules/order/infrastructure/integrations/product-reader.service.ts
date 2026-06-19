import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductReaderService {
  async revalidateProducts(productIds: string[]): Promise<void> {
    void productIds;
  }
}
