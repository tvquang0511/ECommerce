# Order Test Guide

Tài liệu này là guide ngắn để test `order-subgraph` ở mức end-to-end nội bộ:

- mutation
- event store
- read model
- outbox

Guide này chưa đi đến inventory/payment callback đầy đủ. Mục tiêu là xác nhận nền `CQRS + Event Sourcing + Outbox` đã chạy đúng.

---

## 1. Chuẩn bị

### 1.1 Bật hạ tầng dev

Từ root repo:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 1.2 Apply migration

```powershell
pnpm.cmd --filter order-subgraph prisma:generate
pnpm.cmd --filter order-subgraph prisma:migrate:deploy
```

### 1.3 Chạy service

```powershell
pnpm.cmd --filter order-subgraph start:dev
```

Service sẽ chạy ở:

```text
http://localhost:4004/graphql
```

---

## 2. Test `createOrderFromCart`

> Lưu ý: use case này hiện vẫn phụ thuộc `checkoutPricingService.previewFromCart(...)`.
> Nếu cart/product service của bạn đã chạy, dùng flow thật. Nếu chưa, hãy test tiếp `submitOrder` và `cancelOrder` bằng order đã có stream hợp lệ sau khi create thành công.

Mutation:

```graphql
mutation CreateOrder($input: CreateOrderFromCartInput!) {
  createOrderFromCart(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "cartId": "cart-demo-1",
    "idempotencyKey": "order-create-001"
  }
}
```

Kỳ vọng:

- trả về `status = DRAFT`
- có `orderId`

Kiểm tra DB:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT aggregate_id, sequence, event_type FROM order_events ORDER BY occurred_at DESC;"
```

Bạn nên thấy:

- một event `OrderCreatedFromCart`

Kiểm tra read model:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT order_id, status, inventory_status, payment_status, version FROM orders_read ORDER BY created_at DESC;"
```

Bạn nên thấy:

- `status = DRAFT`
- `inventory_status = NOT_REQUESTED`
- `payment_status = NOT_REQUESTED`

Kiểm tra outbox:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT event_type, aggregate_id, published_at, retry_count FROM order_outbox ORDER BY created_at DESC;"
```

Bạn nên thấy:

- một row `order.created-from-cart`

---

## 3. Test `submitOrder`

Mutation:

```graphql
mutation SubmitOrder($input: SubmitOrderInput!) {
  submitOrder(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "orderId": "REPLACE_WITH_ORDER_ID",
    "expectedVersion": 0,
    "idempotencyKey": "order-submit-001"
  }
}
```

Kỳ vọng:

- trả về `status = SUBMITTED`

Kiểm tra event store:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT aggregate_id, sequence, event_type FROM order_events WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY sequence ASC;"
```

Bạn nên thấy:

- `OrderCreatedFromCart`
- `OrderSubmitted`

Kiểm tra read model:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT order_id, status, inventory_status, payment_status, version FROM orders_read WHERE order_id = 'REPLACE_WITH_ORDER_ID';"
```

Bạn nên thấy:

- `status = SUBMITTED`
- `inventory_status = PENDING`
- `payment_status = PENDING`

Kiểm tra outbox:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT event_type, aggregate_id, published_at, retry_count FROM order_outbox WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY created_at ASC;"
```

Bạn nên thấy thêm:

- `order.submitted`

---

## 4. Flush outbox thủ công

Hiện tại worker chưa gắn scheduler/background loop.  
Để test thủ công, chạy:

```powershell
pnpm.cmd --filter order-subgraph outbox:flush
```

Kỳ vọng:

- script in ra số lượng outbox entries đã xử lý

Kiểm tra lại DB:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT event_type, aggregate_id, published_at, retry_count FROM order_outbox WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY created_at ASC;"
```

Bạn nên thấy:

- `published_at` đã có giá trị cho các record được xử lý thành công

---

## 5. Test `cancelOrder`

Mutation:

```graphql
mutation CancelOrder($input: CancelOrderInput!) {
  cancelOrder(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "orderId": "REPLACE_WITH_ORDER_ID",
    "expectedVersion": 1,
    "idempotencyKey": "order-cancel-001",
    "reason": "buyer changed mind"
  }
}
```

Kỳ vọng:

- trả về `status = CANCELLED`

Kiểm tra event store:

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT aggregate_id, sequence, event_type FROM order_events WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY sequence ASC;"
```

Bạn sẽ thấy thêm:

- `OrderCancelled`

> Lưu ý: read model cho `OrderCancelled` chưa được projector cập nhật đầy đủ nếu bạn chưa implement projector event này.

---

## 6. Những gì guide này xác nhận được

Nếu các bước trên chạy ổn, nghĩa là:

- command handler đã append event store thật
- aggregate đang sinh event đúng
- projector hiện có đang cập nhật read model đúng
- outbox đã lưu vào Postgres thật
- worker đã flush outbox được

---

## 7. Phần còn thiếu sau guide này

Guide này chưa cover:

- inventory callback
- payment callback
- projector cho `OrderCancelled`, `OrderConfirmed`, `OrderPaymentAuthorized`, `OrderPaymentFailed`
- retry strategy thật cho worker
- publish RabbitMQ thật thay vì publisher stub

Đó sẽ là bước tiếp theo sau khi nền hiện tại đã ổn.
