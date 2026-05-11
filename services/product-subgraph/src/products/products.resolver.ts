import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException, UseGuards } from '@nestjs/common';

import { AuthActor } from '../auth/auth-actor.type';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { VerifiedSellerGuard } from '../auth/verified-seller.guard';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';
import { RequiresRoles } from '../auth/decorators/requires-roles.decorator';
import { RequiresVerifiedSeller } from '../auth/decorators/requires-verified-seller.decorator';
import {
  CreateProductInput,
  ProductMediaConfirmInput,
  ProductMediaUploadInput,
  UpdateProductInput,
} from './graphql/product.input';
import {
  Product as ProductGql,
  ProductDownloadUrlPayload,
  ProductUploadUrlPayload,
} from './graphql/product.type';
import { ProductsService } from './products.service';

@Resolver(() => ProductGql)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Query products (public, optional auth)
   * Returns products visible to the actor (filters based on status/permissions)
   */
  @Query(() => [ProductGql], { name: 'products' })
  async findAll(@CurrentActor() actor: AuthActor | null): Promise<ProductGql[]> {
    return this.productsService.findAll(actor) as any;
  }

  /**
   * Query product by ID (public, optional auth)
   * Returns product if visible to actor
   */
  @Query(() => ProductGql, { name: 'product' })
  async findById(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<ProductGql> {
    const product = await this.productsService.findById(id, actor);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product as any;
  }

  /**
   * Create presigned download URL for product media
   * Public if product is APPROVED, otherwise only seller/admin can access
   */
  @Query(() => ProductDownloadUrlPayload, { name: 'productMediaDownloadUrl' })
  async getMediaDownloadUrl(
    @Args('id') id: string,
    @Args('objectKey') objectKey: string,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<ProductDownloadUrlPayload> {
    const payload = await this.productsService.createMediaDownloadUrl(
      id,
      actor,
      objectKey,
    );

    if (!payload) throw new NotFoundException(`Product ${id} not found`);
    return payload as any;
  }

  /**
   * Create product (authenticated + verified seller required)
   * Only verified sellers can create products
   */
  @Mutation(() => ProductGql, { name: 'createProduct' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async create(
    @Args('input') input: CreateProductInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    return this.productsService.create(actor, input as any) as any;
  }

  /**
   * Update product (authenticated + verified seller required)
   * Seller can update their own products
   */
  @Mutation(() => ProductGql, { name: 'updateProduct' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async update(
    @Args('id') id: string,
    @Args('input') input: UpdateProductInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.update(id, actor, input as any);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Create presigned upload URL for product media (authenticated + verified seller required)
   */
  @Mutation(() => ProductUploadUrlPayload, { name: 'createProductMediaUploadUrl' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async createMediaUploadUrl(
    @Args('id') id: string,
    @Args('input') input: ProductMediaUploadInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductUploadUrlPayload> {
    const payload = await this.productsService.createMediaUploadUrl(
      id,
      actor,
      input as any,
    );

    if (!payload) throw new NotFoundException(`Product ${id} not found`);
    return payload as any;
  }

  /**
   * Confirm uploaded media and attach to product (authenticated + verified seller required)
   */
  @Mutation(() => ProductGql, { name: 'confirmProductMediaUpload' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async confirmMediaUpload(
    @Args('id') id: string,
    @Args('input') input: ProductMediaConfirmInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.confirmMediaUpload(
      id,
      actor,
      input as any,
    );

    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Remove media from product and MinIO (authenticated + verified seller required)
   */
  @Mutation(() => ProductGql, { name: 'removeProductMedia' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async removeMedia(
    @Args('id') id: string,
    @Args('objectKey') objectKey: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.removeMedia(id, actor, objectKey);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Delete product (authenticated + verified seller required)
   * Seller can delete their own products
   */
  @Mutation(() => Boolean, { name: 'deleteProduct' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async remove(@Args('id') id: string, @CurrentActor() actor: AuthActor): Promise<boolean> {
    const removed = await this.productsService.remove(id, actor);
    if (!removed) throw new NotFoundException(`Product ${id} not found`);
    return true;
  }

  /**
   * Submit product for review (authenticated + verified seller required)
   * Seller moves product from DRAFT to PENDING_REVIEW status
   */
  @Mutation(() => ProductGql, { name: 'submitProductForReview' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async submitForReview(
    @Args('id') id: string,
    @CurrentActor() actor: AuthActor,
  ): Promise<ProductGql> {
    const product = await this.productsService.submitForReview(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Approve product (authenticated + admin required)
   * Admin moves product from PENDING_REVIEW to APPROVED status
   */
  @Mutation(() => ProductGql, { name: 'approveProduct' })
  @UseGuards(AuthGuard, RolesGuard)
  @RequiresRoles('ADMIN_*')
  async approve(@Args('id') id: string): Promise<ProductGql> {
    const product = await this.productsService.approve(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Reject product (authenticated + admin required)
   * Admin moves product from PENDING_REVIEW to REJECTED status
   */
  @Mutation(() => ProductGql, { name: 'rejectProduct' })
  @UseGuards(AuthGuard, RolesGuard)
  @RequiresRoles('ADMIN_*')
  async reject(@Args('id') id: string): Promise<ProductGql> {
    const product = await this.productsService.reject(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  /**
   * Archive product (authenticated + verified seller required)
   * Seller archives their own products (soft delete)
   */
  @Mutation(() => ProductGql, { name: 'archiveProduct' })
  @UseGuards(AuthGuard, VerifiedSellerGuard)
  @RequiresVerifiedSeller()
  async archive(@Args('id') id: string, @CurrentActor() actor: AuthActor): Promise<ProductGql> {
    const product = await this.productsService.archive(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }
}
