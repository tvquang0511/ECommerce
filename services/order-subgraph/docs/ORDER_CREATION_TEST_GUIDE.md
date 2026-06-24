# Order Creation Test Guide

Tai lieu nay huong dan test tay 2 luong tao order hien tai:

- `createOrderDirect`
- `createOrderFromCart`

Muc tieu:

- xac nhan order creation da dung gia live tu `product-subgraph`
- xac nhan `order_events`, `orders_read`, `order_items_read` da duoc cap nhat
- xac nhan read model tra ve snapshot thuc su cua order
- xac nhan `createOrderFromCart` chi tao draft tu cac cart item duoc chon
- xac nhan cart chi bi xoa cac item da chon sau `submitOrder` thanh cong

---

## 1. Chuan bi

Tu root repo:

```powershell
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

Chay cac service can thiet:

```powershell
pnpm.cmd --filter user-service start:dev
pnpm.cmd --filter product-subgraph start:dev
pnpm.cmd --filter cart-subgraph start:dev
pnpm.cmd --filter order-subgraph start:dev
```

Gateway neu ban muon test qua gateway:

```powershell
pnpm.cmd --filter gateway start:dev
```

Ap dung migration order:

```powershell
pnpm.cmd --filter order-subgraph prisma:generate
pnpm.cmd --filter order-subgraph prisma:migrate:deploy
```

Order subgraph:

```text
http://localhost:4004/graphql
```

---

## 2. Lay access token cua buyer

Dang nhap qua `user-service` de lay access token buyer.

Ban co the dung Postman hoac Apollo/HTTP client gui den `user-service`.

Sau khi co token, dung header:

```json
{
  "Authorization": "Bearer <BUYER_ACCESS_TOKEN>"
}
```

Token nay rat quan trong voi `createOrderFromCart`, vi `order-subgraph` se dung lai token cua buyer de goi sang `cart-subgraph`.

---

## 3. Test `createOrderDirect`

Mutation:

```graphql
mutation CreateOrderDirect($input: CreateOrderDirectInput!) {
  createOrderDirect(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "productId": "p1003",
    "quantity": 1,
    "idempotencyKey": "order-direct-001"
  }
}
```

Ky vong:

- `status = DRAFT`
- `version = 0`
- `message` thong bao tao draft thanh cong

Kiem tra event store:

```sql
SELECT aggregate_id, sequence, event_type
FROM order_events
ORDER BY occurred_at DESC;
```

Ban nen thay:

- mot event `OrderCreatedDirect`

Kiem tra read model:

```sql
SELECT order_id, buyer_id, seller_ids, status, total_amount, currency, version
FROM orders_read
ORDER BY created_at DESC;
```

Va:

```sql
SELECT order_id, line_id, product_id, seller_id, title_snapshot, quantity, unit_price_amount, currency
FROM order_items_read
ORDER BY order_id DESC;
```

Ky vong:

- order moi co `seller_ids`
- `total_amount` dung voi gia live hien tai cua product
- `order_items_read` co it nhat 1 item

Query lai order:

```graphql
query Order($id: ID!) {
  order(id: $id) {
    id
    buyerId
    sellerIds
    status
    total {
      amount
      currency
    }
    items {
      lineId
      productId
      sellerId
      titleSnapshot
      quantity
      unitPrice {
        amount
        currency
      }
    }
  }
}
```

Ky vong:

- `items` khong rong
- `titleSnapshot`, `sellerId`, `unitPrice` da duoc snapshot

---

## 4. Test `createOrderFromCart`

### 4.1 Tao du lieu cart truoc

Them san pham vao cart bang `cart-subgraph` hoac gateway, cung dung token buyer.

Mutation:

```graphql
mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    id
    items {
      id
      productId
      quantity
      titleSnapshot
      unitPrice {
        amount
        currency
      }
    }
  }
}
```

Variables:

```json
{
  "input": {
    "productId": "p1003",
    "quantity": 2
  }
}
```

Neu muon test re-price that su:

1. them vao cart khi gia san pham dang la A
2. doi gia san pham ben `product-subgraph`
3. goi `createOrderFromCart`
4. kiem tra order lay gia moi B, khong lay gia cu trong cart

### 4.2 Tao order tu cart

Mutation:

```graphql
mutation CreateOrderFromCart($input: CreateOrderFromCartInput!) {
  createOrderFromCart(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "selectedItemIds": ["<CART_ITEM_ID_1>"],
    "idempotencyKey": "order-cart-001"
  }
}
```

`selectedItemIds` la danh sach item ma buyer chon de dat hang, giong luong cua Shopee.

Neu ban muon truyen `cartId` thi co the lay tu query `cart`, nhung hien tai `order-subgraph` dang doc cart cua buyer va `cartId` chu yeu de trace.

Vi du neu cart co 3 item, buyer co the chi chon 1 hoac 2 item de tao draft order.

Cart chua bi xoa o buoc nay.

Ky vong:

- `status = DRAFT`
- `version = 0`
- `message` co noi ve repriced product snapshots

Kiem tra event store:

```sql
SELECT aggregate_id, sequence, event_type
FROM order_events
ORDER BY occurred_at DESC;
```

Ban nen thay:

- mot event `OrderCreatedFromCart`

Kiem tra read model:

```sql
SELECT order_id, buyer_id, seller_ids, status, total_amount, currency, version
FROM orders_read
ORDER BY created_at DESC;
```

Va:

```sql
SELECT order_id, line_id, product_id, seller_id, title_snapshot, quantity, unit_price_amount, currency
FROM order_items_read
ORDER BY order_id DESC;
```

Ky vong:

- `total_amount` dung theo gia live moi nhat cua product
- item read model da luu snapshot moi, khong phu thuoc vao gia cu trong cart

Query lai order vua tao:

```graphql
query Order($id: ID!) {
  order(id: $id) {
    id
    buyerId
    sellerIds
    status
    total {
      amount
      currency
    }
    items {
      productId
      sellerId
      titleSnapshot
      quantity
      unitPrice {
        amount
        currency
      }
    }
  }
}
```

---

## 5. Query `myOrders`

De xac nhan buyer thay duoc read model da duoc cap nhat:

```graphql
query MyOrders {
  myOrders {
    id
    status
    sellerIds
    total {
      amount
      currency
    }
    items {
      productId
      quantity
      titleSnapshot
      unitPrice {
        amount
        currency
      }
    }
  }
}
```

Ky vong:

- order moi tao xuat hien trong danh sach
- items tra ve day du

---

## 6. Test `submitOrder` sau khi tao tu cart

Mutation:

```graphql
mutation SubmitOrder($input: SubmitOrderInput!) {
  submitOrder(input: $input) {
    orderId
    status
    version
    correlationId
    message
  }
}
```

Variables:

```json
{
  "input": {
    "orderId": "<ORDER_ID_TAO_TU_CART>",
    "expectedVersion": 0,
    "idempotencyKey": "submit-order-cart-001"
  }
}
```

Ky vong:

- `status = SUBMITTED`
- `version = 1`
- chi sau buoc nay moi remove cac `selectedItemIds` khoi cart

Sau do query lai `cart`:

```graphql
query Cart {
  cart {
    id
    items {
      id
      productId
      quantity
      titleSnapshot
    }
  }
}
```

Ky vong:

- cac item da chon de tao order khong con trong cart
- cac item khong chon van con nguyen
- neu `submitOrder` fail thi cart giu nguyen

---

## 7. Cac truong hop ban nen thu them

- `createOrderDirect` voi product khong `APPROVED`
- `createOrderDirect` voi `quantity <= 0`
- `createOrderFromCart` khi cart rong
- `createOrderFromCart` khi khong truyen `selectedItemIds`
- `createOrderFromCart` khi `selectedItemIds` co item khong ton tai trong cart
- `createOrderFromCart` khi product trong cart bi doi gia
- `createOrderFromCart` khi mot product trong cart bi `ARCHIVED` hoac `REJECTED`
- `submitOrder` tu cart va kiem tra chi xoa selected items

---

## 8. Lenh chay test code

Chay cac test lien quan den order creation:

```powershell
pnpm.cmd --filter order-subgraph test -- checkout-pricing.service.spec.ts --runInBand
pnpm.cmd --filter order-subgraph test -- create-order-direct.handler.spec.ts --runInBand
pnpm.cmd --filter order-subgraph test -- create-order-from-cart.handler.spec.ts --runInBand
```
