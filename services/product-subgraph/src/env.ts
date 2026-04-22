import path from 'node:path';
import dotenv from 'dotenv';

// Load service-local .env (ignored by git).
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

function parsePort(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT ?? '', 4002),
} as const;
