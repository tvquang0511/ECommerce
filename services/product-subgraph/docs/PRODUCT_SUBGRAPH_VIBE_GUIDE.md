# Product Subgraph - Báo Cáo Đầy Đủ Cho Người Mới

Mục tiêu của tài liệu này:
- Giải thích toàn bộ những gì đã làm trong product-subgraph bằng tiếng Việt rõ ràng, có dấu.
- Chỉ rõ vị trí file và vị trí hàm để bạn mở code theo từng phần.
- Giải thích theo tư duy thực hành, phù hợp kiểu vibe coding và nền tảng kiến thức cơ bản.

Tài liệu này bám theo trạng thái code hiện tại trong workspace.

---

## 1) Bức tranh tổng thể: service này đang làm gì?

Product-subgraph hiện tại chịu trách nhiệm 4 nhóm chính:

1. Quản lý dữ liệu sản phẩm
- Tạo, sửa, xóa, đọc danh sách, đọc chi tiết.
- Quản lý trạng thái vòng đời sản phẩm.

2. Quản lý media sản phẩm qua MinIO
- Tạo URL presign để upload.
- Xác nhận upload để lưu metadata.
- Tạo URL presign để download.
- Xóa media và dọn rác khi xóa sản phẩm.

3. Tăng tốc đọc dữ liệu bằng Redis cache
- Cache cho danh sách sản phẩm.
- Cache cho chi tiết sản phẩm.
- Invalidate cache khi có mutation.

4. Chuẩn bị nền tảng trước federation
- Schema rõ ràng.
- Luồng nghiệp vụ rõ ràng.
- Cấu hình môi trường rõ ràng.

Điểm bắt đầu để đọc kiến trúc:
- [services/product-subgraph/src/app.module.ts](services/product-subgraph/src/app.module.ts#L1)
- [services/product-subgraph/src/products/products.module.ts](services/product-subgraph/src/products/products.module.ts#L1)

---

## 2) Cấu trúc theo lớp: đọc từ đâu cho dễ hiểu?

Để dễ nắm, đọc theo thứ tự này:

1. Resolver: API có gì, route GraphQL nào có sẵn
- [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L1)

2. Service: logic nghiệp vụ thực sự
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L1)

3. Schema + Input + DTO: dữ liệu vào ra và dữ liệu lưu
- [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L1)
- [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L1)
- [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L1)
- [services/product-subgraph/src/products/dto/create-product.dto.ts](services/product-subgraph/src/products/dto/create-product.dto.ts#L1)
- [services/product-subgraph/src/products/dto/update-product.dto.ts](services/product-subgraph/src/products/dto/update-product.dto.ts#L1)

4. Hạ tầng hỗ trợ: MinIO + Redis + Config
- [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L1)
- [services/product-subgraph/src/cache/redis.service.ts](services/product-subgraph/src/cache/redis.service.ts#L1)
- [services/product-subgraph/src/cache/product-cache.service.ts](services/product-subgraph/src/cache/product-cache.service.ts#L1)
- [services/product-subgraph/src/configuration.ts](services/product-subgraph/src/configuration.ts#L1)

---

## 3) Những vấn đề chính đã xử lý (và vì sao quan trọng)

### 3.1 Chuẩn hóa dữ liệu sản phẩm cho thực tế ecommerce

Vấn đề trước đây:
- Product còn thiếu nhiều field nghiệp vụ thực tế.

Đã làm:
- Thêm sku, brand, shortDescription, description.
- Thêm salePrice, currency.
- Thêm publishedAt, archivedAt.
- Thêm coverImage, galleryImages.
- Giữ attributes để linh hoạt theo ngành hàng.

Vị trí:
- [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L25)

Ý nghĩa:
- Dữ liệu đủ sâu để phục vụ listing, detail, workflow duyệt, media và tích hợp gateway sau này.

---

### 3.2 Khóa chặt workflow trạng thái sản phẩm

Vấn đề trước đây:
- Nếu không có luật chuyển trạng thái, dữ liệu rất dễ “nhảy sai”, làm UI và nghiệp vụ rối.

Đã làm:
- Định nghĩa bảng STATUS_TRANSITIONS.
- Chỉ cho phép chuyển trạng thái hợp lệ.
- Tự động set/clear timestamp theo trạng thái.

Vị trí:
- Bảng luật: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L21)
- Hàm kiểm tra: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L511)

Ý nghĩa:
- Giữ vòng đời sản phẩm ổn định trước khi đưa vào federation.

---

### 3.3 Hoàn thiện media flow chuẩn presign với MinIO

Vấn đề trước đây:
- Chưa có luồng upload/download media tối ưu.

Đã làm:
- Presign PUT cho upload.
- Confirm upload để lưu metadata vào product.
- Presign GET cho download.
- Xóa media riêng lẻ.
- Xóa toàn bộ media khi xóa product.

Vị trí:
- Service MinIO: [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L16)
- Resolver media: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L57)
- Logic media trong product service: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L217)

Ý nghĩa:
- Giảm tải backend (không stream file qua app).
- Bảo mật hơn nhờ URL có thời hạn.
- Sẵn sàng cho kiến trúc gateway/subgraph.

---

### 3.4 Thêm Redis cache cho truy vấn đọc

Vấn đề trước đây:
- Query list/detail đều chạm DB trực tiếp.

Đã làm:
- Cache list và detail theo actor context.
- Invalidate cache ngay sau mutation có ảnh hưởng dữ liệu.

Vị trí:
- Redis wrapper: [services/product-subgraph/src/cache/redis.service.ts](services/product-subgraph/src/cache/redis.service.ts#L1)
- Cache policy: [services/product-subgraph/src/cache/product-cache.service.ts](services/product-subgraph/src/cache/product-cache.service.ts#L7)
- Chỗ gọi cache/invalidate: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L41)

Ý nghĩa:
- Tăng tốc độ phản hồi cho màn hình list/detail.
- Giảm áp lực Mongo.

---

### 3.5 Chuẩn hóa môi trường chạy

Đã làm:
- Bổ sung env cho auth, redis, minio.
- Đăng ký config factories đầy đủ.
- Tạo bucket product-private trong docker dev.

Vị trí:
- [services/product-subgraph/.env](services/product-subgraph/.env#L1)
- [services/product-subgraph/.env.example](services/product-subgraph/.env.example#L1)
- [services/product-subgraph/src/configuration.ts](services/product-subgraph/src/configuration.ts#L1)
- [infra/docker/docker-compose.dev.yml](infra/docker/docker-compose.dev.yml#L57)

---

## 4) Giải thích chi tiết từng phần code quan trọng

## 4.1 Resolver: lớp API vào hệ thống

File chính:
- [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L1)

Resolver làm các việc:
- Định nghĩa query/mutation.
- Áp guard/role cho các thao tác nhạy cảm.
- Bắt trường hợp không tìm thấy và trả NotFoundException.
- Chuyển dữ liệu args vào service.

Các API đọc:
- products: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L32)
- product: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L41)
- productMediaDownloadUrl: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L57)

Các API ghi:
- createProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L77)
- updateProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L91)
- createProductMediaUploadUrl: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L107)
- confirmProductMediaUpload: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L128)
- removeProductMedia: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L149)
- deleteProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L166)
- submitProductForReview: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L179)
- approveProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L195)
- rejectProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L208)
- archiveProduct: [services/product-subgraph/src/products/products.resolver.ts](services/product-subgraph/src/products/products.resolver.ts#L221)

Ý nghĩa cho người mới:
- Resolver giống “cửa API”.
- Mọi rule sâu hơn nằm ở service.

---

## 4.2 ProductsService: bộ não nghiệp vụ

File chính:
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L1)

Đây là nơi quan trọng nhất hiện tại.

### A) Nhóm hàm đọc dữ liệu

1. findAll
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L41)
- Luồng:
1. Đọc cache list theo actor.
2. Nếu cache hit thì trả luôn.
3. Nếu miss thì build visibility query.
4. Query Mongo.
5. map toProduct.
6. Lưu cache.

2. findById
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L55)
- Luồng tương tự findAll nhưng áp dụng theo id.

### B) Nhóm hàm CRUD

3. create
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L75)
- Điểm chính:
1. generateNextId tạo id dạng p1, p2, p3.
2. buildSlug theo tên.
3. Khởi tạo status DRAFT.
4. Khởi tạo media rỗng.
5. Invalidate cache liên quan.

4. update
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L103)
- Điểm chính:
1. Tìm product trước.
2. Check quyền quản lý.
3. Chặn sửa nếu ARCHIVED.
4. Nếu đổi name thì cập nhật slug.
5. Update + invalidate cache.

5. remove
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L139)
- Điểm chính:
1. Check quyền.
2. Thu thập objectKey media.
3. Xóa object trên MinIO.
4. Invalidate cache.
5. Xóa record trong Mongo.

### C) Nhóm workflow trạng thái

6. submitForReview
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L158)
- Đổi sang PENDING_REVIEW nếu hợp lệ.

7. approve
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L173)
- Đổi sang APPROVED và set publishedAt nếu chưa có.

8. reject
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L187)
- Đổi sang REJECTED và clear publishedAt.

9. archive
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L201)
- Đổi sang ARCHIVED và set archivedAt.

### D) Nhóm media flow

10. createMediaUploadUrl
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L217)
- Mục tiêu: cấp URL upload có hạn.
- Điểm an toàn: check owner/admin, chặn product ARCHIVED.

11. confirmMediaUpload
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L244)
- Mục tiêu: chỉ khi upload thành công mới ghi metadata vào DB.
- Hỗ trợ 2 kiểu: COVER và GALLERY.

12. removeMedia
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L289)
- Mục tiêu: xóa media khỏi DB và MinIO đồng bộ.

13. createMediaDownloadUrl
- Vị trí: [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L327)
- Mục tiêu: cấp URL download có hạn.
- Quyền xem:
1. Nếu product APPROVED thì public xem được.
2. Nếu chưa APPROVED thì chỉ owner/admin.

### E) Nhóm helper private quan trọng

14. buildSlug
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L403)
- Chuẩn hóa tên thành slug URL-friendly.

15. generateNextId
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L412)
- Quét id hiện có để tạo id kế tiếp.

16. buildObjectKey
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L427)
- Chuẩn key lưu object theo prefix products/{productId}/.

17. ensureObjectKeyMatchesProduct
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L438)
- Chặn objectKey không thuộc product hiện tại.

18. collectMediaObjectKeys
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L445)
- Gom key cover + gallery, dùng cho xóa và kiểm tra tồn tại.

19. isActorAllowedMediaAccess
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L464)
- Rule quyền xem media theo trạng thái và vai trò.

20. buildVisibilityQuery
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L483)
- Rule nhìn thấy product theo actor:
1. Public: chỉ APPROVED.
2. Seller: APPROVED hoặc sản phẩm của chính seller.
3. Admin: thấy tất cả.

21. ensureCanManageProduct
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L501)
- Chặn người không phải owner/admin sửa dữ liệu.

22. ensureStatusTransition
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L511)
- Chặn chuyển trạng thái trái luật.

23. isAdmin
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L523)
- Nhận diện role admin/super admin.

---

## 5) Tầng dữ liệu: Schema, GraphQL type, Input, DTO

### 5.1 Schema Mongoose

File:
- [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L1)

Những điểm rất quan trọng:
- id unique: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L26)
- sku unique: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L35)
- currency enum: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L53)
- status enum: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L59)
- media fields: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L68)
- attributes linh hoạt: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L80)
- index cho truy vấn: [services/product-subgraph/src/products/product.schema.ts](services/product-subgraph/src/products/product.schema.ts#L88)

### 5.2 GraphQL output types

File:
- [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L1)

Có các output quan trọng:
- ProductImage: [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L5)
- Product: [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L23)
- ProductUploadUrlPayload: [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L80)
- ProductDownloadUrlPayload: [services/product-subgraph/src/products/graphql/product.type.ts](services/product-subgraph/src/products/graphql/product.type.ts#L95)

### 5.3 GraphQL input types

File:
- [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L1)

Có các input chính:
- CreateProductInput: [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L19)
- UpdateProductInput: [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L82)
- ProductMediaUploadInput: [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L148)
- ProductMediaConfirmInput: [services/product-subgraph/src/products/graphql/product.input.ts](services/product-subgraph/src/products/graphql/product.input.ts#L163)

### 5.4 DTO validate trong service

File:
- [services/product-subgraph/src/products/dto/create-product.dto.ts](services/product-subgraph/src/products/dto/create-product.dto.ts#L1)
- [services/product-subgraph/src/products/dto/update-product.dto.ts](services/product-subgraph/src/products/dto/update-product.dto.ts#L1)

Giải thích ngắn cho người mới:
- Input: contract ở cửa GraphQL.
- DTO: lọc dữ liệu hợp lệ trước business logic.
- Schema: dữ liệu thực sự lưu trong DB.

---

## 6) Cache chi tiết: đọc nhanh nhưng không sai dữ liệu

File chính:
- [services/product-subgraph/src/cache/redis.service.ts](services/product-subgraph/src/cache/redis.service.ts#L1)
- [services/product-subgraph/src/cache/product-cache.service.ts](services/product-subgraph/src/cache/product-cache.service.ts#L1)

Key pattern đang dùng:
- product:list:public
- product:list:seller:{sellerId}
- product:detail:public:{id}
- product:detail:seller:{sellerId}:{id}

TTL:
- list lấy từ PRODUCT_LIST_CACHE_TTL.
- detail lấy từ PRODUCT_DETAIL_CACHE_TTL.

Chính sách đặc biệt:
- Admin không cache để luôn nhìn dữ liệu mới nhất.

Invalidate:
- Được gọi sau tất cả mutation chính và media mutation.

Ý nghĩa thực tế:
- Người dùng đọc nhanh hơn.
- Không “kẹt dữ liệu cũ” sau khi sửa vì đã invalidate.

---

## 7) MinIO chi tiết: luồng upload/download chuẩn

File chính:
- [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L1)

Các hàm cốt lõi:
- getBucket: [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L39)
- presignPutObject: [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L43)
- presignGetObject: [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L55)
- removeObject: [services/product-subgraph/src/media/minio.service.ts](services/product-subgraph/src/media/minio.service.ts#L67)

Bucket dev đã tạo:
- [infra/docker/docker-compose.dev.yml](infra/docker/docker-compose.dev.yml#L57)

Quy tắc object key:
- products/{productId}/{timestamp}-{uuid}-{safe-file-name}
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L427)

Tại sao cần check prefix:
- Tránh trường hợp user cố gắng dùng objectKey của product khác.
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L438)

---

## 8) Config và wiring module

Config factories load toàn cục:
- [services/product-subgraph/src/configuration.ts](services/product-subgraph/src/configuration.ts#L1)

App module:
- ConfigModule, Mongoose, GraphQL, AuthModule, ProductsModule
- [services/product-subgraph/src/app.module.ts](services/product-subgraph/src/app.module.ts#L1)

Products module:
- AuthModule + CacheModule + MinioModule + ProductSchema
- [services/product-subgraph/src/products/products.module.ts](services/product-subgraph/src/products/products.module.ts#L1)

---

## 9) Môi trường chạy: giải thích biến trong .env

File:
- [services/product-subgraph/.env](services/product-subgraph/.env#L1)
- [services/product-subgraph/.env.example](services/product-subgraph/.env.example#L1)

Nhóm biến bắt buộc:

1. App và DB
- NODE_ENV
- PORT
- MONGO_URI

2. Auth
- USER_SERVICE_BASE_URL
- JWT_PRODUCT_PUBLIC_KEY_PEM_B64
- AUTH_REQUEST_TIMEOUT_MS
- AUTH_ALLOW_TEST_HEADERS

3. Redis cache
- REDIS_URL
- PRODUCT_LIST_CACHE_TTL
- PRODUCT_DETAIL_CACHE_TTL

4. MinIO
- MINIO_ENDPOINT
- MINIO_PORT
- MINIO_USE_SSL
- MINIO_ACCESS_KEY
- MINIO_SECRET_KEY
- MINIO_PRIVATE_BUCKET
- MINIO_PRESIGN_EXPIRY_SECONDS

---

## 10) Luồng sử dụng chuẩn từ góc nhìn frontend/client

### 10.1 Luồng sản phẩm

1. createProduct
2. updateProduct
3. submitProductForReview
4. approveProduct hoặc rejectProduct
5. archiveProduct khi cần

### 10.2 Luồng media

1. createProductMediaUploadUrl để lấy uploadUrl
2. Client upload file trực tiếp vào MinIO bằng uploadUrl
3. confirmProductMediaUpload để ghi metadata vào product
4. productMediaDownloadUrl để lấy link tải xem
5. removeProductMedia để xóa file

### 10.3 Luồng cache

1. Gọi products/product lần đầu, hệ thống đọc DB và set cache
2. Gọi lần hai cùng ngữ cảnh actor, hệ thống trả từ cache
3. Sau mutation, cache bị xóa theo key liên quan
4. Lần đọc kế tiếp tự build cache mới

---

## 11) Những điểm cần lưu ý kỹ để tránh bug

1. generateNextId hiện quét toàn bộ id
- [services/product-subgraph/src/products/products.service.ts](services/product-subgraph/src/products/products.service.ts#L412)
- Dev ổn, dữ liệu lớn có thể chậm.

2. salePrice hiện mới validate >= 0
- Chưa có rule bắt buộc salePrice <= price.
- Nếu cần nghiệp vụ chặt hơn, thêm check ở DTO/service.

3. remove product đang xóa object trước rồi xóa DB
- Nếu DB lỗi sau đó có thể tạo trạng thái lệch tạm thời.
- Production nên cân nhắc retry/outbox.

4. Rate limit chưa implement code
- Mới ở mức thiết kế, chưa có guard/interceptor thực thi.

5. Chưa làm migration/seed/test theo roadmap
- Theo định hướng hiện tại, bạn đang ưu tiên hoàn thiện code core trước.

---

## 12) Tình trạng hiện tại và bước tiếp theo

Đã hoàn thiện tốt:
- Schema sản phẩm mở rộng đầy đủ cho giai đoạn này.
- Workflow trạng thái có luật rõ ràng.
- MinIO presign PUT/GET + confirm/remove + cleanup khi delete.
- Redis cache list/detail + invalidate chuẩn.
- .env và config wiring đầy đủ để chạy local.

Còn thiếu trước khi chuyển hẳn federation production-minded:
- Rate limit thực thi.
- Chuẩn hóa thêm rule nghiệp vụ giá nếu cần.
- Federation conversion chính thức với key directives.

---

## 13) Ghi nhớ ngắn cho vibe coding

- Resolver là cửa API.
- Service là nơi đặt toàn bộ luật nghiệp vụ.
- Input/DTO/Schema là 3 tầng bảo vệ dữ liệu.
- MinIO presign giúp upload/download an toàn và nhẹ backend.
- Cache giúp nhanh hơn nhưng phải invalidate đúng chỗ.

Nếu bạn nắm chắc 5 ý trên và lần lượt đọc theo các link trong tài liệu này, bạn đã nắm được toàn bộ product-subgraph ở mức rất thực dụng để tự phát triển tiếp.
