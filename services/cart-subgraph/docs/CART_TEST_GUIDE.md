# Cart Test Guide

Tài liệu này giúp bạn test nhanh `cart-subgraph` với token thật từ `user-service` và product thật từ `product-subgraph`.

## Điều kiện trước khi test

- `user-service` đang chạy ở `http://localhost:4001`
- `product-subgraph` đang chạy ở `http://localhost:4002/graphql`
- `cart-subgraph` đang chạy ở `http://localhost:4003/graphql`
- `user-service` đã seed demo users
- `product-subgraph` đã seed product demo

## Tài khoản nên dùng

- `buyer@demo.local` / `DevPassword123!`

Buyer là account phù hợp nhất để test cart, vì rule hiện tại cấm guest thêm vào cart.

## Luồng buyer end-to-end

### Bước 1. Login ở user-service

```http
POST http://localhost:4001/api/users/auth/login
Content-Type: application/json

{
  "email": "buyer@demo.local",
  "password": "DevPassword123!"
}
```

Lấy `accessToken` từ response.

### Bước 2. Query product công khai

```graphql
query PublicProducts {
  products {
    id
    name
    status
    price
  }
}
```

Kỳ vọng:

- thấy `p1003`
- thấy `p1006`
- không thấy `DRAFT`, `PENDING_REVIEW`, `REJECTED`, `ARCHIVED`

### Bước 3. Add product approved vào cart

Headers:

```json
{
  "Authorization": "Bearer <accessToken>"
}
```

Mutation:

```graphql
mutation AddToCart($input: AddToCartInput!) {
  addToCart(input: $input) {
    id
    userId
    currency
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
    totals {
      subtotal {
        amount
        currency
      }
      total {
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
    "quantity": 1
  }
}
```

### Bước 4. Query lại cart

```graphql
query MyCart {
  cart {
    id
    userId
    currency
    items {
      id
      productId
      quantity
      titleSnapshot
      unitPrice {
        amount
        currency
      }
      product {
        id
      }
    }
    totals {
      subtotal {
        amount
        currency
      }
      total {
        amount
        currency
      }
    }
  }
}
```

### Bước 5. Update quantity

```graphql
mutation UpdateCartItem($input: UpdateCartItemInput!) {
  updateCartItem(input: $input) {
    items {
      id
      productId
      quantity
    }
    totals {
      subtotal {
        amount
      }
      total {
        amount
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
    "quantity": 3
  }
}
```

### Bước 6. Remove item hoặc clear cart

Remove theo `productId`:

```graphql
mutation RemoveCartItem($input: RemoveCartItemInput!) {
  removeCartItem(input: $input) {
    items {
      id
      productId
      quantity
    }
  }
}
```

Variables:

```json
{
  "input": {
    "productId": "p1003"
  }
}
```

Clear cart:

```graphql
mutation ClearCart {
  clearCart {
    id
    items {
      id
    }
  }
}
```

## Negative cases nên test

- không gửi token -> phải bị chặn
- add `p1001` (`DRAFT`) -> phải fail
- add `p1002` (`PENDING_REVIEW`) -> phải fail
- add cùng `p1003` hai lần -> quantity cộng dồn
- update cart bằng `productId` không có trong cart -> phải fail

## Ghi nhớ logic quan trọng

- cart lấy `userId` từ `accessToken`
- cart không tin client gửi `userId`
- cart chỉ add product đang `APPROVED`
- cart lưu snapshot tên và giá tại thời điểm add
