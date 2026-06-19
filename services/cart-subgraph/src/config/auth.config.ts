import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtPublicKeyPemB64: process.env.JWT_CART_PUBLIC_KEY_PEM_B64,
  jwtPublicKeyPem: process.env.JWT_CART_PUBLIC_KEY_PEM,
  jwtAlgorithm: 'RS256',

  userServiceBaseUrl: process.env.USER_SERVICE_BASE_URL ?? 'http://localhost:4001',
  requestTimeoutMs: Number(process.env.AUTH_REQUEST_TIMEOUT_MS ?? 5000),

  allowTestHeaders:
    process.env.AUTH_ALLOW_TEST_HEADERS === 'true' ||
    (process.env.NODE_ENV ?? 'development') === 'test',
}));
