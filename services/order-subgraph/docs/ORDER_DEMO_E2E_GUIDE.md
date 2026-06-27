# Hướng Dẫn Demo End-to-End `createOrderDirect`

Tài liệu này dùng cho flow demo sau khi đã dựng stack bằng:

```powershell
docker compose -f infra/docker/docker-compose.demo.yml up --build
```

Mục tiêu:

- login qua `user-service`
- tạo draft order trực tiếp từ product
- submit order
- để `order-subgraph` publish outbox event qua RabbitMQ
- để `inventory-service` và `payment-service` consume event, callback ngược về order
- xác nhận order đi đến trạng thái `CONFIRMED`

## 1. Điều kiện trước khi test

Stack demo cần chạy đủ:

- `user-service`
- `product-subgraph`
- `order-subgraph`
- `inventory-service`
- `payment-service`
- `postgres`
- `mongo`
- `rabbitmq`
- `redis`
- `minio`
- `nginx`

Ngoài ra:

- `user-service` cần có dữ liệu seed cho tài khoản buyer demo
- `product-subgraph` cần có dữ liệu product seed
- JWT public key giữa `user-service`, `product-subgraph`, `order-subgraph` phải khớp

## 2. Các endpoint demo qua Nginx

Chỉ dùng đúng một cổng public là `8080`:

- user REST: `http://localhost:8080/api/users/...`
- GraphQL gateway: `http://localhost:8080/graphql`
- inventory REST: `http://localhost:8080/api/inventory/...`
- payment REST: `http://localhost:8080/api/payments/...`
- RabbitMQ UI: `http://localhost:8080/rabbitmq/`

## 3. Login lấy buyer access token

Request:

```http
POST http://localhost:8080/api/users/auth/login
Content-Type: application/json
```

Body:

```json
{
  "email": "buyer@demo.local",
  "password": "DevPassword123!"
}
```

Kết quả mong đợi:

- response trả về `accessToken`

## 4. Kiểm tra product có thể đặt

Gọi vào endpoint product GraphQL:

```text
http://localhost:8080/graphql
```

Headers:

```json
{
  "Authorization": "Bearer <BUYER_ACCESS_TOKEN>"
}
```

Query:

```graphql
query Products {
  products {
    id
    name
    status
    price
  }
}
```

Kết quả mong đợi:

- có danh sách product
- chọn một product `APPROVED`, ví dụ `p1003`

## 5. Tạo draft order bằng `createOrderDirect`

Gọi vào endpoint order GraphQL:

```text
http://localhost:8080/graphql
```

Headers:

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

Kết quả mong đợi:

- `status = DRAFT`
- `version = 0`
- lưu lại `orderId`

## 6. Query lại draft order

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
  "id": "<ORDER_ID>"
}
```

Kết quả mong đợi:

- `status = DRAFT`
- `inventoryStatus = NOT_REQUESTED`
- `paymentStatus = NOT_REQUESTED`

## 7. Submit order

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
    "orderId": "<ORDER_ID>",
    "expectedVersion": 0,
    "idempotencyKey": "order-submit-001"
  }
}
```

Kết quả mong đợi ngay sau submit:

- `status = SUBMITTED`

## 8. Chờ worker xử lý rồi query lại order

Chờ khoảng 1-3 giây, sau đó chạy lại query `order(id)` ở bước 6.

Kết quả mong đợi cuối cùng:

- `status = CONFIRMED`
- `inventoryStatus = RESERVED`
- `paymentStatus = AUTHORIZED`

## 9. Log cần quan sát khi demo

### `order-subgraph`

Kỳ vọng thấy log kiểu:

- outbox worker quét được pending entry
- flush thành công `order.submitted`

Ví dụ:

```text
Order outbox flush processed 1 entry (pending before flush: 1).
```

### `inventory-service`

Kỳ vọng:

- nhận message `inventory.reservation.requested`
- callback reserved về order thành công

### `payment-service`

Kỳ vọng:

- nhận message `payment.authorization.requested`
- callback authorized về order thành công

## 10. Kiểm tra sâu hơn nếu cần

### Kiểm tra RabbitMQ

Mở:

```text
http://localhost:8080/rabbitmq/
```

Tài khoản mặc định:

- user: `rabbit`
- password: `rabbit`

### Kiểm tra event store của order

Trong bảng `order_events`, một flow thành công thường có các event:

- `OrderCreatedDirect`
- `OrderSubmitted`
- `OrderInventoryReserved`
- `OrderPaymentAuthorized`
- `OrderConfirmed`

## 11. Mẹo test để tránh nhầm

- Mỗi lần test dùng `idempotencyKey` mới
- Nếu muốn test sạch, luôn tạo `orderId` mới bằng cách gọi lại `createOrderDirect`
- Không nên submit lại một order cũ đã `CONFIRMED`
- Nếu flow có lỗi cũ trong queue, restart lại `order-subgraph`, `inventory-service`, `payment-service` rồi test bằng order mới
