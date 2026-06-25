# Mục Lục Tài Liệu

Đây là mục lục chuẩn cho toàn bộ repo. Nếu bạn mới bắt đầu đọc dự án, hãy đi theo thứ tự:

1. [Repository README](../README.md)
2. [Trọng Tâm Hiện Tại - Tháng 6/2026](architecture/current-focus.md)
3. [Architecture Standard](architecture/architecture-standard.md)
4. [System Overview](architecture/overview.md)
5. [Auth Architecture](architecture/auth.md)
6. [RBAC Marketplace Access Control](architecture/rbac-marketplace-access-control.md)
7. [Services Specification](architecture/services.md)
8. [Component Diagram](diagrams/component-diagram.md)
9. [User Service Database Diagram](diagrams/database-diagram/user-service.md)
10. README riêng của từng service
11. Tài liệu thiết kế của `order-subgraph`
12. Tài liệu thiết kế của `product-subgraph`

---

## 1) Tài liệu kiến trúc

### Kiến trúc cốt lõi
- [Trọng Tâm Hiện Tại - Tháng 6/2026](architecture/current-focus.md)
- [Architecture Standard](architecture/architecture-standard.md)
- [System Overview](architecture/overview.md)
- [Services Specification](architecture/services.md)
- [Auth Architecture](architecture/auth.md)
- [RBAC Marketplace Access Control](architecture/rbac-marketplace-access-control.md)
- [Next.js Web Proxy](architecture/next-web-proxy.md)
- [Apollo + NestJS Learning Roadmap](architecture/apollo-nestjs-learning-roadmap.md)

### Mỗi file dùng để làm gì
- `current-focus.md`: nguồn sự thật ngắn gọn về trạng thái hiện tại của đồ án, nhất là hướng order/outbox/inventory/payment.
- `architecture-standard.md`: nguồn sự thật chuẩn cho toàn repo.
- `overview.md`: bức tranh tổng quan service boundaries, sync/async, infra.
- `services.md`: danh sách chức năng chi tiết của từng service/subgraph/worker.
- `auth.md`: authn/authz của `user-service`.
- `rbac-marketplace-access-control.md`: role, permission, scope, seller tier, approval flow.
- `next-web-proxy.md`: lý do và cách proxy auth qua Next.js.
- `apollo-nestjs-learning-roadmap.md`: roadmap học Apollo/NestJS theo giai đoạn.

---

## 2) Sơ đồ

- [Component Diagram](diagrams/component-diagram.md)
- [User Service Database Diagram](diagrams/database-diagram/user-service.md)

### Ghi chú về sơ đồ
- `component-diagram.md`: sơ đồ component-level của toàn hệ thống.
- `database-diagram/user-service.md`: ER-style diagram cho auth + RBAC schema của `user-service`.

---

## 3) Tài liệu theo từng service

### `product-subgraph`
- [Architecture Analysis](../services/product-subgraph/docs/ARCHITECTURE_ANALYSIS.md)
- [E-commerce Marketplace Design](../services/product-subgraph/docs/ECOMMERCE_MARKETPLACE_DESIGN.md)
- [Advanced RBAC and Workflows](../services/product-subgraph/docs/ADVANCED_RBAC_AND_WORKFLOWS.md)
- [Implementation Sprint Plan](../services/product-subgraph/docs/IMPLEMENTATION_SPRINT_PLAN.md)
- [product-subgraph README](../services/product-subgraph/README.md)

### `order-subgraph`
- [order-subgraph README](../services/order-subgraph/docs/README.md)
- [Order Lifecycle and Outbox Rules](../services/order-subgraph/docs/ORDER_LIFECYCLE_AND_OUTBOX_RULES.md)
- [Order Creation Design](../services/order-subgraph/docs/ORDER_CREATION_DESIGN.md)
- [Order Outbox Design](../services/order-subgraph/docs/ORDER_OUTBOX_DESIGN.md)

### `user-service`
- [user-service README](../services/user-service/README.md)

### `graphql-gateway`
- [graphql-gateway README](../services/graphql-gateway/README.md)

### `web`
- [apps/web README](../apps/web/README.md)

---

## 4) Tài liệu package và tooling

- [Root README](../README.md)
- [packages/eslint-config README](../packages/eslint-config/README.md)

---

## 5) Lộ trình đọc gợi ý

### Nếu bạn muốn xem kiến trúc trước
1. [Architecture Standard](architecture/architecture-standard.md)
2. [Trọng Tâm Hiện Tại - Tháng 6/2026](architecture/current-focus.md)
3. [System Overview](architecture/overview.md)
4. [Auth Architecture](architecture/auth.md)
5. [RBAC Marketplace Access Control](architecture/rbac-marketplace-access-control.md)
6. [Services Specification](architecture/services.md)
7. [Component Diagram](diagrams/component-diagram.md)

### Nếu bạn muốn đi thẳng vào hướng order/event-driven hiện tại
1. [Trọng Tâm Hiện Tại - Tháng 6/2026](architecture/current-focus.md)
2. [order-subgraph README](../services/order-subgraph/docs/README.md)
3. [Order Lifecycle and Outbox Rules](../services/order-subgraph/docs/ORDER_LIFECYCLE_AND_OUTBOX_RULES.md)
4. [Order Creation Design](../services/order-subgraph/docs/ORDER_CREATION_DESIGN.md)
5. [Order Outbox Design](../services/order-subgraph/docs/ORDER_OUTBOX_DESIGN.md)

### Nếu bạn muốn xem bài toán marketplace trước
1. [E-commerce Marketplace Design](../services/product-subgraph/docs/ECOMMERCE_MARKETPLACE_DESIGN.md)
2. [Advanced RBAC and Workflows](../services/product-subgraph/docs/ADVANCED_RBAC_AND_WORKFLOWS.md)
3. [Implementation Sprint Plan](../services/product-subgraph/docs/IMPLEMENTATION_SPRINT_PLAN.md)
4. [Architecture Analysis](../services/product-subgraph/docs/ARCHITECTURE_ANALYSIS.md)

---

## 6) Quy ước viết tài liệu cho repo này

- Tài liệu kiến trúc giải thích **vì sao** và **ranh giới**.
- Tài liệu service giải thích **service hoạt động như thế nào**.
- Tài liệu domain giải thích **luồng nghiệp vụ và vai trò**.
- Sơ đồ là phần tóm tắt trực quan của nguồn sự thật, không phải logic tách riêng.
- Nếu schema thay đổi, hãy cập nhật cả sơ đồ database và docs liên quan trong cùng một task.

---

## 7) Thứ tự nguồn sự thật

1. Code
2. File schema
3. Sơ đồ database
4. Architecture standard
5. Tài liệu kiến trúc / service
6. Các README tóm tắt

If there is a conflict, the code and schema win.
