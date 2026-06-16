import { Field, Float, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Money {
  @Field(() => Float)
  amount!: number;

  @Field()
  currency!: string;
}
