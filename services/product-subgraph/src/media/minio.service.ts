import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';

type MinioConfig = {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  presignExpirySeconds: number;
};

@Injectable()
export class MinioService {
  private readonly client: Client;
  private readonly bucket: string;
  private readonly presignExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<MinioConfig>('minio');
    if (!config) {
      throw new Error('Missing MinIO configuration');
    }

    this.client = new Client({
      endPoint: config.endPoint,
      port: config.port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    this.bucket = config.bucket;
    this.presignExpirySeconds = config.presignExpirySeconds;
  }

  getBucket(): string {
    return this.bucket;
  }

  async presignPutObject(objectKey: string) {
    const url = await this.client.presignedPutObject(
      this.bucket,
      objectKey,
      this.presignExpirySeconds,
    );

    const expiresAt = new Date(Date.now() + this.presignExpirySeconds * 1000);

    return { url, expiresAt };
  }

  async removeObject(objectKey: string) {
    await this.client.removeObject(this.bucket, objectKey);
  }
}
