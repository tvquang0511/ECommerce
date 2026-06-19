import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export type RedisConfig = {
  url: string;
  maxDistinctItems: number;
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

    // lazyConnect keeps local dev + tests smooth; real ops will fail if Redis is down.
    this.client = new Redis(config.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  get maxDistinctItems(): number {
    return this.config.maxDistinctItems;
  }

  async getJson<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      throw new ServiceUnavailableException('Redis unavailable');
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const payload = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.set(key, payload, 'EX', ttlSeconds);
        return;
      }

      await this.client.set(key, payload);
    } catch {
      throw new ServiceUnavailableException('Redis unavailable');
    }
  }

  async del(keys: string[]): Promise<void> {
    try {
      if (keys.length === 0) return;
      await this.client.del(keys);
    } catch {
      throw new ServiceUnavailableException('Redis unavailable');
    }
  }
}
