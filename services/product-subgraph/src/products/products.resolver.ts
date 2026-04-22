import { Args, Query, Resolver } from '@nestjs/graphql';

import { Product } from './product.model';
import { ProductsService } from './products.service';

@Resolver(() => Product)
export class ProductsResolver {
  constructor(private readonly productsService: ProductsService) {}

  @Query(() => String)
  ping(): string {
    return 'pong';
  }

  @Query(() => Product, { nullable: true })
  product(@Args('id') id: string): Product | null {
    return this.productsService.findById(id);
  }

  @Query(() => Product, { nullable: true })
  productBySlug(@Args('slug') slug: string): Product | null {
    return this.productsService.findBySlug(slug);
  }

  @Query(() => [Product])
  products(): Product[] {
    return this.productsService.findAll();
  }
}
