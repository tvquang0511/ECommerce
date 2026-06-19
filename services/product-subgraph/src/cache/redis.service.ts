import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

type RedisConfig = {
  url: string;
  listTtlSeconds: number;
  detailTtlSeconds: number;
};

@Injectable()
export class RedisService {
  private readonly client: Redis;
  private readonly config: RedisConfig;

  constructor(private readonly configService: ConfigService) {
    const config = this.configService.get<RedisConfig>('redis');
    if (!config) {
      throw new Error('Missing Redis configuration');
    }

    this.config = config;
    this.client = new Redis(config.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  get listTtlSeconds(): number {
    return this.config.listTtlSeconds;
  }

  get detailTtlSeconds(): number {
    return this.config.detailTtlSeconds;
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    const payload = JSON.stringify(value);
    await this.client.set(key, payload, 'EX', ttlSeconds);
  }

  async del(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await this.client.del(keys);
  }
}
