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
  async findAll(): Promise<Product[]> {
    return this.productsService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Product> {
    return this.getOrThrow(id);
  }

  @Post()
  async create(@Body() input: CreateProductDto): Promise<Product> {
    return this.productsService.create(input);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productsService.update(id, input);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string): Promise<void> {
    const removed = await this.productsService.remove(id);
    if (!removed) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  private async getOrThrow(id: string): Promise<Product> {
    const product = await this.productsService.findById(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }
}
