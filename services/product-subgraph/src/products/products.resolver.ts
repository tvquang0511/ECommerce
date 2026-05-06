import { Args, Context, Mutation, Query, Resolver } from '@nestjs/graphql';
import { NotFoundException } from '@nestjs/common';

import { AuthContextService, RequestLike } from '../auth/auth-context.service';
import { CreateProductInput, UpdateProductInput } from './graphql/product.input';
import { Product as ProductGql } from './graphql/product.type';
import { ProductsService } from './products.service';

@Resolver(() => ProductGql)
export class ProductsResolver {
  constructor(
    private readonly productsService: ProductsService,
    private readonly authContextService: AuthContextService,
  ) {}

  @Query(() => [Product], { name: 'products' })
  async findAll(@Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql[]> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getOptionalActor(req);
    return this.productsService.findAll(actor) as any;
  }

  @Query(() => Product, { name: 'product' })
  async findById(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    return this.getOrThrow(id, req);
  }

  @Mutation(() => Product, { name: 'createProduct' })
  async create(
    @Args('input') input: CreateProductInput,
    @Context() ctxOrReq: { req: RequestLike } | RequestLike,
  ): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureVerifiedSeller(actor);
    return this.productsService.create(actor, input as any) as any;
  }

  @Mutation(() => Product, { name: 'updateProduct' })
  async update(
    @Args('id') id: string,
    @Args('input') input: UpdateProductInput,
    @Context() ctxOrReq: { req: RequestLike } | RequestLike,
  ): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    const product = await this.productsService.update(id, actor, input as any);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  @Mutation(() => Boolean, { name: 'deleteProduct' })
  async remove(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<boolean> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    const removed = await this.productsService.remove(id, actor);
    if (!removed) throw new NotFoundException(`Product ${id} not found`);
    return true;
  }

  @Mutation(() => Product, { name: 'submitProductForReview' })
  async submitForReview(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureVerifiedSeller(actor);
    const product = await this.productsService.submitForReview(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  @Mutation(() => Product, { name: 'approveProduct' })
  async approve(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureAdmin(actor);
    const product = await this.productsService.approve(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  @Mutation(() => Product, { name: 'rejectProduct' })
  async reject(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    this.authContextService.ensureAdmin(actor);
    const product = await this.productsService.reject(id);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  @Mutation(() => Product, { name: 'archiveProduct' })
  async archive(@Args('id') id: string, @Context() ctxOrReq: { req: RequestLike } | RequestLike): Promise<ProductGql> {
    const req = this.normalizeReq(ctxOrReq);
    const actor = await this.authContextService.getRequiredActor(req);
    const product = await this.productsService.archive(id, actor);
    if (!product) throw new NotFoundException(`Product ${id} not found`);
    return product as any;
  }

  private async getOrThrow(id: string, req: RequestLike): Promise<Product> {
    const actor = await this.authContextService.getOptionalActor(req);
    const product = await this.productsService.findById(id, actor);
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }

    return product;
  }

  private normalizeReq(ctxOrReq: { req: RequestLike } | RequestLike): RequestLike {
    // If tests or callers pass RequestLike directly, use it. Otherwise extract from GraphQL context
    if (ctxOrReq && typeof (ctxOrReq as RequestLike).header === 'function') {
      return ctxOrReq as RequestLike;
    }

    // otherwise assume shape { req }
    const maybe = ctxOrReq as { req?: RequestLike };
    if (!maybe || !maybe.req) {
      throw new Error('Request not found in GraphQL context');
    }

    return maybe.req;
  }
}
