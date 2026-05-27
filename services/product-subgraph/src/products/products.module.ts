import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { CacheModule } from '../cache/cache.module';
import { MinioModule } from '../media/minio.module';
import { ProductsResolver } from './products.resolver';
import { ProductModel, ProductSchema } from './product.schema';
import { ProductsService } from './products.service';

@Module({
  imports: [
    AuthModule,
    CacheModule,
    MinioModule,
    MongooseModule.forFeature([
      { name: ProductModel.name, schema: ProductSchema },
    ]),
  ],
  providers: [ProductsService, ProductsResolver],
})
export class ProductsModule {}
