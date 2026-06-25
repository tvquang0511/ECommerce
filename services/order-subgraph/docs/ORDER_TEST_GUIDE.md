# Order Test Guide

Tài liệu này dùng để test tay `order-subgraph` theo luồng hiện tại:

- tạo draft order
- submit order
- ghi event store
- cập nhật read model bằng projector
- đẩy outbox
- nhận callback từ inventory

Guide này tập trung vào phần nội bộ của `order-subgraph` và `inventory-service`. `payment` hiện chưa cần service thật, ta sẽ giả lập callback thủ công để hoàn thiện flow event-driven.

---

## 1. Chuẩn bị

### 1.1 Chạy hạ tầng dev

Từ root repo:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 1.2 Apply migration và generate Prisma

```powershell
pnpm.cmd --filter order-subgraph prisma:generate
pnpm.cmd --filter order-subgraph prisma:migrate:deploy
```

### 1.3 Chạy service

```powershell
pnpm.cmd --filter order-subgraph start:dev
pnpm.cmd --filter inventory-service start:dev
```

Endpoint:

```text
Order GraphQL: http://localhost:4004/graphql
Inventory REST: http://localhost:4010
```

### 1.4 Kiểm tra biến môi trường

`services/order-subgraph/.env`

```env
OUTBOX_WORKER_ENABLED=true
OUTBOX_WORKER_INTERVAL_MS=1000
OUTBOX_WORKER_BATCH_SIZE=20
INVENTORY_SERVICE_BASE_URL=http://localhost:4010
```

`services/inventory-service/.env`

```env
PORT=4010
ORDER_SUBGRAPH_BASE_URL=http://localhost:4004
```

---

## 2. Test `createOrderDirect`

Header GraphQL:

```json
{
  "Authorization": "Bearer <BUYER_ACCESS_TOKEN>"
}
```

Mutation:

```graphql
mutation CreateOrderDirect($input: CreateOrderDirectInput!) {
  createOrderDirect(input: $input) {
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
    "productId": "p1003",
    "quantity": 1,
    "idempotencyKey": "order-direct-001"
  }
}
```

Kỳ vọng:

- `status = DRAFT`
- `version = 0`
- có `orderId`

---

## 3. Query read model sau khi tạo draft

Query:

```graphql
query Order($id: ID!) {
  order(id: $id) {
    id
    buyerId
    sellerIds
    status
    inventoryStatus
    paymentStatus
    version
    total {
      amount
      currency
    }
    items {
      lineId
      productId
      sellerId
      titleSnapshot
      quantity
      unitPrice {
        amount
        currency
      }
    }
  }
}
```

Variables:

```json
{
  "id": "REPLACE_WITH_ORDER_ID"
}
```

Kỳ vọng:

- `status = DRAFT`
- `inventoryStatus = NOT_REQUESTED`
- `paymentStatus = NOT_REQUESTED`

---

## 4. Test `submitOrder`

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

Kỳ vọng ngay sau khi submit:

- `status = SUBMITTED`
- `version` tăng lên

Query lại order:

- `status = SUBMITTED`
- `inventoryStatus = PENDING`
- `paymentStatus = PENDING`

---

## 5. Kiểm tra event store

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT aggregate_id, sequence, event_type FROM order_events WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY sequence ASC;"
```

Bạn nên thấy tối thiểu:

- `OrderCreatedDirect` hoặc `OrderCreatedFromCart`
- `OrderSubmitted`

Nếu draft bị re-price trước submit, bạn sẽ thấy thêm:

- `OrderRepriced`

---

## 6. Kiểm tra outbox

```powershell
docker exec -it <postgres-container> psql -U ecommerce -d ecommerce -c "SELECT event_type, aggregate_id, published_at, retry_count FROM order_outbox WHERE aggregate_id = 'REPLACE_WITH_ORDER_ID' ORDER BY created_at ASC;"
```

Bạn nên thấy:

- `order.submitted`

Nếu worker đang chạy ổn, `published_at` sẽ có giá trị sau khoảng 1 giây.

---

## 7. Test callback từ inventory về order

Sau khi outbox worker gọi sang `inventory-service`, inventory sẽ:

- reserve thành công nếu còn hàng
- hoặc reject nếu hết hàng

Sau đó inventory callback ngược về:

- `POST /internal/order-callbacks/inventory/reserved`
- hoặc `POST /internal/order-callbacks/inventory/rejected`

Bạn chỉ cần query lại order sau 1-2 giây.

### 7.1 Nếu reserve thành công

Kỳ vọng:

- `inventoryStatus = RESERVED`
- `status` vẫn là `SUBMITTED` vì payment chưa authorize

Event store sẽ có thêm:

- `OrderInventoryReserved`

### 7.2 Nếu reserve thất bại

Ví dụ tạo order với sản phẩm đang hết hàng như `p1004`.

Kỳ vọng:

- `inventoryStatus = REJECTED`
- `status = CANCELLED`

Event store sẽ có thêm:

- `OrderInventoryRejected`
- `OrderCancelled`

---

## 8. Test nhanh bằng inventory REST

Xem tồn kho:

```powershell
curl http://localhost:4010/api/inventory/stock
```

Xem reservation của order:

```powershell
curl http://localhost:4010/api/inventory/reservations/REPLACE_WITH_ORDER_ID
```

---

## 9. Những gì guide này xác nhận được

Nếu các bước trên chạy đúng, nghĩa là:

- command handler đã append event store thật
- aggregate đang sinh event đúng
- projector đang cập nhật read model đúng
- outbox đang được ghi vào Postgres
- outbox worker đang flush được
- inventory callback đã quay ngược về order-subgraph

---

## 10. Giả lập payment callback để test nhánh confirm/fail

Hiện tại chưa bắt buộc phải scaffold `payment-service`.

Lý do:

- `order-subgraph` đã có đầy đủ command, aggregate event và projector cho `payment`
- để demo event-driven, chỉ cần callback quay ngược về order là đủ
- khi nào bạn muốn học sâu hơn về blockchain hoặc payment orchestration thì mới tách thành service riêng

### 10.1 Giả lập payment authorized

Gọi REST vào order-subgraph:

```powershell
curl -X POST http://localhost:4004/internal/order-callbacks/payment/authorized `
  -H "Content-Type: application/json" `
  -d "{\"orderId\":\"REPLACE_WITH_ORDER_ID\",\"expectedVersion\":2,\"correlationId\":\"payment-auth-001\"}"
```

`expectedVersion` ở đây phải là version hiện tại của order sau bước inventory callback.

Kỳ vọng:

- nếu order đã `inventoryStatus = RESERVED` thì callback này sẽ làm order đi tiếp sang `CONFIRMED`
- event store có thêm:
  - `OrderPaymentAuthorized`
  - `OrderConfirmed`

Query lại order, bạn nên thấy:

- `status = CONFIRMED`
- `inventoryStatus = RESERVED`
- `paymentStatus = AUTHORIZED`

### 10.2 Giả lập payment failed

```powershell
curl -X POST http://localhost:4004/internal/order-callbacks/payment/failed `
  -H "Content-Type: application/json" `
  -d "{\"orderId\":\"REPLACE_WITH_ORDER_ID\",\"expectedVersion\":2,\"correlationId\":\"payment-fail-001\",\"reason\":\"card declined\"}"
```

Kỳ vọng:

- event store có thêm:
  - `OrderPaymentFailed`
  - `OrderCancelled`
- read model chuyển sang:
  - `paymentStatus = FAILED`
  - `status = CANCELLED`

---

## 11. Phần chưa hoàn thiện

Hiện tại guide này chưa cover đầy đủ:

- payment service thật
- confirm order khi cả inventory và payment đều xong
- release inventory khi cancel sau bước reserve
- RabbitMQ publisher/consumer thật thay cho HTTP callback demo
