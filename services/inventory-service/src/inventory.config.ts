import { registerAs } from '@nestjs/config';

export const inventoryConfig = registerAs('inventory', () => ({
  port: Number(process.env.PORT ?? 4010),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as
    | 'development'
    | 'production'
    | 'test',
}));
