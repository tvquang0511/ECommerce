import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';

import { AuthActor } from '../../auth/auth.types';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { CurrentActor } from '../../auth/decorators/current-actor.decorator';

import { Cart, CartItem } from '../domain/graphql/cart.gql.type';
import {
  AddToCartInput,
  RemoveCartItemInput,
  UpdateCartItemInput,
} from '../domain/graphql/cart.input';
import { ProductRef } from '../domain/graphql/product-ref.gql.type';
import { CartItemEntity, CartService } from '../application/cart.service';

@Resolver(() => Cart)
export class CartResolver {
  constructor(private readonly cartService: CartService) {}

  @Query(() => Cart, { name: 'cart', nullable: true })
  @UseGuards(AuthGuard)
  async cart(@CurrentActor() actor: AuthActor): Promise<Cart | null> {
    return (await this.cartService.getCart(actor)) as any;
  }

  @Mutation(() => Cart, { name: 'addToCart' })
  @UseGuards(AuthGuard)
  async addToCart(
    @Args('input') input: AddToCartInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<Cart> {
    return (await this.cartService.addToCart(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'updateCartItem' })
  @UseGuards(AuthGuard)
  async updateCartItem(
    @Args('input') input: UpdateCartItemInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<Cart> {
    return (await this.cartService.updateCartItem(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'removeCartItem' })
  @UseGuards(AuthGuard)
  async removeCartItem(
    @Args('input') input: RemoveCartItemInput,
    @CurrentActor() actor: AuthActor,
  ): Promise<Cart> {
    return (await this.cartService.removeCartItem(actor, input)) as any;
  }

  @Mutation(() => Cart, { name: 'clearCart' })
  @UseGuards(AuthGuard)
  async clearCart(@CurrentActor() actor: AuthActor): Promise<Cart> {
    return (await this.cartService.clearCart(actor)) as any;
  }
}

@Resolver(() => CartItem)
export class CartItemResolver {
  @ResolveField(() => ProductRef)
  product(@Parent() item: CartItemEntity): ProductRef {
    return { __typename: 'Product', id: item.productId } as any;
  }
}
