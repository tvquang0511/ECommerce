import { Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsInt, IsOptional, IsPositive, IsString, Min } from 'class-validator';

@InputType()
export class AddToCartInput {
  @Field(() => ID)
  @IsString()
  productId!: string;

  @Field(() => Int)
  @IsInt()
  @IsPositive()
  quantity!: number;
}

@InputType()
export class UpdateCartItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  itemId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  productId?: string;

  @Field(() => Int)
  @IsInt()
  @Min(0)
  quantity!: number;
}

@InputType()
export class RemoveCartItemInput {
  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  itemId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  productId?: string;
}
