function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const gatewayConfig = () => ({
  gateway: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parsePort(process.env.PORT, 4000),
    productSubgraphUrl:
      process.env.PRODUCT_SUBGRAPH_URL ?? 'http://127.0.0.1:4002/graphql',
    cartSubgraphUrl:
      process.env.CART_SUBGRAPH_URL ?? 'http://127.0.0.1:4003/graphql',
    orderSubgraphUrl:
      process.env.ORDER_SUBGRAPH_URL ?? 'http://127.0.0.1:4004/graphql',
  },
});
