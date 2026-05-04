# product-subgraph

`product-subgraph` là service catalog của hệ thống marketplace. Service này dùng **NestJS + MongoDB (Mongoose)** theo hướng tối giản:

`controller -> service -> model`

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

- `MONGO_URI`: connection string cho MongoDB
- Default: `mongodb://127.0.0.1:27017/product-subgraph`

## Endpoints

- `GET /`
- `GET /health`
- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PUT /products/:id`
- `DELETE /products/:id`

## Core files

- `src/app.module.ts`
- `src/products/products.module.ts`
- `src/products/products.controller.ts`
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