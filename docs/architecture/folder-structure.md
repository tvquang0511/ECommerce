# Folder Structure — đề xuất cho từng service (NestJS-first)

Mục tiêu: đa số services/subgraphs dùng **NestJS** để bạn học thiết kế kỷ luật (SOLID, DI, module boundaries, patterns) và vẫn dễ mở rộng về sau (outbox, adapters, integrations).

> Ghi chú: đây là **template**. Milestone 0 bạn chỉ cần chạy được gateway + 1 subgraph; sang Milestone 1+ mới “fill” dần.

---

## 1) Pattern khuyến nghị cho NestJS services/subgraphs (feature-first)

```text
src/
  main.ts
  app.module.ts
  common/
    config/
    errors/
    logger/
    request-id/
    validation/
  modules/
    <feature>/
      <feature>.module.ts
      api/
        controllers/          # REST services
        resolvers/            # GraphQL subgraphs
        dtos/
      application/
        services/
        ports/                # interfaces/tokens (repository, broker, storage)
      domain/
        entities/
        value-objects/
        rules/
      infrastructure/
        repositories/
        messaging/
        storage/
  infra/
    db/
    redis/
    rabbitmq/
    minio/
  health/
    health.module.ts
    health.controller.ts
```

Áp dụng:
- `product-subgraph`, `cart-subgraph`, `order-subgraph` (GraphQL): đặt GraphQL entry trong `api/resolvers/`.
- `inventory-service`, `payment-service` (REST): đặt HTTP entry trong `api/controllers/`.

Tư duy chính:
- `domain/` không import framework, chỉ chứa model/rules.
- `application/` chứa use-cases (services), phụ thuộc vào `ports/`.
- `infrastructure/` implement các ports (DB, Redis, RabbitMQ, MinIO).

---

## 2) `user-service`: Node.js + Express (modules-first, reuse TeamHub)

Quyết định hiện tại của repo:
- `user-service` dùng **Node.js + Express + REST** để bạn có thể copy/reuse auth modules của TeamHub nhanh và giữ layout modules-first.

Các service domain khác (`product/cart/order/inventory/payment`) vẫn ưu tiên NestJS-first để học DI/module boundaries “chuẩn chỉ”.

## 3) Pattern cho `user-service` (Express)

```text
src/
  server.ts                  # tạo app + listen
  app.ts                     # wiring routes/middlewares
  common/
    config/
    errors/
    logger/
    http/
      requestId.ts
  modules/
    auth/
      auth.routes.ts
      auth.controller.ts
      auth.service.ts
      jwt/
        sign.ts
        verify.ts
      refresh/
        refresh.service.ts
      dtos/
    users/
      users.routes.ts
      users.controller.ts
      users.service.ts
      dtos/
    sessions/
      sessions.service.ts
      repository.ts
  prisma/
    schema.prisma
    client.ts
```

Gợi ý port auth từ TeamHub
- Port logic auth/users theo hướng “ít đổi nhất” rồi refactor dần.
- Nếu sau này migrate sang NestJS: wrap lại auth logic thành providers/use-cases rồi chuyển routing layer.

---

## 4) Pattern cho `graphql-gateway`

```text
src/
  index.ts                   # start server
  gateway/
    buildGateway.ts
    dataSource.ts            # RemoteGraphQLDataSource, forward headers
  common/
    requestId.ts
    env.ts
```

---

## 4) Pattern cho workers

### 4.1 `notification-worker`
```text
src/
  index.ts
  common/
    logger/
    config/
  consumers/
    orderConfirmed.consumer.ts
    paymentFailed.consumer.ts
  providers/
    smtpClient.ts
```

### 4.2 `outbox-publisher` (nếu tách riêng sau này)
```text
src/
  index.ts
  outbox/
    poller.ts
    publisher.ts
  infra/
    db.ts
    rabbitmq.ts
```
