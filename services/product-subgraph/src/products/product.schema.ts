import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export const PRODUCT_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'ARCHIVED',
] as const;

export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

@Schema({ versionKey: false })
export class ProductModel {
  @Prop({ required: true, unique: true, trim: true })
  id!: string;

  @Prop({ required: true, trim: true })
  sellerId!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, min: 0 })
  price!: number;

  @Prop({ required: true, unique: true, trim: true })
  slug!: string;

  @Prop({ required: true, enum: PRODUCT_STATUSES, default: 'DRAFT' })
  status!: ProductStatus;

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
ProductSchema.index({ tags: 1 });
ProductSchema.index(
  { name: 'text', tags: 'text' },
  { weights: { name: 10, tags: 3 } },
);
