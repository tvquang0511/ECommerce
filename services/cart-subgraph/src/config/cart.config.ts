import { registerAs } from '@nestjs/config';

export const cartConfig = registerAs('cart', () => ({
  productSubgraphBaseUrl:
    process.env.PRODUCT_SUBGRAPH_BASE_URL ?? 'http://localhost:4002',
  productRequestTimeoutMs: Number(process.env.PRODUCT_REQUEST_TIMEOUT_MS ?? 5000),

  defaultCurrency: process.env.CART_DEFAULT_CURRENCY ?? 'VND',
}));
