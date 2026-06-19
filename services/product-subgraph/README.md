# product-subgraph

`product-subgraph` là service catalog của hệ thống marketplace. Service này dùng **NestJS + GraphQL + MongoDB (Mongoose)** theo hướng tối giản:

`resolver -> service -> model`

## Purpose

- Quản lý product catalog.
- Cung cấp CRUD cho sản phẩm.
- Chuẩn bị nền cho search, approval flow, RBAC và GraphQL federation về sau.

## Current architecture

- Framework: NestJS
- Persistence: MongoDB qua Mongoose
- Test: unit test + E2E test với `mongodb-memory-server`
- Style: async/await, không repository layer cho giai đoạn hiện tại

## Runtime config

- App
	- `PORT` (default `4002`)
	- `NODE_ENV` (`development` | `test` | `production`)

- Database
	- `MONGO_URI` (default `mongodb://127.0.0.1:27017/product-subgraph`)

- Auth (resolve identity via user-service)
	- `USER_SERVICE_BASE_URL` (default `http://localhost:4001`)
	- `AUTH_REQUEST_TIMEOUT_MS` (default `5000`)
	- `AUTH_ALLOW_TEST_HEADERS` (default `false`, bật để dùng `x-dev-*` headers)

## GraphQL API

- Endpoint: `POST /graphql`
- Queries
	- `products`
	- `product(id)`
	- `productMediaDownloadUrl(id, objectKey)`
- Mutations
	- `createProduct(input)`
	- `updateProduct(id, input)`
	- `deleteProduct(id)`
	- `submitProductForReview(id)`
	- `approveProduct(id)`
	- `rejectProduct(id)`
	- `archiveProduct(id)`
	- `createProductMediaUploadUrl(id, input)`
	- `confirmProductMediaUpload(id, input)`
	- `removeProductMedia(id, objectKey)`

## Core files

- `src/app.module.ts`
- `src/products/products.module.ts`
- `src/products/products.resolver.ts`
- `src/products/products.service.ts`
- `src/products/product.schema.ts`
- `src/products/dto/create-product.dto.ts`
- `src/products/dto/update-product.dto.ts`

## Documentation

Start here:
- [Docs index](docs/README.md)

Main docs:
- [Architecture Analysis](docs/ARCHITECTURE_ANALYSIS.md)
- [E-commerce Marketplace Design](docs/ECOMMERCE_MARKETPLACE_DESIGN.md)
- [Advanced RBAC and Workflows](docs/ADVANCED_RBAC_AND_WORKFLOWS.md)
- [Implementation Sprint Plan](docs/IMPLEMENTATION_SPRINT_PLAN.md)

## Current learning position

Giai đoạn hiện tại chỉ cần giữ service gọn, đúng contract, và ổn định test.

Ưu tiên:
1. Hiểu rõ controller/service/model.
2. Hiểu data flow với MongoDB.
3. Hiểu RBAC và marketplace workflow ở mức tài liệu.
4. Khi nền tảng vững mới quay lại GraphQL/Federation.

## Token integration (user-service)

Luồng auth thật:
- Client (NextJS/Postman) login vào user-service để lấy `accessToken` (RS256).
- Khi gọi product-subgraph, gửi `Authorization: Bearer <accessToken>`.
- product-subgraph sẽ gọi sang user-service `GET /api/users/auth/me` để resolve `roles/permissions/sellerProfile`.

Checklist local dev (recommended):
1) Seed RBAC + demo users trong user-service:
	- `pnpm -C services/user-service prisma:seed`
	- `pnpm -C services/user-service prisma:seed:dev-users`

2) Login lấy access token (ví dụ):
	- `POST http://localhost:4001/api/users/auth/login`
	- Body: `{ "email": "seller@demo.local", "password": "DevPassword123!" }`

3) Gọi product-subgraph bằng token:
	- `POST http://localhost:4002/products`
	- Header: `Authorization: Bearer <accessToken>`

Lưu ý:
- `POST /products` yêu cầu user có role `SELLER` và `sellerProfile.status=VERIFIED` + `isKycVerified=true`.