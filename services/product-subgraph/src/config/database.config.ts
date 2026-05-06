import { registerAs } from '@nestjs/config';

/**
 * Database Configuration
 * Chứa MongoDB URI và Mongoose options
 * Tách riêng để dễ quản lý và extend trong tương lai
 */
export const databaseConfig = registerAs('database', () => ({
  mongoUri:
    process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/product-subgraph',
}));
