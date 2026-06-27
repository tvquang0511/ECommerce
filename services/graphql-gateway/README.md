# graphql-gateway

Apollo Federation Gateway viết bằng NestJS.

## Dev

- `pnpm --filter graphql-gateway install`
- `pnpm --filter graphql-gateway start:dev`

Default port: `4000`.

## Env

- `PRODUCT_SUBGRAPH_URL` mặc định `http://127.0.0.1:4002/graphql`
- `CART_SUBGRAPH_URL` mặc định `http://127.0.0.1:4003/graphql`
- `ORDER_SUBGRAPH_URL` mặc định `http://127.0.0.1:4004/graphql`
