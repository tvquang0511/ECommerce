import {
  ObjectType,
  Field,
  ID,
  Float,
  GraphQLISODateTime,
  Int,
  Directive,
} from '@nestjs/graphql';
import { ProductStatusEnum } from './product-status.enum';
import { ProductCurrency } from '../constants/product-currency';

@ObjectType()
export class ProductImage {
  @Field()
  bucket!: string;

  @Field()
  objectKey!: string;

  @Field()
  contentType!: string;

  @Field(() => Int)
  size!: number;

  @Field(() => GraphQLISODateTime)
  uploadedAt!: Date;
}

@ObjectType()
@Directive('@key(fields: "id")')
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
  currency!: ProductCurrency;

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

  @Field(() => ProductImage, { nullable: true })
  coverImage?: ProductImage;

  @Field(() => [ProductImage], { nullable: true })
  galleryImages?: ProductImage[];
}

@ObjectType()
export class ProductUploadUrlPayload {
  @Field()
  uploadUrl!: string;

  @Field()
  objectKey!: string;

  @Field()
  bucket!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}

@ObjectType()
export class ProductDownloadUrlPayload {
  @Field()
  downloadUrl!: string;

  @Field()
  objectKey!: string;

  @Field()
  bucket!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}
