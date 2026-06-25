# Order Test Guide

Tài liệu này dùng để test tay flow event-driven hiện tại của `order-subgraph`.

Luồng cần kiểm tra:

- tạo draft order
- submit order
- ghi event store
- cập nhật read model bằng projector
- ghi outbox
- outbox worker publish RabbitMQ
- `inventory-service` consume message và callback về order
- `payment-service` consume message và callback về order

Hiện tại đây là bản scaffold học tập:

- `inventory-service` dùng stock in-memory
- `payment-service` luôn authorize thành công
- chưa có database riêng cho inventory/payment

---

## 1. Chuẩn bị

### 1.1 Chạy hạ tầng dev

Từ root repo:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

### 1.2 Apply migration và generate Prisma cho order

```powershell
pnpm.cmd --filter order-subgraph prisma:generate
pnpm.cmd --filter order-subgraph prisma:migrate:deploy
```

### 1.3 Chạy các service

```powershell
pnpm.cmd --filter order-subgraph start:dev
pnpm.cmd --filter inventory-service start:dev
pnpm.cmd --filter payment-service start:dev
```

Endpoint:

```text
Order GraphQL: http://localhost:4004/graphql
Inventory REST: http://localhost:4010
Payment REST: http://localhost:4020
```

### 1.4 Kiểm tra biến môi trường

`services/order-subgraph/.env`

```env
OUTBOX_WORKER_ENABLED=true
OUTBOX_WORKER_INTERVAL_MS=1000
OUTBOX_WORKER_BATCH_SIZE=20
RABBITMQ_URL=amqp://rabbit:rabbit@localhost:5672
RABBITMQ_EXCHANGE=order.integration
```

`services/inventory-service/.env`

```env
PORT=4010
ORDER_SUBGRAPH_BASE_URL=http://localhost:4004
RABBITMQ_URL=amqp://rabbit:rabbit@localhost:5672
RABBITMQ_EXCHANGE=order.integration
INVENTORY_RESERVATION_QUEUE=inventory.reservation.requested.q
```

`services/payment-service/.env`

```env
PORT=4020
ORDER_SUBGRAPH_BASE_URL=http://localhost:4004
RABBITMQ_URL=amqp://rabbit:rabbit@localhost:5672
RABBITMQ_EXCHANGE=order.integration
PAYMENT_AUTHORIZATION_QUEUE=payment.authorization.requested.q
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

## 7. Kiểm tra inventory consume và callback

Sau khi outbox worker publish `order.submitted` ra RabbitMQ:

- `inventory-service` consume `inventory.reservation.requested`
- service này reserve stock in-memory
- sau đó callback ngược về order

Callback nội bộ hiện dùng:

- `POST /internal/order-callbacks/inventory/reserved`
- `POST /internal/order-callbacks/inventory/rejected`

### 7.1 Nếu reserve thành công

Kỳ vọng:

- `inventoryStatus = RESERVED`
- `status` có thể vẫn là `SUBMITTED` nếu payment callback chưa về kịp
- hoặc có thể đã lên `CONFIRMED` nếu payment callback cũng xong rất nhanh

Event store sẽ có thêm:

- `OrderInventoryReserved`

### 7.2 Nếu reserve thất bại

Ví dụ tạo order với sản phẩm hết hàng như `p1004`.

Kỳ vọng:

- `inventoryStatus = REJECTED`
- `status = CANCELLED`

Event store sẽ có thêm:

- `OrderInventoryRejected`
- `OrderCancelled`

---

## 8. Kiểm tra payment consume và callback

Sau khi outbox worker publish `order.submitted` ra RabbitMQ:

- `payment-service` consume `payment.authorization.requested`
- service này hiện luôn authorize thành công
- sau đó callback ngược về order

Callback nội bộ hiện dùng:

- `POST /internal/order-callbacks/payment/authorized`

Với happy path, bạn nên thấy event store có thêm:

- `OrderPaymentAuthorized`
- `OrderConfirmed`

Query lại order, bạn nên thấy:

- `status = CONFIRMED`
- `inventoryStatus = RESERVED`
- `paymentStatus = AUTHORIZED`

---

## 9. Test nhanh bằng inventory REST

Xem tồn kho:

```powershell
curl http://localhost:4010/api/inventory/stock
```

Xem reservation của order:

```powershell
curl http://localhost:4010/api/inventory/reservations/REPLACE_WITH_ORDER_ID
```

---

## 10. Những gì guide này xác nhận được

Nếu các bước trên chạy đúng, nghĩa là:

- command handler đã append event store thật
- aggregate đang sinh event đúng
- projector đang cập nhật read model đúng
- outbox đang được ghi vào Postgres
- outbox worker đang publish RabbitMQ được
- `inventory-service` đang consume message thật
- `payment-service` đang consume message thật
- callback từ inventory/payment đã quay ngược về order-subgraph

---

## 11. Phần chưa hoàn thiện

Hiện tại guide này chưa cover đầy đủ:

- payment failed branch thật
- release inventory khi cancel sau bước reserve
- retry policy sâu hơn cho consumer
- RabbitMQ DLQ hoặc poison message handling
- database riêng cho inventory/payment
