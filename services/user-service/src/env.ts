import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load service-local .env (ignored by git). Keep this as the single place that touches dotenv.
dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
});

function parsePort(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseIntEnv(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseBoolEnv(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parsePort(process.env.PORT ?? '', 4001),
  DATABASE_URL: process.env.DATABASE_URL,

  CORS_ORIGIN: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '7d',

  BCRYPT_ROUNDS: parseIntEnv(process.env.BCRYPT_ROUNDS, 10),

  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? 'refresh_token',
  AUTH_COOKIE_SECURE: parseBoolEnv(process.env.AUTH_COOKIE_SECURE, envBoolDefaultSecure()),
  AUTH_COOKIE_SAME_SITE: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
  AUTH_COOKIE_PATH: process.env.AUTH_COOKIE_PATH ?? '/api/users/auth',

  APP_WEB_URL: process.env.APP_WEB_URL ?? 'http://localhost:3000',
} as const;

function envBoolDefaultSecure() {
  // In production behind HTTPS, cookies should be secure.
  return (process.env.NODE_ENV ?? 'development') === 'production';
}
