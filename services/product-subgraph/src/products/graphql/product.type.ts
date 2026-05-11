import { ObjectType, Field, ID, Float, GraphQLISODateTime } from '@nestjs/graphql';
import { ProductStatusEnum } from './product-status.enum';

@ObjectType()
export class Product {
  @Field(() => ID)
  id!: string;

  @Field()
  sellerId!: string;

  @Field()
  name!: string;

  @Field()
  sku!: string;

  @Field({ nullable: true })
  brand?: string;

  @Field({ nullable: true })
  shortDescription?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Float)
  price!: number;

  @Field(() => Float, { nullable: true })
  salePrice?: number;

  @Field()
  currency!: string;

  @Field()
  slug!: string;

  @Field(() => ProductStatusEnum)
  status!: ProductStatusEnum;

  @Field(() => GraphQLISODateTime, { nullable: true })
  publishedAt?: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  archivedAt?: Date;

  @Field({ nullable: true })
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];
}
