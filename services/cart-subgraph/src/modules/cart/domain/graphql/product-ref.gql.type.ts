import { Directive, Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Product')
@Directive('@extends')
@Directive('@key(fields: "id")')
export class ProductRef {
  @Field(() => ID)
  @Directive('@external')
  id!: string;
}
