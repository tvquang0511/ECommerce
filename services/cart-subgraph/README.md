# cart-subgraph

Cart Subgraph (NestJS + GraphQL) quản lý giỏ hàng.

- Tài liệu đặc tả + report Redis/snapshot: `docs/README.md`
- GraphQL endpoint: `http://localhost:4003/graphql`
- Redis: primary store (không cần cache riêng cho cart)

## Quickstart

```bash
pnpm -w install
pnpm --filter cart-subgraph dev
```

## Env

Copy `services/cart-subgraph/.env.example` -> `services/cart-subgraph/.env` và điền các biến môi trường.

Biến quan trọng:
- `REDIS_URL`
- `CART_MAX_DISTINCT_ITEMS` (limit distinct items, default 99)
- `PRODUCT_SUBGRAPH_BASE_URL` (để snapshot khi add)
