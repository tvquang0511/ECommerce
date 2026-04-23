import { Controller, Get, NotFoundException, Param } from '@nestjs/common';

import { Product } from './product.type';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(): Product[] {
    return this.productsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string): Product {
    const product = this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }
}
