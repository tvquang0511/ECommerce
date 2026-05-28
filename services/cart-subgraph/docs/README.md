# cart-subgraph plan

Mục tiêu: cart-subgraph là GraphQL subgraph quản lý giỏ hàng. Service này phối hợp với user-service (auth) và product-subgraph (catalog) để trả về cart items có thông tin sản phẩm thông qua Federation.

## Stack và công cụ

- Framework: NestJS
- GraphQL: @nestjs/graphql + Apollo Federation Subgraph
- Cache/Store: Redis (primary store)
- Auth: JWT verify theo user-service (RS256), optional auth cho guest
- Validation: class-validator + class-transformer
- Testing: Jest + supertest (E2E optional)
- Tooling: pnpm workspace

## Phạm vi và nguyên tắc

- GraphQL subgraph cho gateway, không expose REST.
- Database-per-service: cart đọc trong Redis (primary store).
- Idempotent cho các mutation quan trọng (add/update/remove).
- Không tính toán payment hay inventory ở đây; chỉ quản lý giỏ hàng.
- Cache không bắt buộc vì Redis đã là primary store.
- Cart lưu snapshot thông tin sản phẩm để giữ tính nhất quán khi price thay đổi.

## Đối tượng chính

- Cart
  - id (string)
  - userId (string, optional nếu anonymous)
  - sessionId (string, optional nếu anonymous)
  - items: CartItem[]
  - currency (string, default VND)
  - totals: subtotal, discount, tax, total
  - updatedAt

- CartItem
  - id (string)
  - productId (string)
  - quantity (number)
  - unitPrice (number, snapshot từ product subgraph)
  - titleSnapshot (string, snapshot)
  - imageSnapshot (string | null)
  - createdAt, updatedAt

## Schema GraphQL (đề xuất chi tiết)

Loại dữ liệu:

```
scalar DateTime

type Money {
  amount: Float!
  currency: String!
}

type CartTotals {
  subtotal: Money!
  discount: Money!
  tax: Money!
  total: Money!
}

type CartItem {
  id: ID!
  productId: ID!
  quantity: Int!
  unitPrice: Money!
  titleSnapshot: String!
  imageSnapshot: String
  createdAt: DateTime!
  updatedAt: DateTime!

  # Federation reference to Product
  product: Product!
}

type Cart {
  id: ID!
  userId: ID
  sessionId: String
  items: [CartItem!]!
  totals: CartTotals!
  currency: String!
  updatedAt: DateTime!
}

input AddToCartInput {
  productId: ID!
  quantity: Int!
  sessionId: String
}

input UpdateCartItemInput {
  itemId: ID
  productId: ID
  quantity: Int!
  sessionId: String
}

input RemoveCartItemInput {
  itemId: ID
  productId: ID
  sessionId: String
}

input MergeCartInput {
  fromSessionId: String!
}

type Query {
  cart(sessionId: String): Cart
}

type Mutation {
  addToCart(input: AddToCartInput!): Cart!
  updateCartItem(input: UpdateCartItemInput!): Cart!
  removeCartItem(input: RemoveCartItemInput!): Cart!
  clearCart(sessionId: String): Cart!
  mergeCart(input: MergeCartInput!): Cart!
}
```

Ràng buộc schema:
- `UpdateCartItemInput` và `RemoveCartItemInput` bắt buộc có `itemId` hoặc `productId`.
- `quantity` > 0, nếu quantity = 0 thì coi như remove.
- `currency` lưu theo currency của sản phẩm (phase đầu chỉ VND).

## Chức năng cần có

1) Read cart
- Query cart cho user đã đăng nhập (đọc từ userId).
- Query cart cho anonymous theo sessionId.
- Trả về cart items + product reference (Federation).

2) Add to cart
- Add item theo productId + quantity.
- Nếu item đã có thì tăng số lượng.
- Validate quantity > 0.
- Lấy thông tin sản phẩm từ product-subgraph (id, name, price, currency, coverImage) để snapshot.

3) Update cart item
- Update quantity của item.
- Nếu quantity = 0 thì remove item.
- Recalculate totals.

4) Remove cart item
- Remove 1 item theo itemId hoặc productId.

5) Clear cart
- Xóa toàn bộ items.

6) Merge cart
- Khi user login, merge cart anonymous (sessionId) vào cart userId.
- Chính sách merge: cộng số lượng, giữ item có updatedAt mới nhất.

7) Totals
- Tính totals từ items snapshot.
- Chưa áp dụng coupon/promotion ở phase đầu.

## Tương tác với user-service

- Auth: sử dụng Authorization Bearer token từ user-service.
- Token claims tối thiểu: sub (userId), roles.
- Optional auth: cho phép guest cart theo sessionId.
- Guard: verify JWT; nếu không có token thì vẫn cho đọc/ghi cart guest.
- SessionId guest được tạo bên frontend, truyền vào cart query/mutation.

## Tương tác với product-subgraph

- Khi add/update item, gọi product-subgraph (internal) để lấy price + name + status.
- Chỉ cho phép add sản phẩm status = APPROVED.
- Khi query cart, trả về field product as Federation reference:
  - { __typename: "Product", id: productId }
- Không gọi product-subgraph trên read path (để nhanh); rely vào gateway resolve.

## Federation design

- CartItem.product: Product! là tham chiếu đến product-subgraph.
- Cart subgraph không sở hữu dữ liệu Product.
- Thực thể Product trong product-subgraph nên expose @key(fields: "id").
- Cart subgraph trả về reference object:
  - { __typename: "Product", id: productId }
- Gateway soạn schema và giải quyết các trường Product bằng cách ủy quyền cho product-subgraph.

Gợi ý federation cho Product (product-subgraph):

```
type Product @key(fields: "id") {
  id: ID!
  name: String!
  price: Float!
  currency: String!
  status: ProductStatusEnum!
  coverImage: ProductImage
}
```

## Data model trong Redis

Keys:
- cart:user:{userId}
- cart:session:{sessionId}

Value (JSON):
- { id, userId?, sessionId?, items[], currency, totals, updatedAt }

TTL:
- user cart: không TTL (hoặc TTL dài)
- guest cart: TTL 7-30 ngày

Cách sử dụng lệnh Redis:
- GET/SET JSON (stringify)
- EX ttl cho guest
- DEL khi clear cart

## Use cases chi tiết

1) Guest thêm sản phẩm vào cart
- Client gửi addToCart kèm sessionId
- Service load cart: cart:session:{sessionId}
- Xác nhận sản phẩm qua product-subgraph
- Thêm item, tính lại totals, lưu

2) User đăng nhập, merge cart
- Client gọi mergeCart(fromSessionId)
- Service load cart session + cart user
- Gộp items, xóa cart session

3) User cập nhật số lượng
- updateCartItem quantity
- Nếu quantity = 0 -> xóa
- Lưu + tính toán lại tổng

4) Đọc cart
- cart(sessionId?)
- Nếu có token: đọc user cart
- Nếu không có token: đọc session cart

5) Thêm item khi sản phẩm bị ARCHIVED/REJECTED
- Service từ chối (BadRequest)
- Không ghi cart

## Infrastructure cần có

- Redis (primary store)
- graphql-gateway (compose federation)
- product-subgraph (catalog)
- user-service (auth + JWT)

Ports gợi ý:
- cart-subgraph: 4003
- product-subgraph: 4002
- user-service: 4001
- gateway: 4000

## Kế hoạch triển khai (chi tiết)

Phase 1 (Khung sơ lược, 1-2 ngày)
- Tạo NestJS module cho cart
- Redis adapter + service
- Query cart + addToCart + cập nhật/xóa
- Xác thực DTO

Phase 2 (Federation, 1 ngày)
- Tham chiếu CartItem.product
- Thêm kiểm tra trạng thái sản phẩm qua product-subgraph
- Kiểm tra soạn gateway

Phase 3 (Auth + Gộp, 1-2 ngày)
- Guard auth tùy chọn
- Gộp cart khi đăng nhập
- Chiến lược TTL cho guest

Phase 4 (Tổng + Snapshot, 1 ngày)
- Tính totals từ snapshot
- Lưu snapshot name/price/image

Phase 5 (Quan sát + tests, 1-2 ngày)
- Unit tests cho service
- E2E tests (Redis memory hoặc thùng chứa test)
- Logging + requestId

## Tiêu chí hoàn thành

- Thêm/cập nhật/xóa hoạt động cho user và guest.
- Cart query giải quyết các trường Product qua gateway.
- Gộp cart không mất dữ liệu.
- Tests vượt qua.
