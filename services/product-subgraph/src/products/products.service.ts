import { Injectable } from '@nestjs/common';

import { Product } from './product.model';

@Injectable()
export class ProductsService {
  private readonly products: Product[] = [
    { id: '1', name: 'Product #1', slug: 'product-1' },
    { id: '2', name: 'Product #2', slug: 'product-2' },
    { id: '3', name: 'Product #3', slug: 'product-3' },
  ];

  findAll(): Product[] {
    return this.products;
  }

  findById(id: string): Product | null {
    return this.products.find((p) => p.id === id) ?? null;
  }

  findBySlug(slug: string): Product | null {
    return this.products.find((p) => p.slug === slug) ?? null;
  }
}
