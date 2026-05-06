import { registerAs } from '@nestjs/config';

/**
 * Application Configuration
 * Chứa các cấu hình chung cho app: port, environment, logging, CORS...
 */
export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT ?? 4002),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as
    | 'development'
    | 'production'
    | 'test',
}));
