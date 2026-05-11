import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const PRODUCT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
] as const;

export const PRODUCT_CURRENCIES = ['VND', 'USD', 'JPY'] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export type ProductImage = {
  bucket: string;
  objectKey: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
};

@Schema({ versionKey: false })
export class ProductModel {
  @Prop({ required: true, unique: true, trim: true })
  id!: string;

  @Prop({ required: true, trim: true })
  sellerId!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, maxlength: 50 })
  sku!: string;

  @Prop({ type: String, trim: true, maxlength: 100, default: null })
  brand!: string | null;

  @Prop({ type: String, trim: true, maxlength: 300, default: null })
  shortDescription!: string | null;

  @Prop({ type: String, trim: true, maxlength: 5000, default: null })
  description!: string | null;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ type: Number, min: 0, default: null })
  salePrice!: number | null;

  @Prop({ required: true, enum: PRODUCT_CURRENCIES, default: 'VND' })
  currency!: (typeof PRODUCT_CURRENCIES)[number];

  @Prop({ required: true, unique: true, trim: true })
  slug!: string;

  @Prop({ required: true, enum: PRODUCT_STATUSES, default: 'DRAFT' })
  status!: ProductStatus;

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Date, default: null })
  archivedAt!: Date | null;

  @Prop({ type: Object, default: null })
  coverImage!: ProductImage | null;

  @Prop({ type: [Object], default: [] })
  galleryImages!: ProductImage[];

  @Prop({ type: String, trim: true, default: null })
  categoryId!: string | null;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Object, default: {} })
  attributes!: Record<string, string | number | boolean | null>;
}

export type ProductDocument = HydratedDocument<ProductModel>;

export const ProductSchema = SchemaFactory.createForClass(ProductModel);

ProductSchema.index({ sellerId: 1, status: 1 });
ProductSchema.index({ categoryId: 1, status: 1 });
ProductSchema.index({ sku: 1 }, { unique: true });
ProductSchema.index({ tags: 1 });
ProductSchema.index(
  { name: 'text', tags: 'text' },
  { weights: { name: 10, tags: 3 } },
);
