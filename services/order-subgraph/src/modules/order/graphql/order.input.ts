import { Field, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsString, Length, Min } from 'class-validator';

@InputType()
export class CreateOrderFromCartInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 128)
  cartId?: string;

  @Field()
  @IsString()
  @Length(3, 128)
  idempotencyKey!: string;
}

@InputType()
export class SubmitOrderInput {
  @Field()
  @IsString()
  orderId!: string;

  @Field(() => Int)
  @Min(0)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(3, 128)
  idempotencyKey!: string;
}

@InputType()
export class CancelOrderInput {
  @Field()
  @IsString()
  orderId!: string;

  @Field(() => Int)
  @Min(0)
  expectedVersion!: number;

  @Field()
  @IsString()
  @Length(3, 128)
  idempotencyKey!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  reason?: string;
}
