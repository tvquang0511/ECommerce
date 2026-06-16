# Cơ Chế Thao Tác Sản Phẩm

Tài liệu này mô tả cơ chế thao tác trên sản phẩm trong `product-subgraph` theo đúng luồng thực tế của đồ án hiện tại, đồng bộ với `user-service`.

## Mục tiêu

- Guest chỉ được xem sản phẩm đã duyệt.
- Buyer đăng nhập vẫn chỉ được xem sản phẩm đã duyệt.
- Seller chỉ được tạo và quản lý sản phẩm của chính mình khi đã được xác minh.
- Admin có quyền duyệt sản phẩm cho marketplace.
- Mọi service phải tin vào `user-service` để lấy actor thông qua `introspect`.

## Actor được lấy từ đâu

`product-subgraph` không tự giải mã RBAC độc lập. Khi có Bearer token, service gọi:

- `POST /api/users/auth/introspect`

Phản hồi tối thiểu:

```json
{
  "userId": "user-123",
  "email": "seller@demo.local",
  "roles": ["SELLER"],
  "permissions": [
    "product:create:self",
    "product:update:self",
    "product:publish:self",
    "product:archive:self"
  ],
  "sellerProfile": {
    "status": "VERIFIED",
    "isKycVerified": true,
    "shopName": "verified-shop"
  },
  "exp": 1780000000
}
```

`product-subgraph` chỉ dùng các trường này để ra quyết định auth.

## Nguyên tắc nghiệp vụ

### 1. Guest

- Được xem danh sách sản phẩm `APPROVED`
- Được xem chi tiết sản phẩm `APPROVED`
- Không được tạo, sửa, xóa, upload media, submit review

### 2. Buyer

- Giống guest ở phần đọc dữ liệu sản phẩm
- Không được quản lý sản phẩm

### 3. Seller pending, suspended, banned

- Có thể đăng nhập hệ thống
- Có thể nhìn thấy sản phẩm của mình nếu business muốn, nhưng không được thao tác mutation seller
- Không được tạo hoặc cập nhật sản phẩm vì chưa đạt điều kiện bán hàng

Trong MVP hiện tại, seller mutation yêu cầu seller phải:

- Có role `SELLER`
- `sellerProfile.status === VERIFIED`
- `sellerProfile.isKycVerified === true`

Nếu không đạt, guard chặn ngay tại GraphQL layer.

### 4. Verified seller

Verified seller được thao tác với sản phẩm của chính mình nếu có đúng permission:

- `product:create:self`
- `product:update:self`
- `product:publish:self`
- `product:archive:self`

Ngoài ra service tiếp tục check:

- seller chỉ được thao tác với product có `sellerId === actor.userId`
- không được update product đã `ARCHIVED`
- phải tuân thủ state transition hợp lệ

### 5. Admin

Admin trong `product-subgraph` hiện tại đóng vai moderation:

- Duyệt sản phẩm `PENDING_REVIEW -> APPROVED`
- Từ chối sản phẩm `PENDING_REVIEW -> REJECTED`

MVP này vẫn cho phép admin đi qua bằng role:

- `ADMIN_*`
- `SUPER_ADMIN`

Lý do:

- `user-service` đã có role admin ổn định
- chức năng product moderation chưa tách thành bộ permission riêng

Khi mở rộng sau này, có thể tách thêm:

- `admin:product:review`
- `admin:product:approve`
- `admin:product:reject`

## Chain bảo vệ cho mutation seller

Mỗi mutation seller nên đi theo chain:

1. `AuthGuard`
2. `VerifiedSellerGuard`
3. `PermissionGuard`
4. Service ownership check

Điều này giúp tách rõ 4 lớp trách nhiệm:

- `AuthGuard`: người dùng đã đăng nhập chưa
- `VerifiedSellerGuard`: có được phép bán hàng chưa
- `PermissionGuard`: có đúng quyền thao tác này không
- Service: có đúng sản phẩm của chính người đó không

## Mapping permission theo từng thao tác

### Seller mutations

- `createProduct` -> `product:create:self`
- `updateProduct` -> `product:update:self`
- `createProductMediaUploadUrl` -> `product:update:self`
- `confirmProductMediaUpload` -> `product:update:self`
- `removeProductMedia` -> `product:update:self`
- `submitProductForReview` -> `product:publish:self`
- `archiveProduct` -> `product:archive:self`
- `deleteProduct` -> tạm thời dùng `product:archive:self`

Ghi chú:

- `deleteProduct` hiện vẫn là hard delete trong code. Về nghiệp vụ thực tế, nên ưu tiên `archive` hơn là xóa thật.
- Nếu sau này bạn muốn an toàn hơn, nên đổi `deleteProduct` thành `soft delete only` hoặc bỏ hẳn mutation này.

### Admin mutations

- `approveProduct` -> role `ADMIN_*` hoặc `SUPER_ADMIN`
- `rejectProduct` -> role `ADMIN_*` hoặc `SUPER_ADMIN`

## Luồng seller thao tác sản phẩm

1. User đăng ký tại `user-service`
2. Xác minh email
3. Đăng ký seller
4. Admin duyệt seller
5. `user-service` trả về introspect có:
   - role `SELLER`
   - `sellerProfile.status = VERIFIED`
   - `isKycVerified = true`
6. Seller tạo product trong `product-subgraph`
7. Product ở trạng thái `DRAFT`
8. Seller submit review
9. Admin approve hoặc reject
10. Nếu approve, product mới hiện công khai cho guest và buyer

## Rule hiển thị dữ liệu

- Guest và buyer: chỉ thấy `APPROVED`
- Seller: thấy `APPROVED` và sản phẩm của chính mình
- Admin: thấy tất cả

## Hướng mở rộng tiếp theo

- Tách bộ permission riêng cho admin moderation sản phẩm
- Thêm audit event cho product lifecycle
- Chuyển `deleteProduct` thành soft delete
- Thêm `unarchive` nếu business cần
- Thêm rule chặn seller `SUSPENDED` xem dashboard seller nếu cần
