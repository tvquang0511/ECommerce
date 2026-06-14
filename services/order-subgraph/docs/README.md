# order-subgraph (CQRS + Event Sourcing) — Kế hoạch thực hành

Mục tiêu của `order-subgraph` là biến phần “Ordering service” bạn đang học (DDD + CQRS + Event Sourcing) thành một service thực hành trong repo này.

- Service type: GraphQL subgraph (Apollo Federation) cho `graphql-gateway`
- Mục tiêu học tập: thực hành đúng “command side / query side”, event store, projection, optimistic concurrency, idempotency, và (tuỳ phase) outbox + integration events.

---

## 1) Phạm vi (scope) cho bài thực hành

### In-scope (đủ để học CQRS + ES)
- Tạo đơn (draft) từ cart hoặc từ payload items
- Chỉnh sửa draft (add/update/remove item)
- Submit/Confirm đơn (chuyển trạng thái)
- Cancel đơn (theo rule)
- Đọc order theo read model (query side)

### Out-of-scope (để không quá tải)
- Payment thực tế (chỉ mô phỏng event “PaymentAuthorized/Failed”)
- Inventory thực tế (chỉ mô phỏng event “StockReserved/Rejected”)
- Shipping/fulfillment

---

## 2) DDD: Bounded Context + Aggregate

### 2.1 Aggregate chính
- `Order` aggregate (event-sourced)

### 2.2 Entity/Value Objects (gợi ý)
- `OrderItem` (productId, quantity, price snapshot, currency)
- `Money` (amount, currency)
- `Address` (nếu muốn)

### 2.3 Trạng thái đơn (gợi ý tối thiểu)
- `DRAFT`
- `SUBMITTED`
- `CONFIRMED` (hoặc `PAID` nếu bạn muốn gộp)
- `CANCELLED`

---

## 3) CQRS: Command side vs Query side

### 3.1 Command side (write model)
- Nhận command từ GraphQL mutations
- Load aggregate bằng cách replay events từ event store
- Validate business rules
- Emit events (append-only)

**Nguyên tắc:** command handler không trả về “đọc” từ DB read model; chỉ trả:
- aggregate id
- version mới
- hoặc snapshot tối thiểu

### 3.2 Query side (read model)
- Đọc từ projection tables/materialized view (không replay event mỗi lần query)
- Tối ưu cho UI/gateway

**Nguyên tắc:** query handler không ghi vào event store.

---

## 4) Event Sourcing: Event store thiết kế (khuyến nghị Postgres)

Repo đã có Postgres trong compose dev, phù hợp để làm event store.

### 4.1 Bảng event store (gợi ý)

`order_events`
- `id` (uuid, PK)
- `aggregate_id` (text)
- `aggregate_type` (text) — ví dụ `Order`
- `sequence` (int) — version tăng dần, unique theo aggregate
- `event_type` (text)
- `event_data` (jsonb)
- `metadata` (jsonb) — requestId, userId, idempotencyKey, etc.
- `occurred_at` (timestamptz)

Constraints/index:
- UNIQUE (`aggregate_id`, `sequence`)
- INDEX (`aggregate_id`)
- INDEX (`occurred_at`)

### 4.2 Optimistic concurrency
Mỗi command nên có `expectedVersion`:
- Khi append events: chỉ append nếu `expectedVersion == currentSequence`
- Nếu mismatch -> trả lỗi `409 Conflict` (GraphQL error extension code)

### 4.3 Idempotency
Mỗi mutation nên nhận `idempotencyKey` (hoặc `clientMutationId`):
- Lưu key vào metadata và/hoặc bảng `order_idempotency`
- Nếu key đã xử lý -> trả kết quả cũ

---

## 5) Projections: xây read model từ events

### 5.1 Projections tối thiểu
- `orders_read` (1 row / order)
- `order_items_read` (n rows / order)

`orders_read` gợi ý fields:
- orderId, userId
- status
- currency
- totals
- createdAt, updatedAt
- version

### 5.2 Cơ chế chạy projector
Phase đầu để học:
- Chạy projector **trong cùng service** (same process) sau khi append events.

Phase nâng cao:
- Projector chạy như worker riêng, đọc stream events (poll DB hoặc subscribe broker)
- Lưu checkpoint (last processed event id/offset)

### 5.3 Idempotent projection
Do projector có thể chạy at-least-once:
- Mỗi event có `id` và `sequence`
- Projection update dựa trên `sequence` để không apply trùng

---

## 6) Pricing: snapshot vs giá checkout (kết nối với cart)

### 6.1 Snapshot khi tạo order
Order nên lưu:
- `unitPriceSnapshot` + `currency` + `titleSnapshot`…

### 6.2 Re-price ở checkout
Thông lệ tốt:
- Tại bước “submit/confirm” (hoặc “place order”), service **re-price** theo giá hiện tại (product/pricing service)
- Nếu chênh lệch, trả lỗi/response yêu cầu user xác nhận

**Kết luận:** cart snapshot dùng cho UX; order confirmation phải chốt theo rule hiện tại.

---

## 7) GraphQL API (đề xuất để luyện CQRS)

### 7.1 Mutations (commands)
- `createOrderFromCart(sessionId?: String, idempotencyKey: String!): CreateOrderPayload!`
- `createOrder(input: CreateOrderInput!, idempotencyKey: String!): CreateOrderPayload!`
- `addOrderItem(orderId: ID!, input: AddOrderItemInput!, expectedVersion: Int!, idempotencyKey: String!): OrderCommandResult!`
- `updateOrderItem(orderId: ID!, input: UpdateOrderItemInput!, expectedVersion: Int!, idempotencyKey: String!): OrderCommandResult!`
- `removeOrderItem(orderId: ID!, input: RemoveOrderItemInput!, expectedVersion: Int!, idempotencyKey: String!): OrderCommandResult!`
- `submitOrder(orderId: ID!, expectedVersion: Int!, idempotencyKey: String!): OrderCommandResult!`
- `cancelOrder(orderId: ID!, reason: String, expectedVersion: Int!, idempotencyKey: String!): OrderCommandResult!`

### 7.2 Queries (read model)
- `order(id: ID!): Order`
- `myOrders(cursor/paging...): [Order!]!`

**Note:** mutation trả payload gọn (orderId, version). UI sau đó gọi query để lấy view chuẩn.

---

## 8) Roadmap thực hành (phased plan)

### Phase 0 — Skeleton + Federation (0.5–1 ngày)
- Tạo NestJS order-subgraph skeleton (như product/cart)
- Bật Apollo Federation driver
- Kết nối gateway (compose thêm order)

### Phase 1 — Event store (1–2 ngày)
- Thiết kế schema `order_events`
- Viết `EventStore` abstraction (append/load)
- Implement optimistic concurrency

### Phase 2 — Domain + Commands (2–4 ngày)
- Viết `Order` aggregate (decide/apply)
- Command handlers + validation
- Idempotency

### Phase 3 — Projections + Queries (1–3 ngày)
- Read model tables + projector
- Query handlers

### Phase 4 — Integration events (nâng cao, 2–4 ngày)
- Outbox pattern (DB table)
- Publish events sang RabbitMQ
- Consume events mô phỏng (payment/inventory)

### Phase 5 — Observability + Tests (song song)
- Unit tests: aggregate decision rules
- Integration tests: event store append/load
- E2E: GraphQL commands + query reads

---

## 9) Tiêu chí hoàn thành (đúng mục tiêu học)

- Có command side rõ ràng: append events + optimistic concurrency + idempotency
- Có query side rõ ràng: read model từ projections
- Có thể replay event để rebuild aggregate
- Có test cho domain rules
