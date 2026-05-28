import { Field, ID, ObjectType } from '@nestjs/graphql';

// Federation-ready placeholder: later we can add @key/@external when switching to ApolloFederationDriver.
@ObjectType('Product')
export class ProductRef {
  @Field(() => ID)
  id!: string;
}
