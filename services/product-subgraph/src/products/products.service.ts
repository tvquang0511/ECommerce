import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuthActor } from '../auth/auth-actor.type';
import { ProductCacheService } from '../cache/product-cache.service';
import { MinioService } from '../media/minio.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PRODUCT_STATUSES } from './product.schema';
import { type ProductCurrency } from './constants/product-currency';
import { Product, ProductImage } from './product.type';
import { ProductDocument, ProductModel } from './product.schema';

type ProductStatus = (typeof PRODUCT_STATUSES)[number];

type ProductUploadUrlPayload = {
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresAt: Date;
};

const STATUS_TRANSITIONS: Record<ProductStatus, ProductStatus[]> = {
  DRAFT: ['PENDING_REVIEW', 'ARCHIVED'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED', 'ARCHIVED'],
  APPROVED: ['ARCHIVED'],
  REJECTED: ['PENDING_REVIEW', 'ARCHIVED'],
  ARCHIVED: [],
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(ProductModel.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly minioService: MinioService,
    private readonly productCache: ProductCacheService,
  ) {}

  async findAll(actor: AuthActor | null): Promise<Product[]> {
    const cached = await this.productCache.getList(actor);
    if (cached) {
      return cached;
    }

    const query = this.buildVisibilityQuery(actor);
    const products = await this.productModel.find(query).exec();
    const result = products.map((product) => this.toProduct(product));

    await this.productCache.setList(actor, result);
    return result;
  }

  async findById(id: string, actor: AuthActor | null): Promise<Product | undefined> {
    const cached = await this.productCache.getDetail(actor, id);
    if (cached) {
      return cached;
    }

    const query = {
      id,
      ...this.buildVisibilityQuery(actor),
    };
    const product = await this.productModel.findOne(query).exec();
    if (!product) {
      return undefined;
    }

    const result = this.toProduct(product);
    await this.productCache.setDetail(actor, id, result);
    return result;
  }

  async create(actor: AuthActor, input: CreateProductDto): Promise<Product> {
    const nextId = await this.generateNextId();
    const slug = this.buildSlug(input.name, nextId);
    const product = await this.productModel.create({
      id: nextId,
      sellerId: actor.userId,
      name: input.name,
      sku: input.sku,
      brand: input.brand ?? null,
      shortDescription: input.shortDescription ?? null,
      description: input.description ?? null,
      price: input.price,
      salePrice: input.salePrice ?? null,
      currency: input.currency ?? 'VND',
      slug,
      status: 'DRAFT',
      publishedAt: null,
      archivedAt: null,
      coverImage: null,
      galleryImages: [],
      categoryId: input.categoryId ?? null,
      tags: input.tags ?? [],
      attributes: input.attributes ?? {},
    });
    await this.productCache.invalidateProduct(product.id, product.sellerId);
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

    if (product) {
      await this.productCache.invalidateProduct(product.id, product.sellerId);
      return this.toProduct(product);
    }

    return undefined;
  }

  async remove(id: string, actor: AuthActor): Promise<boolean> {
    const existing = await this.productModel.findOne({ id }).exec();
    if (!existing) {
      return false;
    }

    this.ensureCanManageProduct(actor, existing.sellerId);

    const objectKeys = this.collectMediaObjectKeys(existing);
    await Promise.all(
      objectKeys.map((objectKey) => this.minioService.removeObject(objectKey)),
    );

    await this.productCache.invalidateProduct(existing.id, existing.sellerId);

    const result = await this.productModel.deleteOne({ id }).exec();
    return result.deletedCount > 0;
  }

  async submitForReview(id: string, actor: AuthActor): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureStatusTransition(product.status, 'PENDING_REVIEW');

    product.status = 'PENDING_REVIEW';
    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async approve(id: string): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureStatusTransition(product.status, 'APPROVED');
    product.status = 'APPROVED';
    product.publishedAt = product.publishedAt ?? new Date();
    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async reject(id: string): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureStatusTransition(product.status, 'REJECTED');
    product.status = 'REJECTED';
    product.publishedAt = null;
    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async archive(id: string, actor: AuthActor): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureStatusTransition(product.status, 'ARCHIVED');

    product.status = 'ARCHIVED';
    product.archivedAt = new Date();
    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async createMediaUploadUrl(
    id: string,
    actor: AuthActor,
    input: { fileName: string; contentType: string },
  ): Promise<ProductUploadUrlPayload | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);

    if (product.status === 'ARCHIVED') {
      throw new BadRequestException('Archived product cannot be updated');
    }

    const objectKey = this.buildObjectKey(id, input.fileName);
    const presign = await this.minioService.presignPutObject(objectKey);

    return {
      uploadUrl: presign.url,
      objectKey,
      bucket: this.minioService.getBucket(),
      expiresAt: presign.expiresAt,
    };
  }

  async confirmMediaUpload(
    id: string,
    actor: AuthActor,
    input: {
      objectKey: string;
      contentType: string;
      size: number;
      kind: 'COVER' | 'GALLERY';
    },
  ): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureObjectKeyMatchesProduct(id, input.objectKey);

    if (product.status === 'ARCHIVED') {
      throw new BadRequestException('Archived product cannot be updated');
    }

    const image: ProductImage = {
      bucket: this.minioService.getBucket(),
      objectKey: input.objectKey,
      contentType: input.contentType,
      size: input.size,
      uploadedAt: new Date(),
    };

    if (input.kind === 'COVER') {
      product.coverImage = image;
    } else {
      const gallery = product.galleryImages ?? [];
      if (!gallery.some((item) => item.objectKey === input.objectKey)) {
        gallery.push(image);
      }
      product.galleryImages = gallery;
    }

    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async removeMedia(
    id: string,
    actor: AuthActor,
    objectKey: string,
  ): Promise<Product | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    this.ensureCanManageProduct(actor, product.sellerId);
    this.ensureObjectKeyMatchesProduct(id, objectKey);

    if (product.status === 'ARCHIVED') {
      throw new BadRequestException('Archived product cannot be updated');
    }

    const gallery = product.galleryImages ?? [];
    const nextGallery = gallery.filter((item) => item.objectKey !== objectKey);
    const removedFromGallery = nextGallery.length !== gallery.length;
    const removedCover = product.coverImage?.objectKey === objectKey;

    if (!removedFromGallery && !removedCover) {
      throw new BadRequestException('Media not found on product');
    }

    if (removedCover) {
      product.coverImage = null;
    }

    product.galleryImages = nextGallery;

    await this.minioService.removeObject(objectKey);
    await product.save();
    await this.productCache.invalidateProduct(product.id, product.sellerId);
    return this.toProduct(product);
  }

  async createMediaDownloadUrl(
    id: string,
    actor: AuthActor | null,
    objectKey: string,
  ): Promise<{ downloadUrl: string; objectKey: string; bucket: string; expiresAt: Date } | undefined> {
    const product = await this.productModel.findOne({ id }).exec();
    if (!product) {
      return undefined;
    }

    const canSee = this.isActorAllowedMediaAccess(actor, product);
    if (!canSee) {
      throw new ForbiddenException('You do not have access to this product media');
    }

    this.ensureObjectKeyMatchesProduct(id, objectKey);

    const hasMedia = this.collectMediaObjectKeys(product).includes(objectKey);
    if (!hasMedia) {
      throw new BadRequestException('Media not found on product');
    }

    const presign = await this.minioService.presignGetObject(objectKey);

    return {
      downloadUrl: presign.url,
      objectKey,
      bucket: this.minioService.getBucket(),
      expiresAt: presign.expiresAt,
    };
  }

  private toProduct(product: {
    id: string;
    sellerId: string;
    name: string;
    sku: string;
    brand?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    price: number;
    salePrice?: number | null;
    currency: ProductCurrency;
    slug: string;
    status: (typeof PRODUCT_STATUSES)[number];
    publishedAt?: Date | null;
    archivedAt?: Date | null;
    categoryId?: string | null;
    tags?: string[];
    attributes?: Record<string, string | number | boolean | null>;
    coverImage?: ProductImage | null;
    galleryImages?: ProductImage[];
  }): Product {
    return {
      id: product.id,
      sellerId: product.sellerId,
      name: product.name,
      sku: product.sku,
      brand: product.brand ?? null,
      shortDescription: product.shortDescription ?? null,
      description: product.description ?? null,
      price: product.price,
      salePrice: product.salePrice ?? null,
      currency: product.currency,
      slug: product.slug,
      status: product.status,
      publishedAt: product.publishedAt ?? null,
      archivedAt: product.archivedAt ?? null,
      categoryId: product.categoryId ?? null,
      tags: product.tags ?? [],
      attributes: product.attributes ?? {},
      coverImage: product.coverImage ?? null,
      galleryImages: product.galleryImages ?? [],
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

  private buildObjectKey(productId: string, fileName: string): string {
    const normalizedName = fileName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const safeName = normalizedName.length > 0 ? normalizedName : 'upload';
    return `products/${productId}/${Date.now()}-${randomUUID()}-${safeName}`;
  }

  private ensureObjectKeyMatchesProduct(productId: string, objectKey: string): void {
    const prefix = `products/${productId}/`;
    if (!objectKey.startsWith(prefix)) {
      throw new BadRequestException('Invalid object key for product');
    }
  }

  private collectMediaObjectKeys(product: {
    coverImage?: ProductImage | null;
    galleryImages?: ProductImage[];
  }): string[] {
    const keys = new Set<string>();

    if (product.coverImage?.objectKey) {
      keys.add(product.coverImage.objectKey);
    }

    for (const image of product.galleryImages ?? []) {
      if (image.objectKey) {
        keys.add(image.objectKey);
      }
    }

    return Array.from(keys);
  }

  private isActorAllowedMediaAccess(
    actor: AuthActor | null,
    product: { sellerId: string; status: ProductStatus },
  ): boolean {
    if (product.status === 'APPROVED') {
      return true;
    }

    if (!actor) {
      return false;
    }

    if (this.isAdmin(actor)) {
      return true;
    }

    return actor.userId === product.sellerId;
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
    nextStatus: ProductStatus,
  ): void {
    const allowedNextStatuses = STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedNextStatuses.includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${nextStatus}`,
      );
    }
  }

  private isAdmin(actor: AuthActor): boolean {
    return actor.roles.some(
      (role) => role.startsWith('ADMIN_') || role === 'SUPER_ADMIN',
    );
  }
}
