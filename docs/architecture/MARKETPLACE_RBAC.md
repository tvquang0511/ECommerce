# Marketplace RBAC

## 1. Mục tiêu

Tài liệu này chốt mô hình quyền truy cập và các workflow nghiệp vụ cơ bản của marketplace theo đúng phạm vi học tập và codebase hiện tại.

## 2. Phạm vi

Tài liệu này tập trung vào:

- role,
- permission,
- ownership/scope,
- seller onboarding,
- admin workflow,
- tác động của RBAC lên product, cart và order.

## 3. Vai trò chính trong hệ thống

### Guest

- chỉ được xem và tìm kiếm sản phẩm
- không được thêm vào cart
- không được checkout

### Buyer

- là role mặc định của user đã đăng ký
- được quản lý cart và order của chính mình

### Seller

- là role bổ sung cho user muốn bán hàng
- quyền seller chỉ thực sự có hiệu lực khi seller đạt trạng thái hợp lệ theo workflow của `user-service`

### Admin

Hệ thống đang đi theo hướng nhiều role admin thay vì một admin chung:

- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

## 4. Nguyên tắc RBAC

RBAC trong repo này không chỉ dựa trên role. Quyền cuối cùng thường là kết quả của:

- role,
- permission,
- ownership,
- trạng thái nghiệp vụ.

Ví dụ:

- seller chỉ được sửa product của chính mình,
- seller chưa verified không được thực hiện đầy đủ seller actions,
- admin có thể nhìn rộng hơn nhưng vẫn nên tách theo nhóm trách nhiệm.

## 5. Product lifecycle là trung tâm của marketplace MVP

Một phần rất quan trọng của RBAC nằm ở product status:

`DRAFT -> PENDING_REVIEW -> APPROVED / REJECTED -> ARCHIVED`

Quyền thao tác lên product phụ thuộc cả vào:

- ai đang thao tác,
- product đang ở trạng thái nào,
- resource đó có thuộc về seller hiện tại hay không.

## 6. Áp dụng vào từng domain

### `user-service`

- quản lý identity, role, seller profile, admin domain

### `product-subgraph`

- áp product visibility
- áp owner-based actions
- áp seller verification policy
- áp admin moderation

### `cart-subgraph`

- guest không được add to cart
- buyer đã đăng nhập mới được thao tác cart
- chỉ cho thêm sản phẩm hợp lệ

### `order-subgraph`

- buyer chỉ thao tác order của chính mình
- seller chỉ nên xem order liên quan tới sản phẩm của shop mình
- admin xem và xử lý theo phạm vi trách nhiệm

## 7. Trade-off

### Điểm mạnh

- đủ thực tế cho marketplace học tập
- không quá nặng về mô hình permission engine
- bám sát flow hiện tại của codebase

### Giới hạn hiện tại

- chưa tách permission engine riêng
- ownership vẫn xử lý trong từng service
- chưa đi sâu vào delegated admin hay multi-tenant organization

## 8. Việc tiếp theo

- Chuẩn hóa mapping role/permission trong docs của `user-service`
- Rà lại policy docs của `product-subgraph`
- Khi `order-subgraph` mở rộng seller/admin query, cập nhật lại RBAC matrix tương ứng
