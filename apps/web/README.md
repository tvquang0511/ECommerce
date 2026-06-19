# Ecommerce Web (dev UI)

Next.js app used to exercise `user-service` and the federated GraphQL flow through `graphql-gateway`.

## Env

- Copy `.env.example` to `.env` or `.env.local`
- Set `USER_SERVICE_URL`
  - `http://localhost:4001`
- Set `GRAPHQL_GATEWAY_URL`
  - `http://localhost:4000`

This app uses Next.js proxy routes:

- Browser calls `/api/users/*`
- Next.js forwards to `${USER_SERVICE_URL}/api/users/*`
- Browser calls `/api/graphql`
- Next.js forwards to `${GRAPHQL_GATEWAY_URL}/graphql`

## Run

From repo root:

```bash
pnpm -C apps/web dev
```

Open http://localhost:3000
