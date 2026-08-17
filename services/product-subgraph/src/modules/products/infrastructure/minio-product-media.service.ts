import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly presignExpirySeconds: number;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<MinioConfig>('minio');
    if (!config) {
      throw new Error('Missing MinIO configuration');
    }

    const protocol = config.useSSL ? "https" : "http";
    const endpoint = `${protocol}://${config.endPoint}${config.port && config.port !== 80 && config.port !== 443 ? `:${config.port}` : ""}`;

    this.client = new S3Client({
      region: 'ap-northeast-1',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
    });

    this.bucket = config.bucket;
    this.presignExpirySeconds = config.presignExpirySeconds;
  }

  getBucket(): string {
    return this.bucket;
  }

  async presignPutObject(objectKey: string) {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    
    const url = await getSignedUrl(this.client, command, { expiresIn: this.presignExpirySeconds });
    const expiresAt = new Date(Date.now() + this.presignExpirySeconds * 1000);

    return { url, expiresAt };
  }

  async presignGetObject(objectKey: string) {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn: this.presignExpirySeconds });
    const expiresAt = new Date(Date.now() + this.presignExpirySeconds * 1000);

    return { url, expiresAt };
  }

  async removeObject(objectKey: string) {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
    });
    await this.client.send(command);
  }
}
