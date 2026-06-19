import {
  Field,
  GraphQLISODateTime,
  ID,
  Int,
  ObjectType,
} from '@nestjs/graphql';

import { Money } from './money.gql.type';
import { ProductRef } from './product-ref.gql.type';

@ObjectType()
export class CartTotals {
  @Field(() => Money)
  subtotal!: Money;

  @Field(() => Money)
  discount!: Money;

  @Field(() => Money)
  tax!: Money;

  @Field(() => Money)
  total!: Money;
}

@ObjectType()
export class CartItem {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  productId!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Money)
  unitPrice!: Money;

  @Field()
  titleSnapshot!: string;

  @Field({ nullable: true })
  imageSnapshot?: string;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;

  // Federation reference to Product (resolved by gateway)
  @Field(() => ProductRef)
  product!: ProductRef;
}

@ObjectType()
export class Cart {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  userId!: string;

  @Field(() => [CartItem])
  items!: CartItem[];

  @Field(() => CartTotals)
  totals!: CartTotals;

  @Field()
  currency!: string;

  @Field(() => GraphQLISODateTime)
  updatedAt!: Date;
}
