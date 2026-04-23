import { Injectable } from '@nestjs/common';

import { Product } from './product.type';

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    { id: 'p1', name: 'Keyboard', price: 49.9 },
    { id: 'p2', name: 'Mouse', price: 19.9 },
    { id: 'p3', name: 'Monitor', price: 199.0 },
  ];

  findAll(): Product[] {
    return this.products;
  }

  findById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }
}
