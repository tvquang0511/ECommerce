# Ecommerce Web (dev UI)

Next.js app used to exercise `user-service` auth flows.

## Env

- Copy `.env.example` → `.env` (or `.env.local`)
- Set `USER_SERVICE_URL` (default for local dev):
  - `http://localhost:4001`

This app uses a Next.js proxy route:

- Browser calls: `/api/users/*` (same-origin)
- Next.js forwards to: `${USER_SERVICE_URL}/api/users/*`

## Run

From repo root:

```bash
pnpm -C apps/web dev
```

Open http://localhost:3000
