import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthContextService } from '../auth/auth-context.service';
import { ProductsResolver } from './products.resolver';
import { ProductModel, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductModel.name, schema: ProductSchema },
    ]),
  ],
  providers: [ProductsService, AuthContextService, ProductsResolver],
})
export class ProductsModule {}
