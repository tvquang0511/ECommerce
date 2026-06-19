import { registerAs } from '@nestjs/config';

/**
 * Auth Configuration
 * - JWT_PRODUCT_PUBLIC_KEY_PEM_B64: Base64-encoded RS256 public key from user-service
 * - JWT_PRODUCT_PUBLIC_KEY_PEM: Raw PEM-formatted public key (fallback)
 * - USER_SERVICE_BASE_URL: base URL của user-service
 * - AUTH_REQUEST_TIMEOUT_MS: timeout khi gọi user-service
 * - AUTH_ALLOW_TEST_HEADERS: cho phép dùng x-dev-* headers (chỉ nên bật trong test)
 */
export const authConfig = registerAs('auth', () => ({
  // JWT Verification (RS256)
  jwtPublicKeyPemB64: process.env.JWT_PRODUCT_PUBLIC_KEY_PEM_B64,
  jwtPublicKeyPem: process.env.JWT_PRODUCT_PUBLIC_KEY_PEM,
  jwtAlgorithm: 'RS256',

  // User-service fallback (introspection)
  userServiceBaseUrl:
    process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001',

  requestTimeoutMs: Number(process.env.AUTH_REQUEST_TIMEOUT_MS ?? 5000),

  allowTestHeaders:
    process.env.AUTH_ALLOW_TEST_HEADERS === 'true' ||
    (process.env.NODE_ENV ?? 'development') === 'test',
}));
