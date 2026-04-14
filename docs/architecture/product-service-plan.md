# Product Service — Kế Hoạch Xây Dựng Đầy Đủ (GraphQL Federation Subgraph)

Mục tiêu: xây `product-service` (NestJS + GraphQL Federation) làm **catalog owner** cho hệ thống ecommerce, tối ưu cho khối lượng media lớn (ảnh/video), có thể mở rộng theo event-driven architecture.

---

## 1) Mục tiêu kỹ thuật

- Làm subgraph ổn định cho Apollo Federation v2, tương thích `graphql-gateway` hiện tại.
- Tách rõ read path và write path, hỗ trợ scale độc lập.
- Quản lý media bằng MinIO theo mô hình presigned URL (không proxy file qua API server).
- Có cache Redis cho truy vấn phổ biến.
- Có event outbox để publish thay đổi catalog cho các service khác.
- Có lộ trình rõ ràng theo milestone để triển khai liên tục, không đứt quãng.

---

## 2) Scope tính năng bắt buộc

### 2.1 Public catalog (read)
- Xem chi tiết sản phẩm theo `id` hoặc `slug`.
- Xem danh sách sản phẩm phân trang cursor.
- Filter: danh mục, thương hiệu, giá, trạng thái.
- Sort: mới nhất, giá tăng/giảm, độ ưu tiên.
- Search text cơ bản (phase đầu dùng regex/index text; phase sau nâng Atlas Search hoặc Meilisearch).

### 2.2 Admin catalog (write)
- CRUD sản phẩm.
- CRUD danh mục, thương hiệu, tag.
- Quản lý biến thể (size, màu, sku).
- Quản lý giá: giá gốc, giá khuyến mãi, thời điểm hiệu lực.
- Publish/unpublish/archive sản phẩm.

### 2.3 Media
- Xin presigned URL upload ảnh/video.
- Confirm upload metadata.
- Xử lý nền: generate thumbnail/resized cho ảnh, transcode video (phase sau).
- Đặt ảnh đại diện (primary media), sắp xếp gallery.
- Dọn object orphan quá hạn.

### 2.4 Federation
- `Product` là entity với `@key(fields: "id")`.
- Hỗ trợ `__resolveReference` để subgraph khác tham chiếu.

### 2.5 Reliability + observability
- Validation mạnh cho mọi input.
- Idempotency cho mutation nhạy cảm (upload confirm, create/update quan trọng).
- Structured logs + requestId/traceId.
- Metrics cơ bản: latency, error rate, cache hit rate.

---

## 3) Kiến trúc triển khai

### 3.1 Runtime components
- `product-service` (NestJS GraphQL subgraph).
- `MongoDB` (nguồn dữ liệu chính).
- `MinIO` (lưu media object).
- `Redis` (cache + optional queue state).
- `worker` riêng cho media processing (BullMQ hoặc RabbitMQ consumer).

### 3.2 Nguyên tắc bắt buộc
- API server không stream file media.
- MinIO bucket private cho upload và phục vụ qua presigned GET/PUT.
- Metadata media luôn nằm ở DB để truy vấn nhất quán.
- Tách collection media khỏi product để tránh document quá lớn.
- Không để mutation block vì xử lý ảnh/video nền.

---

## 4) Thiết kế GraphQL schema (định hướng)

### 4.1 Query
- `ping: String!`
- `product(id: ID, slug: String): Product`
- `products(input: ProductListInput!): ProductConnection!`
- `categories: [Category!]!`
- `brands: [Brand!]!`

### 4.2 Mutation
- `createProduct(input: CreateProductInput!): Product!`
- `updateProduct(id: ID!, input: UpdateProductInput!): Product!`
- `publishProduct(id: ID!): Product!`
- `archiveProduct(id: ID!): Product!`
- `setProductPrice(id: ID!, input: SetPriceInput!): ProductPrice!`
- `requestProductMediaUpload(productId: ID!, files: [UploadFileInput!]!): UploadPlan!`
- `confirmProductMediaUpload(input: ConfirmProductMediaUploadInput!): ProductMedia!`
- `setPrimaryMedia(productId: ID!, mediaId: ID!): Product!`
- `removeProductMedia(productId: ID!, mediaId: ID!): Boolean!`

### 4.3 Federation entity
- `type Product @key(fields: "id")`
- Resolver `__resolveReference(ref: { id: string })`

---

## 5) Thiết kế dữ liệu MongoDB

### 5.1 Collection `products`
Fields chính:
- `_id`
- `name`, `slug`, `description`
- `status` (`DRAFT | ACTIVE | ARCHIVED`)
- `categoryId`, `brandId`, `tags[]`
- `basePrice`, `salePrice`, `currency`
- `attributes` (key/value)
- `variants[]` (sku, attrs, priceOverride, status)
- `primaryMediaId`
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Indexes:
- `{ slug: 1 } unique`
- `{ status: 1, createdAt: -1 }`
- `{ categoryId: 1, status: 1, createdAt: -1 }`
- `{ brandId: 1, status: 1, createdAt: -1 }`
- `{ basePrice: 1 }`
- Text index cho `name`, `description`, `tags`

### 5.2 Collection `product_media`
Fields chính:
- `_id`
- `productId`
- `assetId` (public id cho upload flow)
- `type` (`IMAGE | VIDEO`)
- `status` (`PENDING_UPLOAD | UPLOADED | PROCESSING | READY | FAILED | DELETED`)
- `bucket`, `objectKey`
- `contentType`, `sizeBytes`, `etag`, `checksum`
- `width`, `height`, `durationMs`
- `variants[]` (thumb, resized, hls/mp4)
- `isPrimary`
- `createdAt`, `updatedAt`

Indexes:
- `{ productId: 1, createdAt: -1 }`
- `{ assetId: 1 } unique`
- `{ objectKey: 1 } unique`
- `{ status: 1, updatedAt: 1 }` (scan orphan/job retry)

### 5.3 Collection `outbox_events`
Fields:
- `_id`, `eventType`, `aggregateType`, `aggregateId`, `payload`, `status`, `createdAt`, `publishedAt`, `retryCount`

Indexes:
- `{ status: 1, createdAt: 1 }`

---

## 6) MinIO strategy

### 6.1 Buckets
- `product-media-original`
- `product-media-derivatives`

### 6.2 Object key convention
- `products/{productId}/{assetId}/original/{filename}`
- `products/{productId}/{assetId}/thumb/{filename}`
- `products/{productId}/{assetId}/resized/{width}x{height}/{filename}`
- `products/{productId}/{assetId}/video/{preset}/{filename}`

### 6.3 Upload flow
1. Client gọi `requestProductMediaUpload`.
2. Service tạo `assetId`, objectKey, presigned PUT URL, record trạng thái `PENDING_UPLOAD`.
3. Client upload trực tiếp MinIO.
4. Client gọi `confirmProductMediaUpload`.
5. Service verify metadata cơ bản, đổi trạng thái `UPLOADED`, enqueue xử lý nền.

### 6.4 Cleanup
- Cron job quét media `PENDING_UPLOAD` quá TTL (ví dụ 1h) để xoá object + mark failed/deleted.

---

## 7) Redis cache design

### 7.1 Key conventions
- `cache:product:detail:{productId}`
- `cache:product:slug:{slug}`
- `cache:product:list:{hashInput}`

### 7.2 TTL
- Detail: 5 phút
- Listing/search: 60-120 giây

### 7.3 Invalidation
- Sau mutation liên quan product/media/price: xóa detail + slug + list keys theo pattern/tag.
- Phase nâng cao: dùng cache tagging để invalidation chính xác.

---

## 8) Bảo mật và phân quyền

- Public query: không cần auth cho catalog public.
- Mutation admin: bắt buộc JWT + role `ADMIN`.
- Validate MIME/size cho media (whitelist).
- Chặn overwrite object key trái phép.
- Audit trail mutation quan trọng (ai, lúc nào, thay đổi gì).

---

## 9) Eventing contract

Publish events tối thiểu:
- `product.created.v1`
- `product.updated.v1`
- `product.published.v1`
- `product.archived.v1`
- `product.price_changed.v1`
- `product.media_ready.v1`

Envelope:
```json
{
  "id": "uuid",
  "type": "product.updated.v1",
  "occurredAt": "ISO_DATE",
  "source": "product-service",
  "traceId": "...",
  "data": {}
}
```

---

## 10) Milestone delivery plan (chi tiết)

### Milestone 1 — Foundation (1 tuần)
- NestJS project + Apollo Federation subgraph.
- Env/config module + logger + healthcheck.
- Mongo connection + product seed.
- Query `ping`, `product(id)`, `products` in-memory -> Mongo.

Done criteria:
- Gateway compose thành công.
- Có thể query product list/detail từ gateway.

### Milestone 2 — Catalog Read Complete (1 tuần)
- Hoàn thiện pagination cursor.
- Filter/sort/search cơ bản.
- Category/brand schema + query.
- Redis cache cho detail/list.

Done criteria:
- Query response time ổn định dưới ngưỡng nội bộ.

### Milestone 3 — Admin Write Path (1-2 tuần)
- CRUD product/category/brand/tag.
- Validation input + RBAC admin.
- Price mutation + price history.
- Invalidate cache theo write.

Done criteria:
- Admin mutation đầy đủ + test integration pass.

### Milestone 4 — Media Image Pipeline (1-2 tuần)
- Presigned upload request/confirm cho ảnh.
- Worker generate thumbnail/resized.
- Media gallery + primary media.
- Cleanup orphan pending uploads.

Done criteria:
- Upload ảnh end-to-end hoàn chỉnh.

### Milestone 5 — Hardening + Event Outbox (1 tuần)
- Outbox + publisher worker.
- Structured logs + requestId + metrics cơ bản.
- Error code chuẩn hóa.
- Contract test với gateway.

Done criteria:
- Event publish đáng tin cậy, có retry.

### Milestone 6 — Video + Advanced Search (phase sau)
- Multipart/video pipeline.
- Optional transcode HLS.
- Nâng search engine nếu cần.

---

## 11) Testing strategy

### 11.1 Unit tests
- Resolver/service/repository.
- Validation + business rules.

### 11.2 Integration tests
- GraphQL queries/mutations chính.
- Mongo + Redis + MinIO local stack.

### 11.3 Contract/federation tests
- Composition test với gateway.
- `Product @key` reference resolver test.

### 11.4 E2E smoke
- create product -> upload image -> confirm -> query product detail.

---

## 12) Env variables (dự kiến)

```env
NODE_ENV=development
PORT=4002

MONGODB_URL=mongodb://localhost:27017/product
REDIS_URL=redis://localhost:6379

MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123456
MINIO_BUCKET_ORIGINAL=product-media-original
MINIO_BUCKET_DERIVATIVES=product-media-derivatives

MEDIA_MAX_IMAGE_SIZE_MB=10
MEDIA_MAX_VIDEO_SIZE_MB=500
PRESIGNED_UPLOAD_TTL_SECONDS=900

RABBITMQ_URL=amqp://rabbit:rabbit@localhost:5672
OUTBOX_PUBLISH_INTERVAL_MS=3000
```

---

## 13) Checklist triển khai thực tế

1. Khởi tạo NestJS subgraph + module structure (`catalog`, `media`, `pricing`, `admin`, `common`).
2. Dựng schema GraphQL và DTO validation.
3. Dựng repositories Mongo + indexes.
4. Dựng Redis cache wrapper + invalidation helper.
5. Dựng MinIO uploader/presign service + confirm flow.
6. Dựng worker xử lý media.
7. Dựng outbox + publisher.
8. Viết tests (unit/integration/federation).
9. Kết nối gateway + smoke test.
10. Tài liệu hóa runbook vận hành và sự cố.

---

## 14) Rủi ro chính và cách giảm thiểu

- Rủi ro document media quá lớn -> tách collection `product_media`, phân trang media.
- Rủi ro cache stale -> invalidation on write + TTL ngắn cho listing.
- Rủi ro upload dang dở -> TTL cleanup + trạng thái `PENDING_UPLOAD`.
- Rủi ro publish event fail -> outbox + retry + dead-letter.
- Rủi ro query nặng -> limit max page size + query complexity guard.

---

## 15) Định nghĩa hoàn thành (Definition of Done)

- Subgraph compose ổn định với gateway.
- Catalog query/mutation chính chạy production-like.
- Media image pipeline chạy end-to-end.
- Cache + invalidation đúng.
- Outbox publish hoạt động, có retry.
- Test coverage tối thiểu cho path quan trọng.
- Có tài liệu vận hành và rollback cơ bản.
