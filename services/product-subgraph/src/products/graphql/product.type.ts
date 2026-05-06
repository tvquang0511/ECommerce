import { ObjectType, Field, ID, Float } from '@nestjs/graphql';
import { ProductStatusEnum } from './product-status.enum';

@ObjectType()
export class Product {
  @Field(() => ID)
  id: string;

  @Field()
  sellerId: string;

  @Field()
  name: string;

  @Field(() => Float)
  price: number;

  @Field()
  slug: string;

  @Field(() => ProductStatusEnum)
  status: ProductStatusEnum;

  @Field({ nullable: true })
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  tags?: string[];

  @Field(() => String, { nullable: true })
  description?: string;
}
