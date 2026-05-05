import { registerAs } from '@nestjs/config';

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/product-subgraph';
const DEFAULT_PORT = 4002;
const DEFAULT_USER_SERVICE_BASE_URL = 'http://localhost:4001';

export const productConfig = registerAs('product', () => ({
  mongoUri: process.env.MONGO_URI ?? DEFAULT_MONGO_URI,
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  userServiceBaseUrl:
    process.env.USER_SERVICE_BASE_URL ?? DEFAULT_USER_SERVICE_BASE_URL,
  nodeEnv: process.env.NODE_ENV ?? 'development',
}));
