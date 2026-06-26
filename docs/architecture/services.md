# Services Spec (chi tiết chức năng) — Milestone-driven

Tài liệu này đi sâu vào **chức năng** của từng service/subgraph/worker để bạn “mường tượng” trước khi code.

Chuẩn kiến trúc và quy ước viết docs nằm ở [architecture-standard.md](architecture-standard.md).

> Quy ước từ ngữ:
> - **Service**: REST internal service (vd inventory/payment).
> - **Subgraph**: GraphQL Federation subgraph (product/cart/order).
> - **Worker**: process background consume RabbitMQ (notification/outbox publisher).

---

## 0) Phạm vi hiện tại của service cho bản demo event-driven

Để tránh lệch với roadmap cũ, phạm vi hiện tại của từng service nên hiểu như sau:

- `user-service`: đã dùng thật cho auth, RBAC, seller onboarding, admin workflows.
- `product-subgraph`: đã dùng thật cho product catalog, moderation states, media metadata.
- `cart-subgraph`: đã dùng thật cho buyer cart trên Redis.
- `order-subgraph`: đang hoàn thiện luồng order event-driven với outbox.
- `inventory-service`: sắp được xây dựng ở mức cơ bản để cấp stock status và reserve stock.
- `payment-service`: phase này chỉ cần consume/publish event để demo RabbitMQ, chưa cần payment thật.

Mục tiêu quan trọng nhất hiện tại là:

```text
submitOrder
  -> ghi order_outbox
  -> outbox worker publish RabbitMQ
  -> inventory/payment nhan event
  -> inventory/payment phan hoi ket qua
  -> order cap nhat state va projection
```

---

## 1) `product-subgraph` (Catalog)

### 1.1 Queries (public qua gateway)
- `ping: String!`
  - Mục đích: smoke test cho federation.
- `products(...)` (Milestone 2)
  - Pagination: cursor-based
  - Filter/sort tối thiểu (category, price range)
- `product(id: ID!): Product`
  - Detail

### 1.2 Mutations (admin, phase sau)
- `createProduct(input)` / `updateProduct(id, input)`
- `setProductPrice(id, price)`

### 1.3 Product images (MinIO)
- Mục tiêu: UI upload/download image không đi xuyên qua app server.
- Các bước khuyến nghị:
  1) Mutation xin presigned PUT URL: `createProductImageUpload(productId, fileMeta)`
  2) Client upload thẳng lên MinIO
  3) Mutation confirm: `confirmProductImage(productId, objectKey, checksum)`
  4) Query trả image URL (presigned GET hoặc signed CDN URL)

### 1.4 Cache (Redis)
- Cache list/detail để tăng tốc đọc.
- Key-prefix khuyến nghị:
  - `cache:product:detail:<id>`
  - `cache:product:list:<hash>`
- Invalidation:
  - đơn giản: TTL
  - nâng cao: consume `product.updated.v1` để xóa key liên quan

### 1.5 Events (RabbitMQ)
- Publish:
  - `product.created.v1`
  - `product.updated.v1`
  - `product.price_changed.v1`

---

## 2) `cart-subgraph` (Shopping cart)

### 2.1 Queries/Mutations
- `cart: Cart!`
- `addToCart(productId, qty)`
- `updateCartItem(productId, qty)`
- `removeCartItem(productId)`
- `clearCart`

### 2.2 Storage model (Redis primary)
- Cart thường “ephemeral”: không cần transaction phức tạp.
- Key-prefix:
  - `cart:user:<userId>` hoặc `cart:session:<sessionId>`

### 2.3 Federation reference
- `CartItem.product` trả reference `Product` để gateway resolve qua product-subgraph.

### 2.4 Events
- Publish (optional): `cart.checked_out.v1`

---

## 3) `order-subgraph` (Orders + Checkout)

### 3.1 Queries
- `orders(...)`
- `order(id)`

### 3.2 Mutations
- `checkout(idempotencyKey)`
  - Snapshot cart items
  - Create order `PENDING`
  - Call inventory reserve
  - Call payment authorize
  - Success → `CONFIRMED`
  - Fail → `CANCELLED` + release

### 3.3 Idempotency
- `checkout` phải idempotent theo `(userId, idempotencyKey)`.

### 3.4 Outbox
- Tạo order + ghi outbox event trong cùng transaction.
- Worker/publisher đọc outbox → publish RabbitMQ.

### 3.5 Events
- Publish: `order.created.v1`, `order.confirmed.v1`, `order.cancelled.v1`
- Consume: `inventory.*`, `payment.*`

### 3.6 Hướng hiện tại của order
- `createOrderDirect`, `createOrderFromCart`, `submitOrder` đã có flow CQRS + event store.
- `submitOrder` đã được chốt theo hướng re-price trước submit.
- Bước tiếp theo của order là:
  - hoàn thiện `order_outbox`
  - worker publish RabbitMQ
  - nhận callback từ inventory/payment

### 3.7 Phạm vi outbox hiện tại
Phase hiện tại nên bắt đầu tối thiểu với:

- outbox event: `order.submitted`
- worker fan-out sang:
  - inventory reservation request
  - payment authorization request

Sau đó mới mở rộng:

- `order.confirmed`
- `order.cancelled`

---

## 4) `inventory-service` (REST internal)

### 4.1 Endpoints
- `POST /reserve`
- `POST /release`

### 4.2 Invariants
- Reserve idempotent theo orderId.
- Không cho availableQty âm.

### 4.3 Events
- Publish: `inventory.reserved.v1`, `inventory.reserve_failed.v1`, `inventory.released.v1`

### 4.4 Phạm vi hiện tại cần làm
Inventory-service trong phase này không cần trở thành warehouse system đầy đủ.

Chỉ cần đủ để:

- trả về stock status cơ bản cho product/UI
- reserve stock theo `orderId`
- reject nếu không đủ stock
- release reservation nếu order bị cancel/fail
- publish kết quả về order qua RabbitMQ

Nó là service "dùng được thật" cho bài toán commerce, không chỉ là mock.

---

## 5) `payment-service` (REST internal)

### 5.1 Endpoints
- `POST /authorize`
- `POST /capture` (phase sau)
- `POST /webhooks/*` (khi tích hợp provider)

### 5.2 Invariants
- Authorize idempotent theo `(orderId, idempotencyKey)`.
- Webhook idempotent theo `providerEventId`.

### 5.3 Events
- Publish: `payment.authorized.v1`, `payment.failed.v1`, `payment.captured.v1`

### 5.4 Phạm vi hiện tại cần làm
Payment-service trong phase hiện tại không cần thanh toán thật.

Chỉ cần đủ để:

- consume event từ order
- tạo payment record/mock intent nếu cần
- publish lại:
  - `payment.authorized.v1`
  - hoặc `payment.failed.v1`

Mục tiêu là demo event-driven flow hoàn chỉnh trước.

Phase sau mới biến payment thành nơi để học blockchain.

---

## 6) `user-service` (Auth/Users — Node.js + Express, reuse TeamHub)

### 6.1 REST endpoints
- `POST /api/users/auth/register`
- `POST /api/users/auth/login`
- `POST /api/users/auth/refresh`
- `POST /api/users/auth/logout`
- `GET /api/users/auth/me`

OpenAPI:
- `GET /openapi.json`
- `GET /api-docs`

### 6.2 Auth flow (khuyến nghị)
- Access token: JWT trả về JSON response.
- Refresh token: HttpOnly cookie.
- Refresh rotation: mỗi lần refresh cấp token mới, revoke token cũ.

### 6.3 Reuse từ TeamHub (cách port đề xuất)
- Port nhanh `modules/auth`, `modules/users` theo hướng “ít đổi nhất”, đảm bảo refresh-cookie flow chạy được trước.
- Sau đó mới refactor dần: tách `common/` (errors/logger/http), chuẩn hoá validation, tách repository layer.

Tách các phần “shared” ra `packages/*` (optional):
- types/roles constants
- error codes
- jwt verify helper

---

## 7) `graphql-gateway` (Node.js + Express + Apollo)

### 7.1 Responsibilities
- Compose supergraph từ subgraphs.
- Forward headers:
  - `Authorization`
  - `x-request-id`

### 7.2 Non-responsibilities
- Không xử lý refresh cookie.
- Không enforce authz thay subgraphs.

---

## 8) `notification-worker`

### 8.1 Responsibilities
- Consume events từ RabbitMQ.
- Send mail via SMTP.
- Retry + DLQ policy (phase sau).

---

## 9) Infra components (RabbitMQ/Redis/MinIO)

Nếu bạn cần mô tả chi tiết hơn (exchange/queue/retry/DLQ, cache TTL/invalidation, presigned URL flows), xem tài liệu: `docs/architecture/overview.md`.
