import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PRODUCT_STATUSES } from './product.schema';
import { Product } from './product.type';
import { ProductDocument, ProductModel } from './product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductModel.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(): Promise<Product[]> {
    const products = await this.productModel.find().exec();
    return products.map((product) => this.toProduct(product));
  }

  async findById(id: string): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    return product ? this.toProduct(product) : undefined;
  }

  async create(input: CreateProductDto): Promise<Product> {
    const nextId = await this.generateNextId();
    const slug = this.buildSlug(input.name, nextId);
    const product = await this.productModel.create({
      id: nextId,
      sellerId: input.sellerId,
      name: input.name,
      price: input.price,
      slug,
      status: 'DRAFT',
      categoryId: input.categoryId ?? null,
      tags: input.tags ?? [],
      attributes: input.attributes ?? {},
    });
    return this.toProduct(product);
  }

  async update(
    id: string,
    input: UpdateProductDto,
  ): Promise<Product | undefined> {
    const updatePayload = {
      ...input,
      ...(input.name ? { slug: this.buildSlug(input.name, id) } : {}),
    };

    const product = await this.productModel
      .findOneAndUpdate({ id }, updatePayload, {
        returnDocument: 'after',
        runValidators: true,
      })
      .exec();

    return product ? this.toProduct(product) : undefined;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.productModel.deleteOne({ id }).exec();
    return result.deletedCount > 0;
  }

  private toProduct(product: {
    id: string;
    sellerId: string;
    name: string;
    price: number;
    slug: string;
    status: (typeof PRODUCT_STATUSES)[number];
    categoryId?: string | null;
    tags?: string[];
    attributes?: Record<string, string | number | boolean | null>;
  }): Product {
    return {
      id: product.id,
      sellerId: product.sellerId,
      name: product.name,
      price: product.price,
      slug: product.slug,
      status: product.status,
      categoryId: product.categoryId ?? null,
      tags: product.tags ?? [],
      attributes: product.attributes ?? {},
    };
  }

  private buildSlug(name: string, suffix: string): string {
    const normalized = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `${normalized}-${suffix}`;
  }

  private async generateNextId(): Promise<string> {
    const products = await this.productModel.find({}, { id: 1 }).exec();
    const nextNumber = products.reduce((maxId, product) => {
      const match = /^p(\d+)$/.exec(product.id);
      if (!match) {
        return maxId;
      }

      return Math.max(maxId, Number(match[1]));
    }, 0);

    return `p${nextNumber + 1}`;
  }
}
