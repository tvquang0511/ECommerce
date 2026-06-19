import { registerAs } from '@nestjs/config';

export const minioConfig = registerAs('minio', () => ({
  endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
  port: Number(process.env.MINIO_PORT ?? 9000),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY ?? 'minio',
  secretKey: process.env.MINIO_SECRET_KEY ?? 'minio123456',
  bucket: process.env.MINIO_PRIVATE_BUCKET ?? 'product-private',
  presignExpirySeconds: Number(process.env.MINIO_PRESIGN_EXPIRY_SECONDS ?? 600),
}));
