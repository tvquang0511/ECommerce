# cart-subgraph

Mục tiêu: `cart-subgraph` là GraphQL subgraph quản lý giỏ hàng cho **người dùng đã đăng nhập**.
Service này phối hợp với `user-service` để xác thực và với `product-subgraph` để lấy snapshot sản phẩm khi thêm vào giỏ.

## Tài liệu nên đọc thêm

- `README.md`: tổng quan service
- `CART_TEST_GUIDE.md`: hướng dẫn test buyer flow end-to-end từ product sang cart

## Phạm vi

- Chỉ hỗ trợ **user cart**
- Không hỗ trợ guest cart
- Không còn luồng `mergeCart`
- Chỉ cho thêm sản phẩm có trạng thái `APPROVED`
- Cart lưu snapshot giá/tên/ảnh tại thời điểm thêm vào giỏ

## Stack

- NestJS
- Apollo Federation Subgraph
- Redis làm primary store
- JWT từ `user-service`

## GraphQL contract hiện tại

```graphql
type Query {
  cart: Cart
}

type Mutation {
  addToCart(input: AddToCartInput!): Cart!
  updateCartItem(input: UpdateCartItemInput!): Cart!
  removeCartItem(input: RemoveCartItemInput!): Cart!
  clearCart: Cart!
}
```

Tất cả query/mutation của cart đều yêu cầu đăng nhập.

## Data model

### Cart

- `id`
- `userId`
- `items`
- `currency`
- `totals`
- `updatedAt`

### CartItem

- `id`
- `productId`
- `quantity`
- `unitPrice`
- `titleSnapshot`
- `imageSnapshot`
- `createdAt`
- `updatedAt`

## Luồng chính

### Đọc cart

```text
User đăng nhập
  -> query cart
  -> service đọc Redis theo key cart:user:{userId}
  -> trả về cart hoặc null
```

### Add to cart

```text
User đăng nhập
  -> gọi addToCart(productId, quantity)
  -> cart-subgraph gọi product-subgraph để lấy snapshot
  -> chỉ chấp nhận product có status = APPROVED
  -> thêm vào Redis cart:user:{userId}
  -> tính lại totals
```

### Update / remove / clear

- Chỉ thao tác trên cart của `userId` hiện tại
- Không dùng `sessionId`
- Không có merge guest cart

## Tương tác với service khác

### Với `user-service`

- Dùng Bearer token
- Xác thực qua auth guard
- Actor được resolve từ access token / introspect

### Với `product-subgraph`

- Khi add item, gọi sang product-subgraph để lấy:
  - `id`
  - `name`
  - `price`
  - `currency`
  - `status`
  - `coverImage`
- Nếu product không tồn tại hoặc chưa `APPROVED` thì từ chối

## Redis model

Key:

- `cart:user:{userId}`

Value:

- JSON của toàn bộ cart

Ghi chú:

- Không còn `cart:session:{sessionId}`
- Không còn TTL riêng cho guest cart
- Giới hạn số dòng hàng vẫn dùng `CART_MAX_DISTINCT_ITEMS`

## Quyết định nghiệp vụ

Lý do bỏ guest cart:

- Đơn giản hóa nghiệp vụ cho đồ án
- Dễ đồng bộ giữa auth, cart, checkout
- Dễ trình bày hơn: muốn mua thì phải có tài khoản
- Bớt một luồng kỹ thuật phụ là merge cart

## Mở rộng tiếp theo

- Checkout từ cart sang `order-subgraph`
- Re-price tại thời điểm checkout
- Kiểm tra stock tại checkout
- Xóa item invalid nếu product bị ẩn hoặc đổi trạng thái
