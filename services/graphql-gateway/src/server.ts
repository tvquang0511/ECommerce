import { env } from './env.js';
import { createApp } from './app.js';

try {
  const { httpServer } = await createApp();

  await new Promise<void>((resolve) => {
    httpServer.listen(env.PORT, resolve);
  });

  const url = `http://localhost:${env.PORT}/graphql`;

  console.log(`graphql-gateway running at ${url}`);
  console.log(`NODE_ENV=${env.NODE_ENV}`);
  console.log(`composing subgraph: product -> ${env.PRODUCT_SUBGRAPH_URL}`);
  console.log(`composing subgraph: cart    -> ${env.CART_SUBGRAPH_URL}`);
} catch (err) {
  console.error('[graphql-gateway] Failed to start.');
  console.error(
    `[graphql-gateway] Are subgraphs running? product=${env.PRODUCT_SUBGRAPH_URL} cart=${env.CART_SUBGRAPH_URL}`,
  );
  throw err;
}
