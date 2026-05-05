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
  Req,
} from '@nestjs/common';

import { AuthContextService, RequestLike } from '../auth/auth-context.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product } from './product.type';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Get()
  async findAll(@Req() req: RequestLike): Promise<Product[]> {
    const actor = await this.authContextService.getOptionalActor(req);
    return this.productsService.findAll(actor);
  }

  @Get(':id')
  async findById(@Param('id') id: string, @Req() req: RequestLike): Promise<Product> {
    return this.getOrThrow(id, req);
  }

  @Post()
  async create(@Body() input: CreateProductDto, @Req() req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureVerifiedSeller(actor);
    return this.productsService.create(actor, input);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
    @Req() req: RequestLike,
  ): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    const product = await this.productsService.update(id, actor, input);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @Req() req: RequestLike): Promise<void> {
    const actor = await this.authContextService.getRequiredActor(req);
    const removed = await this.productsService.remove(id, actor);
    if (!removed) {
      throw new NotFoundException(`Product ${id} not found`);
    }
  }

  @Post(':id/submit')
  async submitForReview(@Param('id') id: string, @Req() req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureVerifiedSeller(actor);
    const product = await this.productsService.submitForReview(id, actor);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureAdmin(actor);
    const product = await this.productsService.approve(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureAdmin(actor);
    const product = await this.productsService.reject(id);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  @Post(':id/archive')
  async archive(@Param('id') id: string, @Req() req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getRequiredActor(req);
    const product = await this.productsService.archive(id, actor);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  private async getOrThrow(id: string, req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getOptionalActor(req);
    const product = await this.productsService.findById(id, actor);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }
}
