# user-service

Auth/Users REST service.

- Stack: Node.js + TypeScript + Express + Prisma + PostgreSQL.
- Định hướng modules-first (giống TeamHub).

## Endpoints (Auth)
Mounted under: `/api/users/auth`

- `POST /register`
- `POST /login`
- `GET /me` (requires `Authorization: Bearer <accessToken>`)
- `POST /refresh` (uses httpOnly refresh cookie; body refreshToken is accepted as fallback)
- `POST /logout`
- `POST /forgot-password` (dev returns `devResetToken`)
- `POST /reset-password`

## OpenAPI / Swagger
- `GET /openapi.json`
- `GET /api-docs`

Bạn có thể import `openapi.json` vào Postman để test nhanh.

## Dev

1) Start infra (Postgres)
- `make deps-up`

2) Configure env
- Copy `.env.example` -> `.env`

3) Migrate + generate Prisma client
- `pnpm --filter user-service prisma:migrate -- --name init`

4) Run service
- `pnpm --filter user-service dev`

Default port: `4001`.

Xem spec: `docs/architecture/services.md` và template folder: `docs/architecture/folder-structure.md`.
