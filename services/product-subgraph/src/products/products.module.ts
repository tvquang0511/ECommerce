import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthContextService } from '../auth/auth-context.service';
import { ProductsController } from './products.controller';
import { ProductModel, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductModel.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ProductsController],
  providers: [ProductsService, AuthContextService],
})
export class ProductsModule {}
