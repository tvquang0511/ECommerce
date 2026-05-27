# cart-subgraph plan

Muc tieu: cart-subgraph la GraphQL subgraph quan ly gio hang. Service nay phoi hop voi user-service (auth) va product-subgraph (catalog) de tra ve cart items co thong tin product thong qua Federation.

## Stack va cong cu

- Framework: NestJS
- GraphQL: @nestjs/graphql + Apollo Federation Subgraph
- Cache/Store: Redis (primary store)
- Auth: JWT verify theo user-service (RS256), optional auth cho guest
- Validation: class-validator + class-transformer
- Testing: Jest + supertest (E2E optional)
- Tooling: pnpm workspace

## Pham vi va nguyen tac

- GraphQL subgraph cho gateway, khong expose REST.
- Database-per-service: cart doc trong Redis (primary store).
- Idempotent cho cac mutation quan trong (add/update/remove).
- Khong tinh toan payment hay inventory o day; chi quan ly gio hang.
- Cache khong bat buoc vi Redis da la primary store.
- Cart luu snapshot thong tin product de giu tinh nhat quan khi price thay doi.

## Doi tuong chinh

- Cart
  - id (string)
  - userId (string, optional neu anonymous)
  - sessionId (string, optional neu anonymous)
  - items: CartItem[]
  - currency (string, default VND)
  - totals: subtotal, discount, tax, total
  - updatedAt

- CartItem
  - id (string)
  - productId (string)
  - quantity (number)
  - unitPrice (number, snapshot tu product subgraph)
  - titleSnapshot (string, snapshot)
  - imageSnapshot (string | null)
  - createdAt, updatedAt

## Schema GraphQL (de xuat chi tiet)

Loai du lieu:

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

Rang buoc schema:
- `UpdateCartItemInput` va `RemoveCartItemInput` bat buoc co `itemId` hoac `productId`.
- `quantity` > 0, neu quantity = 0 thi coi nhu remove.
- `currency` luu theo currency cua product (phase dau chi VND).

## Chuc nang can co

1) Read cart
- Query cart cho user da dang nhap (doc tu userId).
- Query cart cho anonymous theo sessionId.
- Tra ve cart items + product reference (Federation).

2) Add to cart
- Add item theo productId + quantity.
- Neu item da co thi tang so luong.
- Validate quantity > 0.
- Lay thong tin product tu product-subgraph (id, name, price, currency, coverImage) de snapshot.

3) Update cart item
- Update quantity cua item.
- Neu quantity = 0 thi remove item.
- Recalculate totals.

4) Remove cart item
- Remove 1 item theo itemId hoac productId.

5) Clear cart
- Xoa toan bo items.

6) Merge cart
- Khi user login, merge cart anonymous (sessionId) vao cart userId.
- Chinh sach merge: cong so luong, giu item co updatedAt moi nhat.

7) Totals
- Tinh totals tu items snapshot.
- Chua ap dung coupon/promotion o phase dau.

## Tuong tac voi user-service

- Auth: su dung Authorization Bearer token tu user-service.
- Token claims toi thieu: sub (userId), roles.
- Optional auth: cho phep guest cart theo sessionId.
- Guard: verify JWT; neu khong co token thi van cho doc/ghi cart guest.
- SessionId guest duoc tao ben frontend, truyen vao cart query/mutation.

## Tuong tac voi product-subgraph

- Khi add/update item, call product-subgraph (internal) de lay price + name + status.
- Chi cho phep add san pham status = APPROVED.
- Khi query cart, tra ve field product as Federation reference:
  - { __typename: "Product", id: productId }
- Khong goi product-subgraph tren read path (de nhanh); rely vao gateway resolve.

## Federation design

- CartItem.product: Product! is a reference to product-subgraph.
- Cart subgraph does not own Product data.
- Product entity in product-subgraph should expose @key(fields: "id").
- Cart subgraph returns reference object:
  - { __typename: "Product", id: productId }
- Gateway composes schema and resolves Product fields by delegating to product-subgraph.

Goi y federation cho Product (product-subgraph):

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

## Data model in Redis

Keys:
- cart:user:{userId}
- cart:session:{sessionId}

Value (JSON):
- { id, userId?, sessionId?, items[], currency, totals, updatedAt }

TTL:
- user cart: no TTL (or long TTL)
- guest cart: TTL 7-30 days

Redis command usage:
- GET/SET JSON (stringify)
- EX ttl cho guest
- DEL khi clear cart

## Use cases chi tiet

1) Guest them san pham vao cart
- Client gui addToCart kem sessionId
- Service load cart: cart:session:{sessionId}
- Validate product via product-subgraph
- Add item, recalc totals, save

2) User dang nhap, merge cart
- Client goi mergeCart(fromSessionId)
- Service load cart session + cart user
- Merge items, delete cart session

3) User cap nhat so luong
- updateCartItem quantity
- Neu quantity = 0 -> remove
- Save + totals

4) Read cart
- cart(sessionId?)
- Neu co token: doc user cart
- Neu khong co token: doc session cart

5) Add item khi product bi ARCHIVED/REJECTED
- Service reject (BadRequest)
- Khong ghi cart

## Infrastructure can co

- Redis (primary store)
- graphql-gateway (compose federation)
- product-subgraph (catalog)
- user-service (auth + JWT)

Ports goi y:
- cart-subgraph: 4003
- product-subgraph: 4002
- user-service: 4001
- gateway: 4000

## Ke hoach trien khai (chi tiet)

Phase 1 (Skeleton, 1-2 ngay)
- Tao NestJS module cho cart
- Redis adapter + service
- Query cart + addToCart + update/remove
- DTO validation

Phase 2 (Federation, 1 ngay)
- CartItem.product reference
- Add product status check via product-subgraph
- Gateway compose check

Phase 3 (Auth + Merge, 1-2 ngay)
- Optional auth guard
- Merge cart on login
- Guest TTL strategy

Phase 4 (Totals + Snapshot, 1 ngay)
- Tinh totals tu snapshot
- Luu snapshot name/price/image

Phase 5 (Observability + tests, 1-2 ngay)
- Unit tests cho service
- E2E tests (Redis memory or test container)
- Logging + requestId

## Done criteria

- Add/update/remove works for user and guest.
- Cart query resolves Product fields via gateway.
- Merge cart khong mat data.
- Tests passing.
