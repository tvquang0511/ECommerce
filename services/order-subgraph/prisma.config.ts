import path from 'node:path';
import { existsSync } from 'node:fs';

import { defineConfig } from 'prisma/config';

const envPath = path.resolve(__dirname, '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

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
