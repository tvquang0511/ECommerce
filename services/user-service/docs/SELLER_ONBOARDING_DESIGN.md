# Seller Onboarding Design

## 1. Mục tiêu

Tài liệu này mô tả thiết kế đầy đủ cho cơ chế `seller onboarding` trong `user-service`.

Mục tiêu của cơ chế này là:

- biến một `BUYER` thành một người bán hợp lệ trên sàn
- tách rõ các trạng thái: đã apply, đang chờ duyệt, đã được duyệt, bị khóa
- giữ `user-service` là source of truth cho:
  - seller profile
  - seller status
  - role và permission liên quan đến seller
- cung cấp dữ liệu chuẩn cho các subgraph khác qua `introspect`

Tài liệu này được viết để làm nền trước khi implement.

---

## 2. Vấn đề nghiệp vụ cần giải quyết

Một marketplace thực tế không nên cho user vừa đăng ký xong là bán hàng ngay.

Ta cần một luồng trung gian:

1. User đăng ký tài khoản
2. User verify email
3. User đăng nhập với tư cách `BUYER`
4. User nộp đơn trở thành seller
5. Admin kiểm tra và duyệt seller
6. Sau khi được duyệt, seller mới được tạo sản phẩm

Nếu không có seller onboarding:

- không phân biệt được buyer thường và người thực sự được phép bán
- không có điểm kiểm soát cho admin
- product-subgraph sẽ khó áp dụng rule “ai được tạo product”

---

## 3. Kết quả mong muốn

Sau khi hoàn thiện seller onboarding, hệ thống phải đạt được các trạng thái sau:

### Với buyer bình thường

- có role `BUYER`
- chưa có seller profile
- không được tạo product

### Với user đã apply seller

- có role `BUYER`
- có thêm role `SELLER`
- có `sellerProfile`
- `sellerProfile.status = PENDING_VERIFICATION`
- chưa được tạo product

### Với seller đã được duyệt

- có role `BUYER`
- có role `SELLER`
- `sellerProfile.status = VERIFIED`
- `sellerProfile.isKycVerified = true`
- được tạo và quản lý product của chính mình

### Với seller bị khóa

- vẫn có thể còn role `SELLER`
- nhưng `sellerProfile.status = SUSPENDED` hoặc `BANNED`
- bị chặn khỏi các thao tác bán hàng

---

## 4. Nguyên tắc thiết kế

### 4.1 `user-service` là source of truth

`user-service` chịu trách nhiệm lưu và cập nhật:

- role seller
- seller profile
- seller status
- tier seller
- audit log cho các hành động quan trọng

`product-subgraph` không nên tự lưu trạng thái seller riêng.

### 4.2 Role không đủ, phải đi cùng status

Một user có role `SELLER` chưa có nghĩa là được phép bán hàng.

Điều kiện bán hàng thực tế phải là:

- có role `SELLER`
- `sellerProfile.status === VERIFIED`
- `sellerProfile.isKycVerified === true`

Điều này giúp hệ thống:

- linh hoạt hơn
- không phải thêm quá nhiều role phụ
- dễ mở rộng khi có suspend, ban, pending

### 4.3 Role `SELLER` có thể được gán từ lúc apply

Quyết định này có lợi vì:

- user có thể vào seller dashboard
- UI có thể hiển thị trạng thái “đang chờ duyệt”
- vẫn không bán được hàng vì các service khác sẽ kiểm tra `sellerProfile.status`

Nói cách khác:

- role `SELLER` xác định “đây là người dùng thuộc seller area”
- status xác định “người đó đã được phép bán thực sự hay chưa”

### 4.4 Giữ MVP gọn, không mở rộng quá sớm

Ở giai đoạn này chưa cần:

- seller organization / nhiều thành viên trong shop
- KYC tài liệu thật
- workflow nhiều bước
- commission policy phức tạp
- seller premium / partner / affiliate

MVP chỉ cần:

- apply
- xem trạng thái
- admin approve
- admin suspend / ban nếu cần

---

## 5. Mô hình dữ liệu hiện tại và cách tận dụng

Trong `user-service`, schema hiện đã có `SellerProfile`:

- `userId`
- `shopName`
- `shopDesc`
- `status`
- `tier`
- `isKycVerified`
- `totalProducts`
- `totalOrders`
- `avgRating`

Và enum hiện có:

- `SellerStatus`
  - `PENDING_VERIFICATION`
  - `VERIFIED`
  - `SUSPENDED`
  - `BANNED`
- `SellerTier`
  - `INDIVIDUAL`
  - `MERCHANT`
  - `BRAND_PARTNER`
  - `PREMIUM`

Điều này có nghĩa là dữ liệu nền gần như đã đủ cho MVP seller onboarding.

Phần còn thiếu chủ yếu là:

- API
- business rule
- audit log
- docs và seed data

---

## 6. Luồng nghiệp vụ đề xuất

## 6.1 Luồng apply seller

```text
Buyer đã đăng nhập
  -> gửi yêu cầu apply seller
  -> hệ thống kiểm tra email đã verify chưa
  -> kiểm tra user đã có seller profile chưa
  -> tạo seller profile mới
  -> status = PENDING_VERIFICATION
  -> tier = INDIVIDUAL
  -> isKycVerified = false
  -> gán role SELLER nếu chưa có
  -> ghi audit log SELLER_APPLIED
```

### Điều kiện bắt buộc

- user phải đăng nhập
- email phải đã verify
- user chưa có seller profile trước đó
- `shopName` phải unique

### Kết quả trả về

- seller profile vừa tạo
- trạng thái `PENDING_VERIFICATION`
- thông điệp hướng dẫn chờ admin duyệt

---

## 6.2 Luồng xem trạng thái seller của chính mình

```text
User đã đăng nhập
  -> gọi API lấy seller profile hiện tại
  -> nếu chưa apply thì trả null hoặc trạng thái “not_seller”
  -> nếu đã apply thì trả sellerProfile + status
```

Luồng này rất cần cho frontend để:

- hiển thị nút “Become a seller”
- hoặc hiển thị “đang chờ duyệt”
- hoặc mở seller dashboard

---

## 6.3 Luồng admin duyệt seller

```text
Admin moderator / operations
  -> xem danh sách seller pending
  -> chọn 1 seller
  -> approve
  -> status = VERIFIED
  -> isKycVerified = true
  -> ghi audit log SELLER_VERIFIED
```

Sau bước này:

- seller có thể tạo product
- `introspect` sẽ trả về `sellerProfile.status = VERIFIED`
- `product-subgraph` sẽ cho phép qua `VerifiedSellerGuard`

---

## 6.4 Luồng admin suspend hoặc ban seller

```text
Admin
  -> chọn seller đã tồn tại
  -> chuyển trạng thái sang SUSPENDED hoặc BANNED
  -> ghi audit log
```

Ý nghĩa:

- seller vẫn tồn tại trong hệ thống
- nhưng không thể tiếp tục bán hàng
- product-subgraph sẽ tự chặn seller này ở các hành vi create/update product

---

## 7. API đề xuất

## 7.1 API cho user thường

### `POST /api/users/seller/apply`

Mục đích:

- gửi đơn đăng ký trở thành seller

Yêu cầu:

- cần `Authorization: Bearer <accessToken>`

Body đề xuất:

```json
{
  "shopName": "tech-zone",
  "shopDesc": "Cửa hàng thiết bị công nghệ"
}
```

Response đề xuất:

```json
{
  "sellerProfile": {
    "id": "sp_123",
    "userId": "user_123",
    "shopName": "tech-zone",
    "shopDesc": "Cửa hàng thiết bị công nghệ",
    "status": "PENDING_VERIFICATION",
    "tier": "INDIVIDUAL",
    "isKycVerified": false
  }
}
```

### `GET /api/users/seller/me`

Mục đích:

- lấy seller profile của user hiện tại

Response đề xuất:

```json
{
  "sellerProfile": {
    "id": "sp_123",
    "userId": "user_123",
    "shopName": "tech-zone",
    "shopDesc": "Cửa hàng thiết bị công nghệ",
    "status": "PENDING_VERIFICATION",
    "tier": "INDIVIDUAL",
    "isKycVerified": false,
    "totalProducts": 0,
    "totalOrders": 0,
    "avgRating": null
  }
}
```

Nếu chưa apply:

```json
{
  "sellerProfile": null
}
```

## 7.2 API cho admin

### `GET /api/users/admin/sellers`

Mục đích:

- liệt kê seller profiles, có thể lọc theo `status`

### `POST /api/users/admin/sellers/:sellerProfileId/approve`

Mục đích:

- duyệt seller

Tác động:

- `status -> VERIFIED`
- `isKycVerified -> true`

### `POST /api/users/admin/sellers/:sellerProfileId/suspend`

Mục đích:

- khóa seller

Tác động:

- `status -> SUSPENDED`

### `POST /api/users/admin/sellers/:sellerProfileId/ban`

Mục đích:

- khóa vĩnh viễn seller

Tác động:

- `status -> BANNED`

Ghi chú:

- Nếu muốn giữ MVP gọn hơn, có thể tạm thời chỉ làm `approve` và `suspend`

---

## 8. Business rule chi tiết

## 8.1 Rule cho `apply seller`

- nếu email chưa verify -> từ chối
- nếu user đã có seller profile -> từ chối
- nếu `shopName` đã tồn tại -> từ chối
- nếu user bị khóa trong tương lai -> từ chối

## 8.2 Rule cho `approve seller`

- chỉ admin mới được duyệt
- chỉ seller ở trạng thái `PENDING_VERIFICATION` mới được approve

## 8.3 Rule cho `suspend/ban seller`

- chỉ admin mới được thực hiện
- không được suspend/ban seller không tồn tại
- nếu đã `BANNED` rồi thì không cần xử lý lại

## 8.4 Rule cho `product-subgraph`

Sau khi seller onboarding xong, `product-subgraph` chỉ cần tin vào `introspect`:

- `roles` có `SELLER`
- `sellerProfile.status === VERIFIED`
- `sellerProfile.isKycVerified === true`

Như vậy logic seller được gom về đúng một nơi là `user-service`.

---

## 9. Audit log đề xuất

Nên thêm các event audit sau:

- `SELLER_APPLIED`
- `SELLER_VERIFIED`
- `SELLER_SUSPENDED`
- `SELLER_BANNED`

Metadata có thể gồm:

- `sellerProfileId`
- `shopName`
- `reason` nếu suspend/ban
- `approvedBy` hoặc actor admin hiện tại

Lợi ích:

- dễ debug
- tiện làm admin history
- chuẩn bị nền cho event-driven sau này

---

## 10. Tác động lên `introspect`

Sau khi seller onboarding hoạt động, `introspect` sẽ là đầu nối rất quan trọng.

Nó cần trả về seller state mới nhất:

```json
{
  "userId": "user_123",
  "email": "seller@example.com",
  "roles": ["BUYER", "SELLER"],
  "permissions": ["product:create"],
  "sellerProfile": {
    "status": "VERIFIED",
    "isKycVerified": true,
    "shopName": "tech-zone"
  },
  "exp": 1705000000
}
```

Nhờ đó:

- `product-subgraph` không cần biết DB của seller nằm ở đâu
- `cart-subgraph` và `order-subgraph` sau này cũng dùng được cùng contract

---

## 11. Seed data cần có

Trước khi chuyển sang frontend hoặc `order-subgraph`, nên seed ít nhất các trường hợp sau:

### User demo

- `buyer@demo.local`
  - role: `BUYER`
  - không có seller profile

- `seller-pending@demo.local`
  - roles: `BUYER`, `SELLER`
  - seller profile: `PENDING_VERIFICATION`

- `seller@demo.local`
  - roles: `BUYER`, `SELLER`
  - seller profile: `VERIFIED`
  - `isKycVerified = true`

- `admin@demo.local`
  - role: `ADMIN_MODERATOR` hoặc `SUPER_ADMIN`

Điều này rất hữu ích để test:

- apply seller
- approve seller
- tạo product với seller verified
- chặn seller pending

---

## 12. Đề xuất cấu trúc thư mục

Hiện tại `user-service` có module `auth` và `users`.
Seller onboarding nên tách thành module riêng để tránh nhồi quá nhiều logic vào `users`.

### Cấu trúc đề xuất

```text
services/user-service/src/modules/
  auth/
    auth.controller.ts
    auth.openapi.ts
    auth.repo.ts
    auth.router.ts
    auth.service.ts
    jwtKeys.ts

  users/
    users.controller.ts
    users.openapi.ts
    users.repo.ts
    users.router.ts
    users.service.ts

  sellers/
    sellers.controller.ts
    sellers.openapi.ts
    sellers.repo.ts
    sellers.router.ts
    sellers.service.ts
```

### Lý do tách module `sellers`

- seller onboarding là một domain riêng, không chỉ là profile user
- tránh làm `users.controller.ts` và `users.service.ts` phình quá lớn
- sau này dễ mở rộng:
  - seller analytics
  - seller documents
  - seller policies
  - admin seller moderation

### Trách nhiệm từng file

#### `sellers.controller.ts`

- parse input
- gọi service
- trả response

#### `sellers.service.ts`

- business logic apply/approve/suspend/ban
- kiểm tra rule nghiệp vụ
- ghi audit log

#### `sellers.repo.ts`

- đọc/ghi seller profile
- gán role seller
- query seller theo status/userId/shopName

#### `sellers.router.ts`

- định nghĩa route
- gắn `authJwt`
- sau này có thể gắn RBAC middleware nếu cần

#### `sellers.openapi.ts`

- tách riêng docs API seller

---

## 13. Route structure đề xuất

Để dễ đọc và dễ mở rộng, mình đề xuất:

### Route cho user tự thao tác

- `POST /api/users/seller/apply`
- `GET /api/users/seller/me`

### Route cho admin

- `GET /api/users/admin/sellers`
- `POST /api/users/admin/sellers/:sellerProfileId/approve`
- `POST /api/users/admin/sellers/:sellerProfileId/suspend`
- `POST /api/users/admin/sellers/:sellerProfileId/ban`

Lý do:

- rõ boundary user flow và admin flow
- dễ mapping ở frontend
- dễ viết docs

---

## 14. Lộ trình implement đề xuất

Nếu implement theo thứ tự ít rủi ro nhất, nên đi như sau:

### Bước 1

- tạo `sellers.repo.ts`
- tạo `sellers.service.ts`
- implement `POST /seller/apply`

### Bước 2

- implement `GET /seller/me`

### Bước 3

- implement admin approve seller

### Bước 4

- implement suspend/ban

### Bước 5

- cập nhật OpenAPI
- cập nhật README
- cập nhật seed data

---

## 15. Kết luận

Seller onboarding là bước tiếp theo hợp lý nhất của `user-service` sau khi `introspect` đã ổn định.

Nó giải quyết đúng bài toán nghiệp vụ quan trọng nhất còn thiếu:

- buyer không tự động trở thành người bán
- seller phải qua duyệt
- product-subgraph có thể tin vào một contract seller rõ ràng
- frontend có trạng thái rõ để dựng luồng seller dashboard

Thiết kế khuyến nghị cho MVP là:

- tạo module `sellers` riêng
- cho user `apply seller`
- cho admin `approve/suspend/ban`
- dùng `sellerProfile.status` làm business gate chính
- giữ `user-service` là source of truth cho seller state
