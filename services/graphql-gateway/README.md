# graphql-gateway

Apollo Federation Gateway (compose nhiều subgraph).

## Dev
- `pnpm --filter graphql-gateway install`
- `pnpm --filter graphql-gateway dev`

Default port: `4000`.

### Env
- `PRODUCT_SUBGRAPH_URL` (default: `http://127.0.0.1:4002/graphql`)
- `CART_SUBGRAPH_URL` (default: `http://127.0.0.1:4003/graphql`)
