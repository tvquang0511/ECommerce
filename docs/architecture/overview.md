# Architecture Overview — E-commerce Microservices (Nginx + Apollo Federation)

Tài liệu này mô tả kiến trúc mục tiêu cho repo (monorepo) ở mức **system design + chức năng**, ưu tiên giúp bạn:
- Nắm rõ “mỗi service làm gì / không làm gì” (service boundaries)
- Biết luồng sync/async (HTTP vs RabbitMQ)
- Biết vai trò của các “hạ tầng ngầm” như Redis, RabbitMQ, MinIO

> Trạng thái hiện tại: repo mới ở mức skeleton. Nội dung dưới đây là **spec/overview** để bạn triển khai dần theo milestone trong README.

---

## 1) Tổng quan hệ thống

### 1.1 Mục tiêu
- Xây dựng hệ thống e-commerce theo hướng microservices để học: Federation, routing, auth, cache, message broker, saga/outbox.
- Demo được hành trình MVP: login → browse product → cart → checkout → order → (reserve inventory + authorize payment) → notification.

### 1.2 Nguyên tắc kiến trúc
- **Database-per-service**: mỗi service sở hữu DB của nó; service khác không được query DB trực tiếp.
- **Single entrypoint cho UI**: frontend chủ yếu gọi **GraphQL Gateway** (Apollo Federation). Riêng auth giữ REST (refresh cookie) để đơn giản.
- **Sync vs Async**:
  - Sync (HTTP): các lệnh cần phản hồi ngay (checkout gọi reserve/authorize).
  - Async (RabbitMQ): các side effects và đồng bộ dữ liệu (notification, cache invalidation, analytics…).
- **Eventual consistency**: chấp nhận consistency theo thời gian, tránh distributed transaction.
- **Idempotency**: các lệnh quan trọng phải idempotent (checkout, reserve, payment webhook).
- **Outbox pattern** (tối thiểu ở order): đảm bảo “DB commit” và “publish event” không bị lệch.

---

## 2) Danh sách service & trách nhiệm

### 2.1 Bảng tóm tắt

| Service | Public API | DB/Storage sở hữu | Vai trò chính |
|---|---|---|---|
| `apps/web` | HTTP | — | UI storefront (SSR/SEO nếu dùng Next.js) |
| `graphql-gateway` | GraphQL `/graphql` | — | Apollo Federation Gateway, compose supergraph, forward auth/correlation |
| `user-service` | REST `/api/users/*` | Postgres (users/sessions) | Auth + users + refresh-cookie |
| `product-subgraph` | GraphQL (subgraph) | Mongo (catalog) + Redis (cache) + MinIO (blobs) | Catalog + product images |
| `cart-subgraph` | GraphQL (subgraph) | Redis (primary store) | Shopping cart (ephemeral, fast) |
| `order-subgraph` | GraphQL (subgraph) | Postgres (orders + outbox) | Orders + checkout orchestration |
| `inventory-service` | REST (internal) | Postgres (stock/reservations) | Reserve/release inventory (idempotent) |
| `payment-service` | REST (internal) | Postgres (payment intents/tx) | Authorize/capture (mock hoặc tích hợp sau) |
| `notification-worker` | (none) | — | Consume events và gửi email |

> Ghi chú: “public” ở đây nghĩa là nên đi qua Nginx/edge. Internal services vẫn có thể expose port trong dev để debug, nhưng production nên giới hạn network.

---

## 3) Chi tiết từng service

## 3.1 `graphql-gateway` (Apollo Federation Gateway)

**Mục tiêu**: cung cấp một endpoint GraphQL duy nhất cho frontend.

**Chức năng chính**
- Compose supergraph từ các subgraph endpoints (dev có thể dùng introspection).
- Forward request context:
  - `Authorization: Bearer <accessToken>`
  - `x-request-id` (correlation)
- Normalize error (tối thiểu): map network errors/subgraph errors ra một format dễ debug.

**Không làm**
- Không sở hữu DB.
- Không tự “quyết định” authorization thay subgraph (gateway chỉ forward token).

**Endpoints**
- `POST /graphql` (query/mutation)

---

## 3.2 `user-service` (Auth/Users)

**Mục tiêu**: đăng ký/đăng nhập, phát hành token, quản lý refresh token.

**Data ownership (Postgres)**
- `users`
- `refresh_sessions` (hoặc `sessions`, chứa refresh token hash, device info, revokedAt…)
- (optional) `addresses`, `roles`

**Chức năng chính**
- Register/Login/Logout
- Refresh token rotation (khuyến nghị)
- Profile tối thiểu (vd `GET /me`)

**REST API (gợi ý)**
- `POST /api/users/register`
- `POST /api/users/login`
- `POST /api/users/refresh`
- `POST /api/users/logout`
- `GET /api/users/me`

**Auth strategy**
- Access token: JWT `RS256` (TTL ngắn) gửi qua `Authorization`.
- Refresh token: opaque random token (không phải JWT) lưu hash trong DB, gửi qua HttpOnly cookie (rotation + reuse detection).
- (Optional) 2FA: email OTP (TTL ngắn) qua mail worker.

Chi tiết: xem `docs/architecture/auth.md`.

**Events (RabbitMQ)**
- Publish (optional): `user.registered.v1`

---

## 3.3 `product-subgraph` (Catalog)

**Mục tiêu**: cung cấp product listing/detail và quản lý hình ảnh sản phẩm.

**Data ownership**
- MongoDB: `products`, `categories`, `attributes`, `product_image_meta` (hoặc embedded)
- MinIO: product image blobs
- Redis: cache read model (listing/detail)

**Chức năng chính**
- Query:
  - `products(cursor, limit, filter, sort)`
  - `product(id)`
- Federation entity:
  - `Product @key(fields: "id")`
- Product images:
  - Lưu blob trong MinIO
  - Lưu metadata + object key trong Mongo
  - Khuyến nghị dùng presigned URLs cho upload/download

**Cache strategy (Redis)**
- Cache keys ví dụ:
  - `cache:product:detail:<id>` (TTL ngắn, vd 30–300s)
  - `cache:product:list:<hash(filter,sort,cursor)>`
- Invalidation (phase sau): consumer event `product.updated.v1` để xoá các key liên quan (hoặc dùng versioning).

**Events (RabbitMQ)**
- Publish: `product.created.v1`, `product.updated.v1`, `product.price_changed.v1`

---

## 3.4 `cart-subgraph` (Shopping cart)

**Mục tiêu**: cart nhanh, ephemeral, không cần transaction phức tạp.

**Data ownership (Redis — primary store)**
- Cart theo `userId` hoặc `sessionId`.
- Key design ví dụ:
  - `cart:user:<userId>` → JSON/cart model
  - `cart:session:<sessionId>` → JSON/cart model

**Chức năng chính**
- Query: `cart` (derive userId từ JWT)
- Mutations:
  - `addToCart(productId, qty)`
  - `updateCartItem(productId, qty)`
  - `removeCartItem(productId)`
  - `clearCart()`
- Federation reference:
  - `CartItem.product` trả về reference `{ __typename: "Product", id }` để gateway resolve qua `product-subgraph`.

**Events (RabbitMQ)**
- Publish (optional): `cart.checked_out.v1` (khi bắt đầu checkout)

---

## 3.5 `order-subgraph` (Orders + Checkout orchestration)

**Mục tiêu**: tạo order và điều phối checkout (saga/orchestration).

**Data ownership (Postgres)**
- `orders` (state machine: `PENDING` → `CONFIRMED` → `CANCELLED`…)
- `order_items` (snapshot name/price tại thời điểm mua)
- `outbox_events`

**Chức năng chính**
- Mutations:
  - `checkout(idempotencyKey)`:
    1) Load cart (từ cart-subgraph)
    2) Snapshot items → create order `PENDING`
    3) Call `inventory-service` reserve (sync)
    4) Call `payment-service` authorize (sync)
    5) Nếu ok → `CONFIRMED`, nếu fail → `CANCELLED` (và release)
- Queries:
  - `orders`
  - `order(id)`

**Idempotency**
- `checkout` cần idempotent theo `idempotencyKey` + `userId`.

**Outbox**
- Trong 1 DB transaction: ghi `orders` + ghi `outbox_events`.
- Worker/publisher đọc outbox → publish RabbitMQ.

**Events (RabbitMQ)**
- Publish: `order.created.v1`, `order.confirmed.v1`, `order.cancelled.v1`
- Consume: `inventory.reserved.v1`, `inventory.reserve_failed.v1`, `payment.authorized.v1`, `payment.failed.v1`

---

## 3.6 `inventory-service` (Stock + Reservation)

**Mục tiêu**: reserve/release stock theo `orderId`.

**Data ownership (Postgres)**
- `stock` (productId, availableQty)
- `reservations` (orderId, productId, qty, status)

**REST API (internal)**
- `POST /reserve` (body: orderId, items[], idempotencyKey?)
- `POST /release` (body: orderId)

**Idempotency**
- Reserve theo `(orderId)` phải idempotent: gọi lại không được trừ stock thêm.

**Events (RabbitMQ)**
- Publish: `inventory.reserved.v1`, `inventory.reserve_failed.v1`, `inventory.released.v1`
- Consume (optional): `order.cancelled.v1` để tự release.

---

## 3.7 `payment-service` (Payments)

**Mục tiêu**: authorize/capture (mock trước, tích hợp Stripe/MoMo sau).

**Data ownership (Postgres)**
- `payment_intents` / `transactions`
- `webhook_logs` (nếu tích hợp)

**REST API (internal)**
- `POST /authorize` (orderId, amount, currency, idempotencyKey)
- `POST /capture` (paymentIntentId)
- `POST /webhooks/<provider>` (optional)

**Idempotency**
- `authorize` phải idempotent theo `(orderId, idempotencyKey)`.
- Webhook cũng phải idempotent theo `providerEventId`.

**Events (RabbitMQ)**
- Publish: `payment.authorized.v1`, `payment.failed.v1`, `payment.captured.v1`

---

## 3.8 `notification-worker` (Email)

**Mục tiêu**: xử lý side effects không cần synchronous response.

**Chức năng chính**
- Consume events và gửi email qua SMTP.
- Retry khi SMTP fail (có backoff).

**Events (RabbitMQ)**
- Consume: `user.registered.v1`, `order.confirmed.v1`, `payment.failed.v1`

---

## 4) Hạ tầng “ngầm” (Infrastructure components)

## 4.1 RabbitMQ (Message broker)

**RabbitMQ dùng để làm gì trong hệ này?**
- Event-driven communication: thông báo “đã xảy ra chuyện gì” (order created, payment failed…) thay vì service gọi nhau quá nhiều.
- Tách side effects: notification, cache invalidation, analytics.
- Giảm coupling giữa services.

**Các khái niệm cần nắm (thực chiến)**
- **Exchange**: nơi publish messages. Thường dùng `topic` exchange để route theo routing key.
- **Queue**: nơi consumer đọc messages.
- **Routing key**: ví dụ `order.created.v1`.
- **Consumer group**: nhiều instances cùng consume 1 queue để scale.

**Envelope message (khuyến nghị)**
```json
{
  "id": "uuid",
  "type": "order.created.v1",
  "occurredAt": "2026-04-05T12:34:56.000Z",
  "source": "order-subgraph",
  "traceId": "...",
  "data": {
    "orderId": "...",
    "userId": "..."
  }
}
```

**Reliability**
- Consumer nên dùng ack thủ công, chỉ ack sau khi xử lý thành công.
- Retry:
  - Cách đơn giản: consumer catch error → requeue (cẩn thận poison message).
  - Cách tốt hơn: delayed retry (TTL + DLX) hoặc queue retry riêng.
- Dead-letter queue (DLQ): message fail nhiều lần → đẩy vào DLQ để inspect.

**Outbox**
- Nếu event “quan trọng” (order created), tránh publish trực tiếp từ request handler.
- Ghi outbox trong DB transaction rồi publisher process đọc và publish.

---

## 4.2 Redis

Redis trong hệ này có **2 vai trò khác nhau** (đừng trộn khái niệm):
1) **Primary store** cho cart (cart-subgraph): dữ liệu cart sống trong Redis.
2) **Cache** cho catalog (product-subgraph): cache read-heavy queries.

**Best practices**
- Tách key prefix rõ ràng (`cart:*`, `cache:*`).
- Đặt TTL cho cache (không đặt TTL cho cart hoặc TTL dài tuỳ yêu cầu).
- Tránh cache “vĩnh viễn” nếu chưa có invalidation strategy.

---

## 4.3 MinIO (S3-compatible object storage)

**Vai trò**
- Lưu blobs (product images, files) thay vì nhét vào DB.

**Mô hình khuyến nghị**
- MongoDB lưu metadata:
  - `objectKey`, `bucket`, `contentType`, `size`, `checksum`, `createdAt`
- Blob thật lưu trong MinIO.

**Luồng upload/download (khuyến nghị)**
- Upload:
  1) Client gọi product-subgraph để xin presigned `PUT` URL
  2) Client upload thẳng lên MinIO bằng URL
  3) Client gọi confirm (hoặc server tự verify) để lưu metadata
- Download:
  - Client xin presigned `GET` URL để tải/hiển thị ảnh.

**Lợi ích**
- Không phải stream file qua app server (giảm load).
- Dễ dùng CDN về sau.

---

## 5) Các luồng nghiệp vụ chính (MVP)

### 5.1 Login + token refresh
1) `POST /api/users/login` → set refresh cookie + trả access token.
2) Frontend gọi GraphQL qua gateway với `Authorization`.
3) Khi access token hết hạn:
   - Frontend gọi `POST /api/users/refresh` (cookie) → nhận access token mới.

### 5.2 Browse product
- UI gọi gateway → gateway gọi product-subgraph.
- Product-subgraph ưu tiên đọc Redis cache, miss thì đọc Mongo rồi cache lại.

### 5.3 Cart
- UI gọi gateway → cart-subgraph ghi/đọc Redis.
- CartItem.product resolve qua Federation (gateway tự fan-out sang product-subgraph).

### 5.4 Checkout
- UI gọi gateway mutation `checkout(idempotencyKey)`.
- Order-subgraph:
  - snapshot cart items → tạo order `PENDING`
  - reserve inventory (inventory-service)
  - authorize payment (payment-service)
  - confirm/cancel + publish events (outbox)
- Notification worker gửi email khi `order.confirmed.v1`.

---

## 6) Dev topology (khi chạy local)

### 6.1 Compose chỉ chạy hạ tầng
- `infra/docker-compose.dev.yml` chạy: Postgres, Mongo, Redis, RabbitMQ, MinIO.
- Apps/services chạy bằng pnpm trên host.

### 6.2 Compose + Nginx (single origin, optional)
- Dùng compose overlay: `infra/docker-compose.edge.yml`.
- Trong giai đoạn services chạy trên host, Nginx sẽ proxy tới `host.docker.internal:<port>`.

### 6.3 Full stack bằng container (later)
- `infra/docker-compose.yml` dùng để chạy infra + một phần app containers (phục vụ test nhanh).

---

## 7) Tài liệu liên quan
- Component diagram (PlantUML): xem trong [docs/diagrams/component-diagram.md](../diagrams/component-diagram.md).
- Roadmap/milestones: xem [README.md](../../README.md).
- Chức năng chi tiết từng service: xem [docs/architecture/services.md](services.md).
- Template cây thư mục (NestJS-first + Express user-service): xem [docs/architecture/folder-structure.md](folder-structure.md).
- pnpm guide: xem [docs/pnpm.md](../pnpm.md).
