import { Module } from '@nestjs/common';
import { MinioService } from '../modules/products/infrastructure/minio-product-media.service';

@Module({
  providers: [MinioService],
  exports: [MinioService],
})
export class MinioModule {}
