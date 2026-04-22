# product-subgraph

NestJS GraphQL service cho catalog theo lộ trình 2 pha:

1. `Apollo-first` (hiện tại): học GraphQL + Apollo trong NestJS, chưa dùng Federation.
2. `Federation-ready` (phase tiếp theo): nâng cấp lên subgraph theo product plan.

## Dev
- Cài dependencies ở root workspace: `pnpm install`
- Chạy dev: `pnpm --filter product-subgraph dev`

Default port: `4002`.

## Endpoints (Apollo-first)
- GraphQL: `http://localhost:4002/graphql`
- Health: `http://localhost:4002/health`

## Note quan trọng
- Ở pha `Apollo-first`, service này chưa expose Federation directives/entities.
- Vì vậy `graphql-gateway` (Apollo Federation Gateway) có thể chưa compose được nếu trỏ vào service này ngay.
- Khi bạn nắm vững Apollo trong NestJS, mình sẽ hỗ trợ chuyển sang Federation theo đúng `docs/architecture/product-service-plan.md`.
