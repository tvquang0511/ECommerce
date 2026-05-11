# Product Subgraph Docs Index

Mục lục chuẩn cho toàn bộ tài liệu của `product-subgraph`.

## Reading order
1. [Service README](../README.md)
2. [Architecture Analysis](ARCHITECTURE_ANALYSIS.md)
3. [E-commerce Marketplace Design](ECOMMERCE_MARKETPLACE_DESIGN.md)
4. [Advanced RBAC and Workflows](ADVANCED_RBAC_AND_WORKFLOWS.md)
5. [Implementation Sprint Plan](IMPLEMENTATION_SPRINT_PLAN.md)
6. [Next Steps Plan](NEXT_STEPS_PLAN.md)
7. [Sequential Weekly Roadmap](WEEKLY_ROADMAP.md)

## What each file is for

- `../README.md`: giới thiệu ngắn gọn service, endpoints, runtime config, core files.
- `ARCHITECTURE_ANALYSIS.md`: phân tích cấu trúc hiện tại của service.
- `ECOMMERCE_MARKETPLACE_DESIGN.md`: nghiệp vụ marketplace, role, product, search, workflow.
- `ADVANCED_RBAC_AND_WORKFLOWS.md`: RBAC nhiều lớp, policy, workflow nâng cao.
- `IMPLEMENTATION_SPRINT_PLAN.md`: kế hoạch thực thi theo sprint.
- `NEXT_STEPS_PLAN.md`: kế hoạch tiếp theo cho user-service, product, gateway, và web app.
- `WEEKLY_ROADMAP.md`: roadmap theo tuần nhưng làm tuần tự từng service một, không chạy song song 4 mảng.

## Standardization rules

- Giữ một nguồn sự thật cho kiến trúc: code và schema.
- Mọi tài liệu về product phải thống nhất các khái niệm: seller, buyer, admin, approval, status.
- Nếu schema hoặc contract đổi, cập nhật README và docs index cùng lúc.

## Suggested future cleanup

Nếu sau này bạn muốn dọn gọn hơn nữa, có thể gộp 4 tài liệu bên trên thành 2 file:
- một file cho **architecture/current state**
- một file cho **marketplace domain/RBAC**
