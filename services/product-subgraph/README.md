# product-subgraph

NestJS starter được reset từ đầu để học theo lộ trình cơ bản (module, controller, service) trước khi thêm GraphQL/Federation.

## Dev
- Cài dependencies ở root workspace: `pnpm install`
- Chạy dev: `pnpm --filter product-subgraph dev`

Default port: `4002`.

## Endpoints
- Root: `http://localhost:4002/`
- Health: `http://localhost:4002/health`
- Products: `http://localhost:4002/products`
- Product by id: `http://localhost:4002/products/p1`

## Lệnh ngắn
- Chạy dev: `pnpm product` hoặc `make product`
- Lint: `pnpm product:lint` hoặc `make product-lint`
- Unit test: `pnpm product:test` hoặc `make product-test`
- E2E test: `pnpm product:e2e` hoặc `make product-e2e`
- Generate Nest file: `pnpm product:g -- controller products --no-spec`
- Generate qua Makefile: `make product-g ARGS="controller products --no-spec"`

## Lộ trình học đề xuất
1. Làm quen NestJS core: `AppModule`, `AppController`, `AppService`.
2. Thêm DTO + validation.
3. Thêm database (Prisma/Mongoose).
4. Sau đó mới thêm GraphQL (Apollo) và cuối cùng mới Federation.
