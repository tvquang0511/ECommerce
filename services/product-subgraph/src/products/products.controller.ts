import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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
    return this.getOrThrow(id);
  }

  @Post()
  create(@Body() input: CreateProductDto): Product {
    return this.productsService.create(input);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() input: UpdateProductDto): Product {
    const product = this.productsService.update(id, input);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id') id: string): void {
    const removed = this.productsService.remove(id);
    if (!removed) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  private getOrThrow(id: string): Product {
    const product = this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }
}
