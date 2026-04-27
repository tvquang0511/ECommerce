import { Injectable } from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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

  create(input: CreateProductDto): Product {
    const product: Product = {
      id: `p${this.products.length + 1}`,
      name: input.name,
      price: input.price,
    };

    this.products.push(product);
    return product;
  }

  update(id: string, input: UpdateProductDto): Product | undefined {
    const product = this.findById(id);
    if (!product) {
      return undefined;
    }

    if (input.name !== undefined) {
      product.name = input.name;
    }

    if (input.price !== undefined) {
      product.price = input.price;
    }

    return product;
  }

  remove(id: string): boolean {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) {
      return false;
    }

    this.products.splice(index, 1);
    return true;
  }
}
