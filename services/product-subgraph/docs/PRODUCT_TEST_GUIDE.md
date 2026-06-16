# Product Test Guide

Tài liệu này giúp bạn test nhanh `product-subgraph` sau khi đã seed `user-service` và `product-subgraph`.

## 1. Dữ liệu demo đang dùng

### User ở `user-service`

- `seller@demo.local` / `DevPassword123!`
- `admin@demo.local` / `DevPassword123!`
- `moderator@demo.local` / `DevPassword123!`
- `buyer@demo.local` / `DevPassword123!`
- `seller-pending@demo.local` / `DevPassword123!`

### Product ở `product-subgraph`

- `p1001` -> `DRAFT`
- `p1002` -> `PENDING_REVIEW`
- `p1003` -> `APPROVED`
- `p1004` -> `REJECTED`
- `p1005` -> `ARCHIVED`
- `p1006` -> `APPROVED`

## 2. Seed dữ liệu

```bash
pnpm --filter product-subgraph seed:products
```

## 3. Chạy service

```bash
pnpm --filter user-service dev
pnpm --filter product-subgraph dev
```

## 4. Lấy token

Đăng nhập seller:

```http
POST http://localhost:4001/api/users/auth/login
Content-Type: application/json

{
  "email": "seller@demo.local",
  "password": "DevPassword123!"
}
```

Đăng nhập admin:

```http
POST http://localhost:4001/api/users/auth/login
Content-Type: application/json

{
  "email": "admin@demo.local",
  "password": "DevPassword123!"
}
```

Lấy `accessToken` từ response rồi gắn vào header:

```http
Authorization: Bearer <accessToken>
```

## 5. Query cơ bản

Guest hoặc buyer xem danh sách công khai:

```graphql
query PublicProducts {
  products {
    id
    name
    status
    sellerId
  }
}
```

Expected:

- Nhìn thấy `p1003`, `p1006`
- Không nhìn thấy `p1001`, `p1002`, `p1004`, `p1005`

Seller xem danh sách:

```graphql
query SellerProducts {
  products {
    id
    name
    status
  }
}
```

Expected khi dùng token `seller@demo.local`:

- Thấy `p1001`, `p1002`, `p1003`, `p1004`, `p1005`
- Có thể thấy thêm `p1006` vì nó là `APPROVED`

## 6. Mutation seller

Tạo product:

```graphql
mutation CreateProduct {
  createProduct(
    input: {
      name: "Loa bookshelf demo"
      price: 2390000
      sku: "BOOKSHELF-NEW-001"
      brand: "Edifier"
      categoryId: "audio"
      tags: ["speaker", "desk-setup"]
      shortDescription: "Loa demo để test createProduct"
    }
  ) {
    id
    name
    status
    sellerId
  }
}
```

Expected:

- Status mới là `DRAFT`
- `sellerId` là user seller hiện tại

Submit review:

```graphql
mutation SubmitReview {
  submitProductForReview(id: "p1001") {
    id
    status
  }
}
```

Expected:

- `p1001` chuyển từ `DRAFT` sang `PENDING_REVIEW`

Archive product:

```graphql
mutation ArchiveProduct {
  archiveProduct(id: "p1003") {
    id
    status
    archivedAt
  }
}
```

Expected:

- `p1003` chuyển sang `ARCHIVED`

## 7. Mutation admin

Approve product:

```graphql
mutation ApproveProduct {
  approveProduct(id: "p1002") {
    id
    status
    publishedAt
  }
}
```

Reject product:

```graphql
mutation RejectProduct {
  rejectProduct(id: "p1002") {
    id
    status
  }
}
```

Expected:

- Chỉ token admin mới chạy được
- Seller thường sẽ bị `403`

## 8. Negative cases nên test

- `buyer@demo.local` gọi `createProduct` -> phải bị từ chối
- `seller-pending@demo.local` gọi `createProduct` -> phải bị từ chối
- Seller update `p1005` đã `ARCHIVED` -> phải bị `400`
- Seller A sửa product của seller B -> phải bị `403`
- Guest gọi mutation bất kỳ -> phải bị `401` hoặc `403` tùy guard chain
