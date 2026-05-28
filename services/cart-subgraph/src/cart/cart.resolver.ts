import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthActor } from '../auth/auth-actor.type';
import { AuthGuard } from '../auth/auth.guard';
import { OptionalAuthGuard } from '../auth/optional-auth.guard';
import { CurrentActor } from '../auth/decorators/current-actor.decorator';

import { Cart, CartItem } from './graphql/cart.type';
import {
  AddToCartInput,
  MergeCartInput,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from './graphql/cart.input';
import { ProductRef } from './graphql/product.type';
import { CartItemEntity, CartService } from './cart.service';

@Resolver(() => Cart)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => Cart, { name: 'cart', nullable: true })
  @UseGuards(OptionalAuthGuard)
  async cart(
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId: string | undefined,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<Cart | null> {
    return (await this.cartService.getCart(actor, sessionId)) as any;
  }

  @Mutation(() => Cart, { name: 'addToCart' })
  @UseGuards(OptionalAuthGuard)
  async addToCart(
    @Args('input') input: AddToCartInput,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<Cart> {
    return (await this.cartService.addToCart(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'updateCartItem' })
  @UseGuards(OptionalAuthGuard)
  async updateCartItem(
    @Args('input') input: UpdateCartItemInput,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<Cart> {
    return (await this.cartService.updateCartItem(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'removeCartItem' })
  @UseGuards(OptionalAuthGuard)
  async removeCartItem(
    @Args('input') input: RemoveCartItemInput,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<Cart> {
    return (await this.cartService.removeCartItem(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'clearCart' })
  @UseGuards(OptionalAuthGuard)
  async clearCart(
    @Args('sessionId', { type: () => String, nullable: true })
    sessionId: string | undefined,
    @CurrentActor() actor: AuthActor | null,
  ): Promise<Cart> {
    return (await this.cartService.clearCart(actor, sessionId)) as any;
  }

  @Mutation(() => Cart, { name: 'mergeCart' })
  @UseGuards(AuthGuard)
  async mergeCart(
    @Args('input') input: MergeCartInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<Cart> {
    return (await this.cartService.mergeCart(actor, input.fromSessionId)) as any;
  }
}

@Resolver(() => CartItem)
export class CartItemResolver {
  @ResolveField(() => ProductRef)
  product(@Parent() item: CartItemEntity): ProductRef {
    return { id: item.productId };
  }
}
