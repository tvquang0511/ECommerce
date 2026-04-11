# Product Service — Plan + Functional & Data Design (NestJS + MongoDB + MinIO + Redis)

Mục tiêu: xây `product-service` dạng **GraphQL Federation Subgraph** (NestJS) cho catalog. Tối ưu cho use-case có **rất nhiều ảnh/video**.

---

## 1) Scope chức năng (Milestone-based)

### Milestone A — Skeleton chạy được
- Healthcheck
- GraphQL endpoint (Federation v2)
- Config/env + logging
- MongoDB connection + seed sample products

### Milestone B — Catalog core (read path)
- Queries:
  - `ping: String!`
  - `product(id: ID!): Product`
  - `products(cursor, limit, filter, sort): ProductConnection!`
- Filter/sort tối thiểu:
  - `categoryId`
  - price range
  - text search đơn giản (phase sau nâng cấp to Atlas Search/Meilisearch)

### Milestone C — Admin CRUD (write path)
- Mutations:
  - `createProduct(input)`
  - `updateProduct(id, input)`
  - `setProductPrice(id, price)`
- Basic validation + RBAC (ADMIN)

### Milestone D — Media (MinIO) cho ảnh trước, video sau
- Ảnh:
  - Xin presigned PUT (client upload trực tiếp MinIO)
  - Confirm upload
  - Generate thumbnails/resized (worker)
- Video:
  - Multipart upload + confirm
  - (Option) transcode/background processing (HLS/MP4)

### Milestone E — Cache (Redis)
- Cache product detail + listing
- TTL + cache key conventions
- Invalidation theo write path / events

---

## 2) Nguyên tắc kiến trúc (quan trọng khi media nhiều)

- **App server không proxy bytes**: product-service chỉ tạo presigned URLs + validate/confirm metadata.
- **MinIO private bucket**: truy cập bằng presigned GET/PUT; sau này có thể thêm CDN.
- **Idempotency** cho write operations quan trọng (create/update media confirm).
- **Background processing**: thumbnail/resized/transcode chạy worker (không block request).

---

## 3) GraphQL API sketch (Federation-ready)

### Product entity
- `Product @key(fields: "id")`
- Fields tối thiểu:
  - `id`, `name`, `slug`, `description`, `status`
  - `price`, `currency`
  - `categoryId`
  - `media: [ProductMedia!]!`
  - timestamps

### Media types
- `ProductMedia`:
  - `id`
  - `type: IMAGE | VIDEO`
  - `status: PENDING_UPLOAD | UPLOADED | PROCESSING | READY | FAILED`
  - `original: MediaObject!`
  - `variants: [MediaVariant!]!` (thumbnail/resized/transcoded)
  - `isPrimary: Boolean!`

### Upload flow
- `requestProductMediaUpload(productId, files[]): UploadPlan!`
  - trả `assetId`, `objectKey`, `presignedPutUrl`, headers required, expiresAt
- `confirmProductMediaUpload(productId, assetId, etag?, checksum?, sizeBytes, contentType)`
  - đánh dấu `UPLOADED`, enqueue job processing

---

## 4) MongoDB data model (đủ cho chức năng + mở rộng)

> Gợi ý: media nhiều thì nên tách collection `product_media` để tránh document `products` phình to.

### Collection: `products`
- `_id` (ObjectId)
- `name`, `slug` (unique)
- `description`
- `status` (ACTIVE/DRAFT/ARCHIVED)
- `categoryId`
- `price` (number) + `currency`
- `primaryMediaId` (optional)
- `createdAt`, `updatedAt`

Indexes:
- `{ slug: 1 } unique`
- `{ categoryId: 1, createdAt: -1 }`
- `{ price: 1 }` (nếu filter theo price)

### Collection: `product_media`
- `_id`
- `productId` (ref)
- `type` (IMAGE/VIDEO)
- `status`
- `objectKey` (original)
- `bucket` (original)
- `contentType`, `sizeBytes`
- `checksum` (optional)
- `width`, `height`, `durationMs` (optional)
- `variants[]` (objectKey + meta)
- `createdAt`, `updatedAt`

Indexes:
- `{ productId: 1, createdAt: -1 }`
- `{ objectKey: 1 } unique` (optional, tuỳ naming)

---

## 5) MinIO conventions (rất quan trọng để quản lý)

### Buckets
- `product-media` (original)
- `product-derivatives` (thumb/resized/transcode)

### Object key convention
- `products/{productId}/{assetId}/original/{filename}`
- `products/{productId}/{assetId}/thumb/{filename}`
- `products/{productId}/{assetId}/resized/{w}x{h}/{filename}`
- `products/{productId}/{assetId}/hls/{...}` (video)

### Cleanup policy
- Orphan uploads: nếu `PENDING_UPLOAD` quá TTL mà không confirm → xoá object.

---

## 6) Redis cache

Keys:
- `cache:product:detail:{id}`
- `cache:product:list:{hash}`

Invalidation:
- simplest: TTL
- better: on write (update product/media) delete related keys

---

## 7) Tooling / libs cần có

- NestJS + GraphQL (Federation): `@nestjs/graphql`, Apollo Subgraph
- MongoDB: Mongoose hoặc Prisma Mongo (tuỳ bạn)
- MinIO: SDK S3-compatible (`minio` client hoặc AWS S3 SDK)
- Redis: `ioredis`
- Background jobs: BullMQ (Redis) hoặc RabbitMQ worker
- Validation: Zod/class-validator
- Observability: requestId, structured logs

---

## 8) Checklist bắt đầu build (đề xuất)

1) Tạo service `product-service` (NestJS) + GraphQL Federation
2) Kết nối Mongo + seed
3) Implement read queries
4) Implement admin CRUD
5) MinIO upload plan/confirm cho ảnh
6) Worker generate thumbnails
7) Redis cache list/detail
8) Video multipart + processing pipeline (phase sau)
