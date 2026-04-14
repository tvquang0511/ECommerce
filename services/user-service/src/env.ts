import path from 'node:path';
import dotenv from 'dotenv';

// Load service-local .env (ignored by git).
// Keep this as the single place that touches dotenv.
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
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

  JWT_ACCESS_TTL: process.env.JWT_ACCESS_TTL ?? '15m',
  JWT_REFRESH_TTL: process.env.JWT_REFRESH_TTL ?? '7d',

  // Access token: RS256
  // Prefer *_B64 to avoid multi-line env issues on Windows.
  JWT_ACCESS_PRIVATE_KEY_PEM_B64: process.env.JWT_ACCESS_PRIVATE_KEY_PEM_B64,
  JWT_ACCESS_PUBLIC_KEY_PEM_B64: process.env.JWT_ACCESS_PUBLIC_KEY_PEM_B64,
  JWT_ACCESS_PRIVATE_KEY_PEM: process.env.JWT_ACCESS_PRIVATE_KEY_PEM,
  JWT_ACCESS_PUBLIC_KEY_PEM: process.env.JWT_ACCESS_PUBLIC_KEY_PEM,

  // Refresh token: opaque + stored hash (server-only pepper).
  REFRESH_TOKEN_PEPPER: process.env.REFRESH_TOKEN_PEPPER ?? 'dev-refresh-pepper',

  // 2FA email OTP
  TWO_FACTOR_OTP_TTL_SECONDS: parseIntEnv(process.env.TWO_FACTOR_OTP_TTL_SECONDS, 120),

  // Redis (BullMQ + optional rate limiting)
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // SMTP
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: parseIntEnv(process.env.SMTP_PORT, 587),
  SMTP_SECURE: parseBoolEnv(process.env.SMTP_SECURE, false),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM,

  BCRYPT_ROUNDS: parseIntEnv(process.env.BCRYPT_ROUNDS, 10),

  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME ?? 'refresh_token',
  AUTH_COOKIE_SECURE: parseBoolEnv(process.env.AUTH_COOKIE_SECURE, envBoolDefaultSecure()),
  AUTH_COOKIE_SAME_SITE: (process.env.AUTH_COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
  AUTH_COOKIE_PATH: process.env.AUTH_COOKIE_PATH ?? '/api/users/auth',

  APP_WEB_URL: process.env.APP_WEB_URL ?? 'http://localhost:3000',

  // MinIO / S3-compatible object storage (avatars)
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT ?? 'localhost',
  MINIO_PORT: parseIntEnv(process.env.MINIO_PORT, 9000),
  MINIO_USE_SSL: parseBoolEnv(process.env.MINIO_USE_SSL, false),
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY ?? 'minio',
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY ?? 'minio123456',
  MINIO_PUBLIC_BUCKET: process.env.MINIO_PUBLIC_BUCKET ?? 'user-public',
  // Public base URL that browsers can GET objects from (should match your MinIO port mapping)
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL ?? 'http://localhost:9000',
} as const;

function envBoolDefaultSecure() {
  // In production behind HTTPS, cookies should be secure.
  return (process.env.NODE_ENV ?? 'development') === 'production';
}
