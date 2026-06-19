import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service-local .env (ignored by git). Keep this as the single place that touches dotenv.
dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function parsePort(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT ?? '', 4000),
  PRODUCT_SUBGRAPH_URL:
    process.env.PRODUCT_SUBGRAPH_URL ?? 'http://127.0.0.1:4002/graphql',
  CART_SUBGRAPH_URL:
    process.env.CART_SUBGRAPH_URL ?? 'http://127.0.0.1:4003/graphql',

  // Example for later (auth):
  // JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
} as const;
