import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuthActor } from '../auth/auth-actor.type';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PRODUCT_STATUSES } from './product.schema';
import { Product } from './product.type';
import { ProductDocument, ProductModel } from './product.schema';

type ProductStatus = (typeof PRODUCT_STATUSES)[number];

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductModel.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(actor: AuthActor | null): Promise<Product[]> {
    const query = this.buildVisibilityQuery(actor);
    const products = await this.productModel.find(query).exec();
    return products.map((product) => this.toProduct(product));
  }

  async findById(id: string, actor: AuthActor | null): Promise<Product | undefined> {
    const query = {
      id,
      ...this.buildVisibilityQuery(actor),
    };
    const product = await this.productModel.findOne(query).exec();
    return product ? this.toProduct(product) : undefined;
  }

  async create(actor: AuthActor, input: CreateProductDto): Promise<Product> {
    const nextId = await this.generateNextId();
    const slug = this.buildSlug(input.name, nextId);
    const product = await this.productModel.create({
      id: nextId,
      sellerId: actor.userId,
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
    actor: AuthActor,
    input: UpdateProductDto,
  ): Promise<Product | undefined> {
    const existing = await this.productModel.findOne({ id }).exec();
    if (!existing) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, existing.sellerId);

    if (existing.status === 'ARCHIVED') {
      throw new BadRequestException('Archived product cannot be updated');
    }

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

  async remove(id: string, actor: AuthActor): Promise<boolean> {
    const existing = await this.productModel.findOne({ id }).exec();
    if (!existing) {
      return false;
    }

    this.ensureCanManageProduct(actor, existing.sellerId);

    const result = await this.productModel.deleteOne({ id }).exec();
    return result.deletedCount > 0;
  }

  async submitForReview(id: string, actor: AuthActor): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureStatusTransition(product.status, ['DRAFT', 'REJECTED']);

    product.status = 'PENDING_REVIEW';
    await product.save();
    return this.toProduct(product);
  }

  async approve(id: string): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureStatusTransition(product.status, ['PENDING_REVIEW']);
    product.status = 'APPROVED';
    await product.save();
    return this.toProduct(product);
  }

  async reject(id: string): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureStatusTransition(product.status, ['PENDING_REVIEW']);
    product.status = 'REJECTED';
    await product.save();
    return this.toProduct(product);
  }

  async archive(id: string, actor: AuthActor): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureStatusTransition(product.status, [
      'DRAFT',
      'PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
    ]);

    product.status = 'ARCHIVED';
    await product.save();
    return this.toProduct(product);
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

  private buildVisibilityQuery(actor: AuthActor | null) {
    if (!actor) {
      return { status: 'APPROVED' };
    }

    if (this.isAdmin(actor)) {
      return {};
    }

    if (actor.roles.includes('SELLER')) {
      return {
        $or: [{ status: 'APPROVED' }, { sellerId: actor.userId }],
      };
    }

    return { status: 'APPROVED' };
  }

  private ensureCanManageProduct(actor: AuthActor, sellerId: string): void {
    if (this.isAdmin(actor)) {
      return;
    }

    if (actor.userId !== sellerId) {
      throw new ForbiddenException('You can only manage your own products');
    }
  }

  private ensureStatusTransition(
    currentStatus: ProductStatus,
    allowedCurrentStatuses: ProductStatus[],
  ): void {
    if (!allowedCurrentStatuses.includes(currentStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus}`,
      );
    }
  }

  private isAdmin(actor: AuthActor): boolean {
    return actor.roles.some(
      (role) => role.startsWith('ADMIN_') || role === 'SUPER_ADMIN',
    );
  }
}
