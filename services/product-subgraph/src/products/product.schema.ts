import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ versionKey: false })
export class ProductModel {
  @Prop({ required: true, unique: true, trim: true })
  id!: string;

  @Prop({ required: true, trim: true, maxlength: 120 })
  name!: string;

  @Prop({ required: true, min: 0 })
  price!: number;
}

export type ProductDocument = HydratedDocument<ProductModel>;

export const ProductSchema = SchemaFactory.createForClass(ProductModel);
