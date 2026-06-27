# Architecture Principles

## 1. Mục tiêu

Tài liệu này là nguồn tham chiếu chuẩn cho kiến trúc tổng của dự án. Khi các tài liệu kiến trúc khác có cách diễn đạt khác nhau, file này được xem là nơi chốt nguyên tắc ở mức hệ thống.

## 2. Phạm vi

Tài liệu này chốt các nguyên tắc lớn:

- cách chia service theo domain,
- quyền sở hữu dữ liệu,
- luồng sync và async,
- vị trí của auth/RBAC trong hệ thống,
- nguyên tắc tổ chức tài liệu kiến trúc.

## 3. Kiến trúc chuẩn ở mức cao

```text
Next.js Web
  -> Nginx / Edge proxy
    -> GraphQL Gateway
      -> product-subgraph
      -> cart-subgraph
      -> order-subgraph

Next.js Web
  -> Nginx / Edge proxy
    -> user-service

Internal services
  -> inventory-service
  -> payment-service
  -> notification-worker
```

## 4. Các nguyên tắc bắt buộc

### Database-per-service

Mỗi service sở hữu dữ liệu của chính nó. Service khác không được query thẳng database của service đó.

### Domain-first boundaries

Boundary chính hiện tại:

- `user-service`: identity, auth, seller, admin domain
- `product-subgraph`: catalog và product moderation
- `cart-subgraph`: buyer cart trên Redis
- `order-subgraph`: giao dịch order và lifecycle của order

### Single entrypoint cho UI

- UI nên đi qua gateway hoặc proxy.
- Auth REST vẫn nằm ở `user-service`.
- Domain data phù hợp với GraphQL nên đi qua federation.

### Eventual consistency

Các flow đa service không cố gắng dùng distributed transaction. Hệ thống chấp nhận eventual consistency và bù lại bằng:

- callback rõ ràng,
- retry,
- idempotency,
- outbox.

### Outbox cho integration event quan trọng

Với `order-subgraph`, event nghiệp vụ được chốt trong database trước, sau đó outbox đảm nhiệm việc phát integration event ra RabbitMQ.

## 5. Vai trò của các công nghệ chính

- `PostgreSQL + Prisma`: phù hợp cho auth và order event store/read model
- `MongoDB`: phù hợp cho catalog sản phẩm
- `Redis`: phù hợp cho cart và cache ngắn hạn
- `RabbitMQ`: phù hợp cho event-driven integration giữa service
- `MinIO`: lưu media theo hướng object storage

## 6. Rule thiết kế tài liệu

- Tài liệu tổng đặt trong `docs/`
- Tài liệu riêng của service đặt trong `services/<service>/docs/`
- `docs/architecture/` dùng cho quyết định ở mức hệ thống
- Khi flow runtime hoặc boundary đổi, docs liên quan phải cập nhật trong cùng task

## 7. Những gì chưa nên làm quá sớm

- Không mở rộng thêm nhiều service business mới khi nền vận hành chưa chắc
- Không phức tạp hóa payment/inventory vượt quá nhu cầu demo học tập ở giai đoạn hiện tại
- Không đẩy AI vào core transaction trước khi event flow và read model ổn định

## 8. Việc tiếp theo

- Chuẩn hóa observability và logging xuyên service
- Chuẩn hóa CI/CD cho backend hiện tại
- Sau khi ổn định mới mở rộng sâu hơn ở payment, inventory hoặc notification
