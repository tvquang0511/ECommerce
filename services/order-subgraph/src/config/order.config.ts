import { registerAs } from '@nestjs/config';

export const orderConfig = registerAs('order', () => ({
  defaultCurrency: process.env.ORDER_DEFAULT_CURRENCY ?? 'VND',
  cartSubgraphBaseUrl: process.env.CART_SUBGRAPH_BASE_URL ?? 'http://localhost:4003',
  productSubgraphBaseUrl:
    process.env.PRODUCT_SUBGRAPH_BASE_URL ?? 'http://localhost:4002',
  inventoryServiceBaseUrl:
    process.env.INVENTORY_SERVICE_BASE_URL ?? 'http://localhost:4010',
  databaseUrl:
    process.env.ORDER_DATABASE_URL ??
    'postgresql://postgres:postgres@localhost:5432/ecommerce',
}));
