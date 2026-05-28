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

Ghi chú triển khai hiện tại (đã code trong cart-subgraph):
- Key thực tế dùng prefix `cart:` để tránh va chạm:
  - `cart:user:{userId}`
  - `cart:session:{sessionId}`
- Giá trị lưu dạng JSON (string) của toàn bộ cart.
- Guest cart được set TTL theo kiểu “sliding TTL” (mỗi lần ghi sẽ set lại TTL).
- Giới hạn số item (distinct) mặc định là 99 (có thể cấu hình bằng env).

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

---

# Báo cáo: Redis làm primary store cho Cart

## 1) Redis là store (không chỉ là cache)

Nếu cart dùng Redis làm nơi lưu trữ chính (primary store) thì đúng là **ưu tiên tốc độ** và **không cần thêm một lớp cache riêng** cho cart.

Lý do:
- Cart là dữ liệu “hot”, đọc/ghi thường xuyên; Redis cho latency rất thấp.
- Dữ liệu cart thường có vòng đời ngắn/trung bình (đặc biệt guest cart), phù hợp TTL.
- Nếu Redis đã là store thì “cache của cart” gần như trùng vai trò, dễ tạo double-invalidation.

Điều vẫn có thể cache (tùy phase):
- Snapshot product khi add (để giảm gọi product-subgraph) đã được “cache hoá” ngay trong cart item.
- Nếu sau này add nhiều nguồn pricing (promotion/flash sale), có thể cache pricing lookup theo productId trong 30-120s, nhưng đây là cache cho **pricing**, không phải cache cho **cart**.

## 2) Chiến thuật key/value và cấu trúc dữ liệu

### 2.1 Key schema

- User cart: `cart:user:{userId}`
- Guest cart: `cart:session:{sessionId}`

Ưu điểm: truy cập O(1) theo userId/sessionId; dễ quan sát và backup/flush theo prefix.

### 2.2 Value schema

Hiện tại lưu **toàn bộ cart** thành 1 JSON string:
- `CartEntity` gồm `items[]`, `totals`, `updatedAt`, snapshot name/price/image.

Trade-off:
- (+) Đơn giản, dễ debug, phù hợp limit 99 items.
- (-) Mỗi mutation phải GET + SET lại toàn bộ cart (write amplification).

Khi nào cần tối ưu hơn (tương lai):
- Dùng Redis Hash: `HSET cart:user:{id} meta ...` và `HSET cart:user:{id}:items {productId} {...}`.
- Dùng Sorted Set theo `updatedAt` để giới hạn và paging.
- Dùng Lua script để atomic update.

## 3) TTL cart và chính sách “sống còn” dữ liệu

### 3.1 TTL cho guest cart

Mục tiêu: không để guest cart tăng vô hạn (memory leak dữ liệu).

Khuyến nghị:
- Guest TTL: **7–30 ngày** (mặc định 30 ngày).
- Kiểu TTL: **sliding TTL theo write** (mỗi lần add/update/remove/clear sẽ reset TTL).

Triển khai hiện tại:
- Env: `CART_GUEST_TTL_SECONDS` (default `2592000` = 30 ngày)
- Mỗi lần ghi vào `cart:session:{sessionId}` sẽ `SET ... EX CART_GUEST_TTL_SECONDS`.

### 3.2 TTL cho user cart

Đa số hệ thống:
- Không TTL (giữ lâu), hoặc TTL dài (90–180 ngày) để làm sạch “user bỏ giỏ”.

Triển khai hiện tại:
- User cart **không đặt TTL** (đơn giản, tránh mất dữ liệu bất ngờ).

Khuyến nghị vận hành:
- Nếu Redis chỉ dành cho cart: cân nhắc TTL dài cho user cart để tránh phình bộ nhớ.
- Nếu cần giữ “lịch sử giỏ” lâu: cart nên được snapshot sang DB bền (Postgres/Mongo) theo lịch.

## 4) Giới hạn số lượng sản phẩm trong cart (ví dụ 99)

Trong thực tế có 2 cách hiểu “tổng số lượng”:
- **Số dòng hàng (distinct items)**: số phần tử trong `items[]`.
- **Tổng quantity**: tổng `sum(item.quantity)`.

Shopee/TikTokShop thường limit theo **distinct items** để:
- UX gọn, tránh abuse (spam thêm hàng loạt SKU), tránh payload/cart quá lớn.
- Giảm write amplification (JSON cart lớn).

Triển khai hiện tại:
- Limit distinct items mặc định **99**.
- Env: `CART_MAX_DISTINCT_ITEMS`.
- Hành vi:
  - Nếu add product mới mà cart đã đủ 99 items -> trả `400 BadRequest`.
  - Nếu add vào product đã tồn tại -> vẫn cho tăng quantity.
  - Khi merge session cart -> ưu tiên giữ user cart, bỏ qua session item nếu vượt limit.

Khuyến nghị thêm (tùy sản phẩm):
- Limit quantity per item (ví dụ 99 hoặc 999) để chặn nhập sai.
- Limit tổng quantity toàn cart (ví dụ 999) để tránh spam.

## 5) Độ đúng (consistency) và atomicity khi update cart

Mẫu GET + mutate + SET (như hiện tại) có thể gặp race condition khi user bấm nhanh hoặc multi-tab.

Chiến thuật nâng cấp (khi cần):
- **WATCH/MULTI/EXEC** trên key cart để optimistic locking.
- Hoặc **Lua script** để atomic read-modify-write.
- Hoặc khóa ngắn (distributed lock) `cart:lock:{key}` với TTL vài trăm ms.

Ở phase đầu, nếu hệ thống chưa có traffic lớn, cách hiện tại thường chấp nhận được, nhưng nên theo dõi:
- % mutation lost update
- latency do Redis
- payload size cart

## 6) Snapshot giá (unitPriceSnapshot) có “ổn” không?

### 6.1 Snapshot trong cart để làm gì?

Ưu điểm:
- UX: user thấy “giá tạm tính” ổn định khi họ thêm vào giỏ.
- Performance: read cart không cần gọi product-subgraph (gateway tự resolve product field khi cần).
- Debug: biết user đã thêm vào giỏ tại thời điểm nào với giá nào.

Nhược điểm:
- Nếu giá thay đổi sau khi add (tăng/giảm), cart vẫn hiển thị giá cũ -> có thể gây hiểu nhầm.

### 6.2 Nên chốt giá lúc nào?

Thông lệ tốt nhất:
- **Cart**: hiển thị snapshot như “estimated price” (giá tạm tính lúc thêm vào giỏ).
- **Checkout / Order creation**: luôn **re-price** theo giá hiện tại và rules hiện tại (khuyến mãi, tồn kho, seller status…), rồi yêu cầu user confirm nếu có thay đổi.

Kết luận nghiệp vụ:
- Snapshot trong cart **nên có** (để UX tốt và giảm phụ thuộc realtime).
- Nhưng **giá cuối cùng phải lấy mới ở bước checkout**.

Khuyến nghị về cách diễn đạt UI/API:
- Ghi rõ “Giá tạm tính” hoặc “Giá tại thời điểm thêm vào giỏ”.
- Ở checkout, nếu giá thay đổi: trả về danh sách item có chênh lệch để frontend hiển thị “Giá đã thay đổi, vui lòng xác nhận”.

### 6.3 Nếu muốn “price lock” (giữ giá) thì sao?

Chỉ nên làm nếu có yêu cầu sản phẩm rõ ràng, vì sẽ phức tạp:
- Cần TTL lock ngắn (5–15 phút) và chính sách khi hết hạn.
- Cần chống abuse (người dùng lock giá rẻ quá lâu).
- Cần tích hợp promotion engine.

Trong phase đầu, snapshot + re-price ở checkout là cân bằng tốt nhất.
