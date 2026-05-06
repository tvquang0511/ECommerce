import { registerAs } from '@nestjs/config';

/**
 * Auth Configuration
 * - USER_SERVICE_BASE_URL: base URL của user-service
 * - AUTH_REQUEST_TIMEOUT_MS: timeout khi gọi user-service
 * - AUTH_ALLOW_TEST_HEADERS: cho phép dùng x-dev-* headers (chỉ nên bật trong test)
 */
export const authConfig = registerAs('auth', () => ({
  userServiceBaseUrl:
    process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001',

  requestTimeoutMs: Number(process.env.AUTH_REQUEST_TIMEOUT_MS ?? 5000),

  allowTestHeaders:
    process.env.AUTH_ALLOW_TEST_HEADERS === 'true' ||
    (process.env.NODE_ENV ?? 'development') === 'test',
}));
