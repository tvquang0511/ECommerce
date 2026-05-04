# RBAC for Marketplace Access Control

Tài liệu này mô tả cách thiết kế quyền truy cập cho sàn thương mại điện tử của đồ án, dựa trên mô hình thực tế của Amazon, Lazada, Shopee.

Mục tiêu của tài liệu:
- Giải thích vì sao `enum Role { BUYER, SELLER, ADMIN }` là chưa đủ nếu muốn mở rộng lâu dài.
- Đề xuất cấu trúc RBAC phù hợp cho marketplace và đủ gần với hệ thống thật.
- Mô tả rõ các luồng chính: đăng ký, trở thành seller, tạo product, duyệt product, buyer tìm kiếm.

---

## 1) Kết luận ngắn

Nếu chỉ làm demo nhỏ thì 3 role cơ bản có thể đủ để bắt đầu. Nhưng nếu muốn đồ án nhìn giống hệ thống thật và có thể mở rộng, nên tách quyền theo 3 lớp:

1. **Role**: ai là người dùng.
2. **Permission**: người đó được làm gì.
3. **Scope/Ownership**: được làm trên dữ liệu nào.

Nói ngắn gọn:
- `Role` là nhãn lớn.
- `Permission` là chỗ chặn hành vi.
- `Scope` là chỗ quyết định “chỉ của tôi hay toàn hệ thống”.

---

## 2) Vì sao chỉ dùng 3 role là chưa đủ

```ts
enum Role {
  BUYER,
  SELLER,
  ADMIN,
}
```

Thiết kế này chạy được ở mức khởi đầu, nhưng không mô tả tốt nhiều tình huống thật:

- Một admin không phải lúc nào cũng có toàn quyền.
- Seller có thể chia thành nhiều mức: cá nhân, shop, brand, premium.
- Một user có thể vừa là buyer vừa là seller.
- Một số hành động chỉ nên cho làm trên tài nguyên của chính mình.
- Một số màn hình admin chỉ nên cho moderation, không nên cho finance.

Các sàn lớn thường không dừng ở 3 role cứng. Họ thường có:
- account type
- permission set
- scope
- status

---

## 3) Mẫu thiết kế khuyến nghị cho đồ án

### 3.1 Mô hình 4 lớp

#### Lớp 1: Identity
- Email, password hash, profile, avatar, phone.
- Đây là phần `user-service` đã có.

#### Lớp 2: Role
- `BUYER`
- `SELLER`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

#### Lớp 3: Permission
Ví dụ:
- `product:create`
- `product:edit_own`
- `product:submit_for_approval`
- `product:approve`
- `product:reject`
- `seller:verify`
- `seller:suspend`
- `analytics:view_all`

#### Lớp 4: Scope
Ví dụ:
- `own`
- `own_shop`
- `all`
- `all_with_filter`

---

## 4) RBAC nên đặt ở đâu trong kiến trúc

### 4.1 `user-service` là nguồn sự thật

`user-service` nên chịu trách nhiệm:
- đăng ký, đăng nhập, refresh token
- lưu role và permission gốc
- lưu seller profile, trạng thái seller
- phát JWT access token có claim cần thiết

`user-service` không nên làm catalog logic.

### 4.2 `product-subgraph` chỉ kiểm tra quyền cần thiết

`product-subgraph` nên chịu trách nhiệm:
- tạo product
- sửa product
- submit product for approval
- admin approve/reject
- search/filter/sort products

Service này phải tự kiểm tra:
- user có phải seller không
- seller đã verified chưa
- có permission phù hợp không
- hành động đó có nằm trong scope của user không

### 4.3 `gateway` không nên quyết định quyền

Gateway chỉ nên:
- forward `Authorization`
- forward `x-request-id`
- compose schema

Gateway không nên tự kiểm tra logic nghiệp vụ kiểu:
- user này có được duyệt product không
- seller này có được tạo product không

Lý do: quyền phụ thuộc vào domain data của từng service.

---

## 5) Schema khuyến nghị cho user-service

Nên giữ cấu trúc này:

- `User`: thông tin người dùng
- `Role`: danh mục role
- `UserRole`: gán role cho user
- `Permission`: danh mục quyền
- `RolePermission`: gán quyền cho role
- `UserPermission`: quyền riêng cho một user nếu cần override
- `SellerProfile`: profile của người bán
- `AuditLog`: log hành động quan trọng

### Gợi ý thực tế cho MVP

Để không bị quá nặng lúc đầu, có thể ưu tiên theo thứ tự:
1. `BUYER` và `SELLER` trước.
2. `ADMIN_MODERATOR` sau.
3. `SellerStatus` bắt buộc có.
4. `SellerTier` để mở rộng sau.
5. `Permission` đầy đủ triển khai dần.

Nghĩa là: enum 3 role vẫn có thể là lớp bootstrap, nhưng schema phải mở rộng được.

---

## 6) Luồng hoạt động cụ thể

### 6.1 Luồng đăng ký tài khoản

```text
User đăng ký
  -> tạo User
  -> gán role mặc định = BUYER
  -> tạo access token + refresh token
  -> nếu chưa verify email thì vẫn có thể xem sản phẩm, nhưng bị chặn hành động nhạy cảm
```

### 6.2 Luồng trở thành seller

```text
User -> Apply to become seller
  -> kiểm tra email / trạng thái tài khoản
  -> tạo SellerProfile
  -> status = PENDING_VERIFICATION
  -> admin duyệt
     -> approved: status = VERIFIED
     -> rejected: giữ trạng thái rejected/suspended
```

### 6.3 Luồng tạo product

```text
Seller mở form tạo product
  -> backend lấy userId từ JWT, không lấy từ body
  -> kiểm tra user có role seller không
  -> kiểm tra SellerProfile.status == VERIFIED
  -> tạo product với sellerId = userId
  -> status = DRAFT
  -> seller tự submit for approval
```

### 6.4 Luồng duyệt product

```text
Seller submit product
  -> DRAFT -> PENDING_APPROVAL
Admin review
  -> approve -> APPROVED
  -> reject -> REJECTED
Buyer search
  -> chỉ thấy APPROVED + active
```

### 6.5 Luồng buyer tìm kiếm

```text
Buyer search
  -> query full-text
  -> filter theo category/price/tags
  -> chỉ trả product APPROVED
  -> sort + pagination
```

---

## 7) Các rule nên viết thành policy

### Account policy
- tài khoản active mới được thao tác
- tài khoản suspended/banned bị chặn

### Seller policy
- chỉ seller verified mới được tạo product
- seller pending chỉ được xem dashboard giới hạn
- seller banned không được xuất hiện trong search

### Product policy
- draft chỉ seller owner được sửa
- pending approval chỉ admin được duyệt
- approved mới public

### Admin policy
- moderator duyệt sản phẩm
- operations quản lý category/policy
- analytics xem report

---

## 8) Phong cách viết docs nên dùng cho repo này

### Nên tách thành 4 nhóm tài liệu

#### 1. Architecture Overview
Mục tiêu: mô tả toàn hệ thống, boundaries, data ownership, sync/async.

#### 2. Domain Design
Mục tiêu: mô tả nghiệp vụ marketplace, role, product lifecycle, approval flow.

#### 3. Service Specification
Mục tiêu: liệt kê endpoint, mutation, query, schema, events của từng service.

#### 4. Decision / ADR
Mục tiêu: tại sao chọn MongoDB, tại sao không repository, tại sao RBAC nhiều lớp.

### Cách viết để nhà tuyển dụng dễ đọc
1. Vấn đề.
2. Quyết định.
3. Lý do.
4. Tradeoff.
5. Luồng hoạt động.
6. Ví dụ API / schema.
7. Cách mở rộng.

---

## 9) Kết luận

`enum Role { BUYER, SELLER, ADMIN }` là **đủ để bắt đầu**, nhưng **không đủ để làm kiến trúc marketplace bền**.

Thiết kế hợp lý hơn là:
- dùng role để phân nhóm lớn
- dùng permission để chặn hành động cụ thể
- dùng scope để kiểm soát dữ liệu theo ownership
- dùng seller status/tier để mô tả vòng đời và phân hạng seller

---

## 10) File liên quan

- Auth hiện tại: [auth.md](auth.md)
- Tổng quan hệ thống: [overview.md](overview.md)
- Service boundaries: [services.md](services.md)
- Database schema user-service: [user-service.md](../diagrams/database-diagram/user-service.md)
