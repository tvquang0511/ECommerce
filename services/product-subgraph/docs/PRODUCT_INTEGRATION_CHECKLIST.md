# Product Integration Checklist

Checklist này giúp bạn xác nhận `product-subgraph` đang tích hợp đúng với `user-service`.

## Mục tiêu

- AuthGuard lấy được actor từ JWT
- `introspect` trả đúng `roles`, `permissions`, `sellerProfile`
- Seller verified mới thao tác được product mutation
- Admin mới approve hoặc reject được product

## Trước khi test

- `user-service` chạy ở `http://localhost:4001`
- `product-subgraph` chạy ở `http://localhost:4002/graphql`
- MongoDB đã chạy
- Dữ liệu seed cho user và product đã có

## Bước 1. Xác nhận login ở `user-service`

- Login bằng `seller@demo.local`
- Login bằng `admin@demo.local`
- Login bằng `seller-pending@demo.local`

Bạn cần lấy `accessToken` từ mỗi account để test tiếp.

## Bước 2. Xác nhận introspect contract

Gọi:

```http
POST http://localhost:4001/api/users/auth/introspect
Authorization: Bearer <sellerAccessToken>
Content-Type: application/json

{}
```

Kỳ vọng tối thiểu:

```json
{
  "userId": "...",
  "email": "seller@demo.local",
  "roles": ["BUYER", "SELLER"],
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
  }
}
```

## Bước 3. Xác nhận guard chain của product

### Seller verified

- `createProduct` phải chạy được
- `submitProductForReview` phải chạy được

### Seller pending

- `createProduct` phải bị chặn
- Lỗi mong đợi: thiếu verified seller hoặc thiếu permission usable

### Buyer

- `createProduct` phải bị chặn

### Admin

- `approveProduct` và `rejectProduct` phải chạy được
- Admin vẫn không phải là seller, nên không nên dùng `createProduct`

## Bước 4. Xác nhận visibility rule

- Guest chỉ thấy `APPROVED`
- Buyer chỉ thấy `APPROVED`
- Seller thấy `APPROVED` và sản phẩm của chính mình
- Admin thấy tất cả trạng thái

## Bước 5. Xác nhận cart sẽ dùng được product data

Khi qua `cart-subgraph`, tối thiểu cần xác nhận:

- Có ít nhất một product `APPROVED`
- `product.id`, `name`, `price`, `currency` là dữ liệu ổn định
- Guest không add cart
- Buyer đăng nhập có thể add các product `APPROVED`

## Kết luận đạt yêu cầu khi

- Login và introspect đều ổn
- Guard chain chạy đúng theo role và seller status
- Product seed đủ trạng thái để test business flow
- Có ít nhất 2 sản phẩm `APPROVED` để frontend và cart dùng thử
