# user-service

Auth/Users REST service.

- Stack: Node.js + TypeScript + Express + Prisma + PostgreSQL.
- Định hướng modules-first (giống TeamHub).

## Endpoints (Auth)
Mounted under: `/api/users/auth`

- `POST /register`
- `POST /login`
- `POST /2fa/verify` (only if login requires 2FA)
- `GET /me` (requires `Authorization: Bearer <accessToken>`)
- `POST /refresh` (uses httpOnly refresh cookie; body refreshToken is accepted as fallback)
- `POST /logout`
- `POST /forgot-password` (enqueues email; dev may return `devResetToken` if SMTP not set)
- `POST /reset-password`
- `POST /change-password` (requires `Authorization: Bearer <accessToken>`) — đổi mật khẩu khi đang đăng nhập (yêu cầu nhập mật khẩu hiện tại)

## Endpoints (Users)
Mounted under: `/api/users`

- `GET /me` (requires `Authorization: Bearer <accessToken>`) — lấy profile hiện tại
- `PATCH /me` (requires `Authorization: Bearer <accessToken>`) — cập nhật `displayName`
- `POST /me/avatar` (requires `Authorization: Bearer <accessToken>`) — upload avatar (multipart `avatar`, max 2MB)

## Static files
- `GET /api/users/files/avatars/<file>` — serve avatar đã upload (local disk)

## OpenAPI / Swagger
- `GET /openapi.json`
- `GET /api-docs`

Bạn có thể import `openapi.json` vào Postman để test nhanh.

## Dev

1) Start infra (Postgres)
- `make dev-up`

2) Configure env
- Copy `.env.example` -> `.env`

3) Migrate + generate Prisma client
- `pnpm --filter user-service prisma:migrate -- --name init`

4) Seed RBAC + demo users (recommended for local testing)
- Seed roles/permissions:
	- `pnpm -C services/user-service prisma:seed`
- Seed demo users (buyer/seller verified/admin):
	- `pnpm -C services/user-service prisma:seed:dev-users`
	- Default password: `DevPassword123!` (override via `DEV_SEED_PASSWORD`)

5) Run service
- `pnpm --filter user-service dev`

6) Run mail worker (SMTP + BullMQ)
- `pnpm --filter user-service worker:mail`

Default port: `4001`.

Xem spec: `docs/architecture/services.md` và template folder: `docs/architecture/folder-structure.md`.
