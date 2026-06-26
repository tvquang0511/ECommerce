# Trọng Tâm Hiện Tại - Tháng 6/2026

Tài liệu này chốt lại hướng hiện tại của đồ án để tránh bị lệch giữa roadmap cũ và trạng thái thực tế trong code.

---

## 1. Mục tiêu hiện tại của project

Project hiện tại được định hướng thành một e-commerce learning sandbox để học các chủ đề backend nâng cao:

- ranh giới service rõ ràng theo domain
- Apollo Federation
- RBAC và auth theo nghiệp vụ thật
- cart và cache dựa trên Redis
- CQRS + DDD + Event Sourcing cho order
- outbox pattern
- giao tiếp event-driven với RabbitMQ

Mục tiêu không phải là làm đầy đủ mọi domain ngay lập tức, mà là hoàn thiện từng lớp kiến trúc có thể demo được.

---

## 2. Trạng thái hiện tại của các domain

### Đã có và đang dùng thật

- `user-service`
  - JWT auth
  - RBAC
  - seller onboarding
  - admin approval workflow

- `product-subgraph`
  - product catalog
  - seller/admin moderation states
  - media metadata + MinIO flow
  - GraphQL qua federation

- `cart-subgraph`
  - authenticated buyer cart
  - Redis-backed persistence
  - luồng chọn item trong cart
  - product snapshot phục vụ UX

- `order-subgraph`
  - CQRS skeleton thật
  - event store trên Postgres + Prisma
  - read model/projector trên Postgres + Prisma
  - `createOrderDirect`
  - `createOrderFromCart`
  - `submitOrder`
  - re-price draft trước submit
  - outbox design đã được chốt

### Sắp hoàn thiện để demo event-driven

- `order outbox`
  - ghi `order.submitted`
  - worker đọc `order_outbox`
  - publish message sang RabbitMQ

- `inventory-service`
  - service cơ bản để:
    - expose stock availability cho product/UI
    - reserve/reject stock cho order

- `payment-service`
  - chưa cần thanh toán thật
  - phase hiện tại chỉ cần:
    - consume được event từ RabbitMQ
    - phát lại callback/event kết quả cho order

---

## 3. Cách hiểu đúng về inventory và payment trong phase này

### Inventory

Inventory không phải product catalog.

Inventory tồn tại để giải quyết 2 việc:

- cho frontend/product biết trạng thái còn hàng ở mức tham khảo
- cho order reserve hàng thật tại lúc submit để tránh oversell

Trong phase demo, inventory-service chỉ cần đủ để:

- trả về stock status cơ bản
- reserve theo `orderId`
- reject nếu không đủ hàng
- publish kết quả về order

### Payment

Payment-service hiện tại không cần xử lý thanh toán thật.

Mục tiêu phase này chỉ là demo:

- order publish event sau submit
- payment nhận được message từ RabbitMQ
- payment gửi lại kết quả `authorized` hoặc `failed`
- order xử lý callback theo command side

Payment sẽ là chỗ để học blockchain ở phase sau, nên hiện tại nên giữ nó nhẹ và tập trung vào event flow.

---

## 4. Hướng outbox đã chốt

Order sẽ đi theo hướng:

```text
CommandHandler
  -> append event store
  -> publish domain event nội bộ
  -> outbox handler ghi order_outbox

Outbox worker
  -> đọc pending rows
  -> publish RabbitMQ
  -> mark published / retry
```

Lựa chọn hiện tại:

- dùng `NestJS Schedule` cho outbox worker
- interval khởi đầu đề xuất: `1000ms`
- batch khởi đầu đề xuất: `20`
- event store và outbox cùng dùng chung Postgres, khác bảng

---

## 5. Demo event-driven cần đạt được

Bản demo tối thiểu nên đi được luồng sau:

1. Buyer tạo draft order.
2. Buyer submit order.
3. `order.submitted` được ghi vào outbox.
4. Outbox worker publish sang RabbitMQ.
5. Inventory nhận được message và phản hồi `reserved` hoặc `rejected`.
6. Payment nhận được message và phản hồi `authorized` hoặc `failed`.
7. Order consume callback, append event mới, cập nhật projection.

Nếu demo được luồng này thì mục tiêu "event-driven cho khóa học" đã rất rõ ràng.

---

## 6. Thứ tự ưu tiên hiện tại

Thứ tự công việc nên bám theo:

1. Hoàn thiện `order_outbox` schema + index.
2. Hoàn thiện `OrderOutboxRepo`.
3. Hoàn thiện `OrderOutboxWorker` bằng `NestJS Schedule`.
4. Chuẩn hóa message contract `order.submitted`.
5. Scaffold `inventory-service` cơ bản.
6. Scaffold `payment-service` ở mức consume/publish event.
7. Nối callback về `order-subgraph`.

---

## 7. Docs tổng nên chứa gì

Bộ docs tổng của repo nên giúp một người mới nhìn vào hiểu 4 điều:

1. Project này đang giải bài toán gì.
2. Hiện tại đã làm xong những domain nào.
3. Hướng kiến trúc hiện tại là gì.
4. Nên đọc tài liệu nào trước khi vào code.

Vì vậy docs tổng nên ưu tiên:

- overview system
- current focus
- service boundaries
- reading path

Và không nên biến thành nơi liệt kê quá chi tiết từng milestone cũ nếu nó không còn sát trạng thái hiện tại.
