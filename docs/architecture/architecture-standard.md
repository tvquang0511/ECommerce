# Architecture Standard — E-commerce Marketplace

Tài liệu này là **nguồn sự thật chuẩn** cho kiến trúc của đồ án. Các tài liệu khác trong `docs/architecture/` và `docs/diagrams/` phải đọc theo quy ước này.

Mục tiêu:
- Làm rõ service boundaries.
- Làm rõ service nào sở hữu dữ liệu gì.
- Làm rõ luồng sync/async.
- Làm rõ authn/authz.
- Làm rõ cách viết docs để phù hợp với đánh giá tuyển dụng.

---

## 1) Kiến trúc chuẩn

```text
Next.js Web
  -> Nginx / Edge proxy
    -> GraphQL Gateway (Apollo Federation)
      -> product-subgraph (MongoDB + Redis + MinIO)
      -> cart-subgraph (Redis)
      -> order-subgraph (Postgres + outbox)
      -> ...

Next.js Web
  -> Nginx / Edge proxy
    -> user-service (REST auth)

Internal services:
  -> inventory-service (REST)
  -> payment-service (REST)
  -> notification-worker (RabbitMQ consumer)
```

### Quy tắc lớn

1. **Database-per-service**: service khác không query thẳng DB của nhau.
2. **Gateway là entrypoint cho domain data**: UI đi qua GraphQL Gateway.
3. **Auth giữ REST**: refresh cookie và login/logout vẫn nằm ở `user-service`.
4. **Authorization theo service**: gateway không thay service quyết định quyền.
5. **Async cho side effects**: email, cache invalidation, analytics đi qua RabbitMQ.
6. **Idempotency cho thao tác quan trọng**: checkout, reserve, authorize, webhook.

---

## 2) Service boundaries chuẩn

### `user-service`
Sở hữu:
- users
- refresh sessions/tokens
- auth sessions
- seller profile
- role / permission / audit log

Làm:
- register/login/refresh/logout
- 2FA
- seller onboarding
- phát JWT access token

Không làm:
- catalog query
- cart/order/payment domain logic

### `product-subgraph`
Sở hữu:
- product catalog
- product images metadata
- product search index fields
- approval workflow

Làm:
- create/update product
- submit/approve/reject product
- search/filter/sort products

Không làm:
- login/refresh token
- checkout/payment
- inventory reservation

### `cart-subgraph`
Sở hữu:
- cart state

Làm:
- add/update/remove cart items
- merge cart

### `order-subgraph`
Sở hữu:
- orders
- order items snapshot
- outbox events

Làm:
- checkout orchestration
- order state machine

### `inventory-service`
Sở hữu:
- stock
- reservations

### `payment-service`
Sở hữu:
- payment intents / transactions

### `notification-worker`
Sở hữu:
- không sở hữu business DB

Làm:
- consume events
- gửi email

---

## 3) AuthN / AuthZ chuẩn

### Authentication
- Access token: JWT `RS256`
- Refresh token: opaque random token, lưu hash trong DB
- Refresh cookie: HttpOnly
- 2FA: email OTP khi cần

### Authorization
Không dùng chỉ một enum role để chặn mọi thứ. Chuẩn của repo này là:

- **Role**: nhóm người dùng lớn
- **Permission**: hành động cụ thể
- **Scope**: phạm vi dữ liệu được phép thao tác
- **Status**: trạng thái tài khoản / seller / product

Ví dụ:
- buyer: `product:view_approved`
- seller: `product:create`, `product:edit_own`, `product:submit_for_approval`
- admin: `product:approve`, `seller:verify`, `seller:suspend`

### Quy tắc thực thi
- `user-service` phát token và giữ state auth.
- `product-subgraph` kiểm tra ownership + seller status + permission trước khi mutate.
- `gateway` chỉ forward token, không quyết định business auth.

---

## 4) Product marketplace rules

### Lifecycle chuẩn cho product
```text
DRAFT -> PENDING_APPROVAL -> APPROVED / REJECTED -> DELISTED
```

### Visibility chuẩn
- Buyer chỉ thấy `APPROVED` + active.
- Seller thấy product của chính mình theo scope.
- Admin thấy tất cả.

### Seller chuẩn
- Seller không phải chỉ là role; seller là **account state + profile + tier**.
- Tối thiểu cần:
  - `SellerProfile.status`
  - `SellerProfile.tier`
  - ownership `sellerId` trong product

---

## 5) Sync / Async rules

### Sync (HTTP / GraphQL)
Dùng cho:
- query data
- command cần phản hồi ngay
- validation trước khi commit nghiệp vụ

### Async (RabbitMQ)
Dùng cho:
- email notification
- cache invalidation
- analytics
- outbox publishing

### Outbox
Nếu service vừa ghi DB vừa publish event, phải có outbox để tránh lệch trạng thái.

---

## 6) Documentation standard

Docs của repo nên chia thành 4 nhóm:

1. **Architecture Overview**
   - service boundaries
   - data ownership
   - sync/async

2. **Domain Design**
   - marketplace roles
   - product lifecycle
   - approval flow
   - seller onboarding

3. **Service Spec**
   - endpoints
   - queries/mutations
   - events
   - storage model

4. **Decision Log / ADR**
   - vì sao chọn MongoDB
   - vì sao auth giữ REST
   - vì sao gateway không tự làm authz
   - vì sao RBAC tách permission/scope

### Cách viết chuẩn
Mỗi tài liệu nên đi theo mẫu:

1. Problem
2. Decision
3. Why
4. Tradeoff
5. Flow
6. API / schema example
7. Future extension

---

## 7) Những quyết định kiến trúc cố định

Các quyết định sau xem như đã chốt cho repo này:

- Product catalog dùng **MongoDB + Mongoose**.
- Auth dùng **user-service REST + Prisma/Postgres**.
- Gateway dùng **Apollo Federation**.
- Cart dùng **Redis primary store**.
- Order dùng **Postgres + outbox**.
- Notification dùng **RabbitMQ consumer**.
- RBAC dùng **role + permission + scope + status**.
- Docs phải phản ánh đúng source of truth, không mô tả lệch schema.

---

## 8) Links đọc tiếp

- Tổng quan hệ thống: [overview.md](overview.md)
- Auth: [auth.md](auth.md)
- RBAC marketplace: [rbac-marketplace-access-control.md](rbac-marketplace-access-control.md)
- Service spec: [services.md](services.md)
