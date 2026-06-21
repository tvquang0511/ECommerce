import path from 'node:path';

import { defineConfig } from 'prisma/config';

process.loadEnvFile(path.resolve(__dirname, '.env'));

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.ORDER_DATABASE_URL ??
      'postgresql://postgres:postgres@localhost:5432/order',
  },
});
