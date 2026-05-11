import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  IsArray,
  IsEnum,
} from 'class-validator';
import { ProductMediaKind } from './product-media.enum';

const PRODUCT_CURRENCIES = ['VND', 'USD', 'JPY'] as const;

@InputType()
export class CreateProductInput {
  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @Field(() => Float)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field(() => Float, { nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_CURRENCIES)
  currency?: string;
}

@InputType()
export class UpdateProductInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @Field(() => Float, { nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  sku?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  shortDescription?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @Field(() => Float, { nullable: true })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  salePrice?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(PRODUCT_CURRENCIES)
  currency?: string;
}

@InputType()
export class ProductMediaUploadInput {
  @Field()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fileName!: string;

  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  contentType!: string;
}

@InputType()
export class ProductMediaConfirmInput {
  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  objectKey!: string;

  @Field()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  contentType!: string;

  @Field(() => Int)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  size!: number;

  @Field(() => ProductMediaKind)
  @IsEnum(ProductMediaKind)
  kind!: ProductMediaKind;
}
