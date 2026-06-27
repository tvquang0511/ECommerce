# Trọng Tâm Hiện Tại

## 1. Mục tiêu

Tài liệu này chốt lại phần đang được ưu tiên trong dự án ở thời điểm hiện tại để tránh lệch giữa roadmap cũ, tài liệu cũ và code đang chạy thật.

## 2. Phạm vi

Tài liệu này chỉ trả lời 3 câu hỏi:

- hiện tại hệ thống đã làm được những gì,
- phần nào đang là trọng tâm học sâu,
- phần nào tạm thời chưa nên mở rộng thêm.

## 3. Bối cảnh hiện tại

Dự án hiện được định hướng thành một e-commerce learning sandbox để học backend và kiến trúc hệ thống theo chiều sâu, không còn là CRUD demo đơn thuần.

Các chủ đề kỹ thuật đang hiện diện rõ trong codebase:

- tách service theo domain,
- Apollo Federation,
- auth và RBAC theo nghiệp vụ,
- Redis cho cart/cache,
- CQRS + DDD + Event Sourcing cho order,
- outbox pattern,
- event-driven flow với RabbitMQ.

## 4. Trọng tâm kỹ thuật hiện tại

Trọng tâm lớn nhất của repo hiện nay là hoàn thiện trục:

`user-service -> product-subgraph -> cart-subgraph -> order-subgraph`

và dùng `order-subgraph` làm nơi học sâu về:

- CQRS,
- aggregate,
- event store,
- projection/read model,
- outbox,
- eventual consistency,
- callback integration.

Các service `inventory-service` và `payment-service` hiện chỉ nên dừng ở mức đủ để demo và học event-driven, chưa phải trọng tâm mở rộng tính năng.

## 5. Những gì đã dùng được thật

### `user-service`

- JWT auth
- RBAC
- seller onboarding
- admin workflow cơ bản

### `product-subgraph`

- product catalog
- moderation state
- seller/admin policy
- GraphQL qua federation

### `cart-subgraph`

- buyer cart đã đăng nhập
- Redis-backed persistence
- chọn item cụ thể để checkout

### `order-subgraph`

- CQRS skeleton dùng thật
- event store trên Postgres + Prisma
- read model/projector trên Postgres
- `createOrderDirect`
- `createOrderFromCart`
- `submitOrder`
- rule repricing trước submit
- outbox design đã hình thành

## 6. Những gì đang ở mức demo/phụ trợ

### `inventory-service`

- đủ để cấp stock status cơ bản,
- đủ để reserve/reject stock cho flow order,
- chưa phải service inventory production-grade.

### `payment-service`

- đủ để consume event và callback kết quả,
- dùng để hoàn thiện flow async của order,
- chưa phải nơi đầu tư sâu về thanh toán thật ở giai đoạn này.

## 7. Quyết định hiện tại

- Không mở rộng thêm quá nhiều domain mới trong ngắn hạn.
- Ưu tiên làm hệ thống hiện có ổn định, dễ chạy, dễ test, dễ demo.
- Chuyển dần trọng tâm sang quy trình chuyên nghiệp hơn:
  - docs,
  - git workflow,
  - CI/CD,
  - observability,
  - deployment.

## 8. Việc tiếp theo

- Chuẩn hóa tài liệu và quy trình cộng tác.
- Chuẩn hóa local/dev setup.
- Bổ sung CI cơ bản.
- Nâng chất lượng logging, health check và test.
