# Product Subgraph Backend Review

## 1. Mục tiêu tài liệu

Tài liệu này review `product-subgraph` dưới góc nhìn thiết kế backend để bạn có thể:

- Hiểu rõ subgraph này đang đóng vai trò gì trong hệ thống marketplace
- Nắm được schema GraphQL, workflow nghiệp vụ và cơ chế phân quyền
- Giải thích được vì sao service dùng MongoDB, guard chain, Redis cache và MinIO presign URL
- Nhìn ra các điểm mạnh, trade-off, rủi ro và những câu hỏi phỏng vấn có thể bị hỏi

Đây không phải chỉ là bản tóm tắt API. Mục tiêu là hiểu thật kỹ tư duy thiết kế đang được sử dụng.

## 2. Product-subgraph là gì trong kiến trúc?

`product-subgraph` là service catalog của hệ thống marketplace, được expose dưới dạng GraphQL subgraph để tham gia vào Apollo Federation.

Vai trò chính:

- Quản lý product catalog
- Quản lý workflow trạng thái sản phẩm
- Kiểm soát quyền seller/admin trên dữ liệu sản phẩm
- Quản lý media sản phẩm thông qua MinIO presigned URL
- Cung cấp schema nghiệp vụ cho GraphQL gateway compose

Điểm rất quan trọng:

- Đây không phải REST service
- Đây là domain service expose qua GraphQL
- Nó vừa là data owner, vừa là nơi thực thi authorization theo domain product

## 3. Tổng quan kiến trúc

Các file lõi:

- [app.module.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/app.module.ts)
- [products.module.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/products.module.ts)
- [products.resolver.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/graphql/products.resolver.ts)
- [products.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/application/products.service.ts)
- [product.mongo.schema.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/domain/product.mongo.schema.ts)
- [auth.module.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/auth/auth.module.ts)
- [auth-context.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/auth/auth-context.service.ts)

Stack chính:

- NestJS
- GraphQL Federation Driver
- MongoDB qua Mongoose
- Redis cho cache
- MinIO cho media
- Passport JWT cho xác minh token RS256

Kiến trúc code hiện tại có thể mô tả là:

- `resolver -> service -> model`

Tức là không có repository layer riêng như `user-service`.

Ý nghĩa:

- Kiến trúc gọn hơn
- Service chạm trực tiếp Mongoose model
- Phù hợp với giai đoạn đầu hoặc domain chưa quá phức tạp

Trade-off:

- Ít abstraction hơn
- Viết nhanh hơn
- Nhưng khi business logic và query pattern tăng mạnh, service có thể phình to

## 4. Cách subgraph này tích hợp vào Federation

Trong [app.module.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/app.module.ts), service dùng:

- `ApolloFederationDriver`
- `autoSchemaFile` với `federation: 2`

Điều đó có nghĩa:

- Schema GraphQL được generate từ code-first classes/decorators
- Schema này tương thích Federation v2
- Gateway sẽ introspect schema của subgraph và compose vào supergraph

Ngoài ra, resolver có `@ResolveReference()` cho `Product`, nghĩa là:

- Subgraph này có thể resolve entity reference khi gateway hoặc subgraph khác cần load một `Product` theo id

Đây là dấu hiệu subgraph đã được viết với tư duy federation thực thụ, không chỉ là một GraphQL API độc lập.

## 5. Data model và tư duy lưu trữ

Schema Mongo nằm ở [product.mongo.schema.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/domain/product.mongo.schema.ts).

Field chính:

- `id`
- `sellerId`
- `name`
- `sku`
- `brand`
- `shortDescription`
- `description`
- `price`
- `salePrice`
- `currency`
- `slug`
- `status`
- `publishedAt`
- `archivedAt`
- `coverImage`
- `galleryImages`
- `categoryId`
- `tags`
- `attributes`

### 5.1 Vì sao dùng MongoDB ở đây?

Nhìn vào model có thể thấy product là dạng dữ liệu khá linh hoạt:

- nhiều field optional
- `attributes` động
- media là nested object/list
- tương lai có thể có category/variant/filter facet phong phú

MongoDB hợp lý ở chỗ:

- schema đủ linh hoạt cho catalog
- dễ chứa object lồng nhau
- phù hợp với document model của product

Đây là một quyết định thiết kế rất hợp domain catalog.

### 5.2 Index hiện có

Schema đang tạo index:

- `{ sellerId: 1, status: 1 }`
- `{ categoryId: 1, status: 1 }`
- `{ sku: 1 }` unique
- `{ tags: 1 }`
- text index trên `name` và `tags`

Điều này cho thấy team đã nghĩ trước tới:

- truy vấn theo seller
- lọc theo category/status
- uniqueness của SKU
- nhu cầu search text cơ bản

Mặc dù query hiện tại chưa phức tạp, nhưng index đã phản ánh định hướng mở rộng đúng.

## 6. Schema GraphQL và surface API

Schema generate trong [schema.gql](/D:/document/study/projects/ECommerce/services/product-subgraph/src/schema.gql).

### Queries

- `products`
- `product(id)`
- `productMediaDownloadUrl(id, objectKey)`

### Mutations

- `createProduct(input)`
- `updateProduct(id, input)`
- `deleteProduct(id)`
- `submitProductForReview(id)`
- `approveProduct(id)`
- `rejectProduct(id)`
- `archiveProduct(id)`
- `createProductMediaUploadUrl(id, input)`
- `confirmProductMediaUpload(id, input)`
- `removeProductMedia(id, objectKey)`

Nhìn tổng thể, API surface này phản ánh hai nhóm nhu cầu:

1. Product lifecycle
- create
- update
- submit
- approve
- reject
- archive
- delete

2. Product media lifecycle
- xin URL upload
- xác nhận upload xong
- xin URL download
- remove media

Đây là thiết kế tốt vì media không bị trộn lẫn vào mutation create/update kiểu upload file trực tiếp qua GraphQL, vốn thường rất khó vận hành và scale.

## 7. Phân tích resolver và contract của từng API

Resolver nằm ở [products.resolver.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/graphql/products.resolver.ts).

### 7.1 `products`

- Dùng `OptionalAuthGuard`
- Guest vẫn query được
- Actor có auth sẽ thấy tập dữ liệu khác guest

Đây là một API “visibility-aware”.

Ý nghĩa:

- Public chỉ nên thấy product `APPROVED`
- Seller có thể thấy cả sản phẩm của mình dù chưa approved
- Admin có thể thấy tất cả

Rất hay ở chỗ:

- Cùng một query
- Nhưng kết quả thay đổi theo identity
- Không cần tách `publicProducts`, `myProducts`, `adminProducts` ngay từ đầu

### 7.2 `product(id)`

- Cũng dùng `OptionalAuthGuard`
- Trả product nếu actor có quyền nhìn thấy
- Không thấy thì trả `NotFound`

Đây là lựa chọn khá tốt vì:

- Không lộ quá nhiều trạng thái “có tồn tại nhưng bạn không được xem”
- Giữ semantics an toàn hơn cho resource riêng tư

### 7.3 `productMediaDownloadUrl(id, objectKey)`

- Dùng `OptionalAuthGuard`
- Nếu product `APPROVED` thì public có thể lấy download URL
- Nếu product chưa approved thì chỉ seller sở hữu hoặc admin mới được lấy

Ý nghĩa thiết kế:

- Media access không chỉ phụ thuộc vào objectKey
- Nó phụ thuộc vào visibility của product

Đây là điểm rất đúng về mặt domain security:

- Quyền xem ảnh sản phẩm phải đi theo quyền xem sản phẩm

### 7.4 `createProduct(input)`

Guard chain:

- `AuthGuard`
- `VerifiedSellerGuard`
- `PermissionGuard`

Metadata:

- `@RequiresVerifiedSeller()`
- `@RequiresPermissions('product:create:self')`

Nghĩa là muốn tạo product thì actor phải:

- đăng nhập
- có role seller
- seller đã `VERIFIED`
- KYC đã verified
- có permission tạo product của chính mình

Đây là một thiết kế phân quyền rất đáng chú ý vì nó không dừng ở role.

Nó đang kiểm tra ba lớp:

1. Authentication
2. Business eligibility
3. Fine-grained permission

Đây là điểm rất mạnh của subgraph này.

### 7.5 `updateProduct(id, input)`

Guard chain giống create:

- auth
- verified seller
- permission

Sau đó service còn check:

- product có tồn tại không
- actor có phải owner không
- product đã archived chưa

Điểm hay:

- Guard làm tiền kiểm ở lớp actor-level
- Service làm ownership và entity-state validation

Tách như vậy là hợp lý.

### 7.6 `createProductMediaUploadUrl(id, input)`

Mutation này không upload file trực tiếp.

Nó:

- xác minh actor có quyền sửa product
- build `objectKey`
- xin presigned PUT URL từ MinIO
- trả URL về cho client

Tư duy đằng sau:

- File đi thẳng từ client tới object storage
- API server không phải làm file relay

Đây là thiết kế rất đáng học vì:

- giảm tải server
- dễ scale
- tránh GraphQL multipart upload complexity

### 7.7 `confirmProductMediaUpload(id, input)`

Sau khi client upload xong lên MinIO, nó gọi mutation này để:

- xác nhận upload đã hoàn tất
- gắn metadata media vào product
- set làm cover hoặc gallery

Tại sao cần bước confirm?

- Object storage và DB là hai hệ thống khác nhau
- Upload file xong chưa có nghĩa product DB đã biết file đó
- Cần một bước “commit metadata” ở ứng dụng

Đây là mẫu thiết kế rất tốt cho media workflow.

### 7.8 `removeProductMedia(id, objectKey)`

- Auth + verified seller + permission
- Check ownership
- Check objectKey có đúng namespace của product không
- Gỡ media khỏi DB
- Xóa object khỏi MinIO

Điểm hay:

- Không chỉ xóa DB reference
- Có cleanup object thật

Trade-off:

- Nếu MinIO lỗi thì mutation fail
- Tức là subgraph đang ưu tiên consistency giữa DB và object storage hơn là eventual cleanup async

### 7.9 `deleteProduct(id)`

- Auth + verified seller + permission
- Check ownership
- Xóa toàn bộ media object liên quan
- Invalidate cache
- Delete document khỏi Mongo

Đây là hard delete thực thụ.

Trong khi đó lại có `archiveProduct`, nên ta thấy service đang hỗ trợ cả:

- soft delete theo business (`archive`)
- hard delete thật (`delete`)

Điểm này rất nên để ý khi review domain rule:

- Khi nào seller được archive?
- Khi nào được delete hẳn?
- Nếu product đã có order thì delete hard có còn hợp lý không?

### 7.10 `submitProductForReview(id)`

- Seller verified mới được làm
- Check ownership
- Check status transition hợp lệ
- Chuyển từ `DRAFT` hoặc `REJECTED` sang `PENDING_REVIEW`

Đây là mutation thể hiện rõ workflow moderation.

### 7.11 `approveProduct(id)`

- `AuthGuard + RolesGuard`
- `@RequiresRoles('ADMIN_*')`

Service:

- tìm product
- check state transition sang `APPROVED`
- set `publishedAt` nếu chưa có

Điểm mạnh:

- Có workflow rõ seller -> review -> admin approve
- Admin role match bằng wildcard `ADMIN_*`

### 7.12 `rejectProduct(id)`

- Admin only
- Chỉ cho reject nếu state transition hợp lệ
- Set `publishedAt = null`

### 7.13 `archiveProduct(id)`

- Seller verified + permission
- Check ownership
- Check state transition
- Set `archivedAt`

Điều này cho thấy:

- `status` không chỉ là cờ hiển thị
- Nó là state machine thật của product lifecycle

## 8. Workflow trạng thái sản phẩm

Trong [products.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/application/products.service.ts), có `STATUS_TRANSITIONS`.

Luật hiện tại:

- `DRAFT -> PENDING_REVIEW | ARCHIVED`
- `PENDING_REVIEW -> APPROVED | REJECTED | ARCHIVED`
- `APPROVED -> ARCHIVED`
- `REJECTED -> PENDING_REVIEW | ARCHIVED`
- `ARCHIVED ->` không đi đâu nữa

Đây là một trong những điểm thiết kế đẹp nhất của service.

Tại sao?

- Không update status tùy tiện
- Mọi chuyển trạng thái đều qua guard nghiệp vụ
- Service có tư duy state machine

Ý nghĩa domain:

- seller tạo nháp
- seller submit lên review
- admin duyệt hoặc từ chối
- khi approved thì có thể publish/public
- archived là trạng thái cuối

Đây là cách modeling workflow rất tốt để trả lời phỏng vấn.

## 9. Thiết kế authentication và authorization

Đây là phần cực kỳ quan trọng.

## 9.1 Auth thật sự được resolve thế nào?

Khác với `user-service`, `product-subgraph` không tự là nguồn sự thật về identity.

Nó làm theo mô hình:

1. Nhận `Authorization: Bearer <token>`
2. Verify chữ ký JWT RS256 bằng public key
3. Lấy actor tối thiểu từ claims
4. Gọi sang `user-service /api/users/auth/introspect`
5. Lấy đầy đủ:
  - roles
  - permissions
  - sellerProfile

Điều này xảy ra trong:

- [jwt.strategy.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/auth/strategies/jwt.strategy.ts)
- [auth.guard.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/auth/guards/auth.guard.ts)
- [auth-context.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/auth/auth-context.service.ts)

### 9.2 Vì sao làm hai bước: verify JWT rồi introspect?

Vì JWT payload chỉ nên chứa thông tin tối thiểu:

- `sub`
- `email`
- `iat`
- `exp`

Không nên nhét hết roles/permissions/seller status vào JWT vì:

- token phình to
- stale authorization data
- thay đổi role nhưng token cũ vẫn giữ claims cũ

Thiết kế hiện tại giải quyết được:

- JWT vẫn nhẹ
- quyền được lấy “gần thời gian thực” từ `user-service`

Trade-off:

- Mỗi request auth có thể phụ thuộc vào `user-service`
- Tăng network hop
- Nếu `user-service` chậm hoặc down thì auth của subgraph bị ảnh hưởng

Đây là một trade-off rất thực tế.

## 9.3 Guard chain trong subgraph

Subgraph này đang dùng nhiều guard khác nhau:

- `AuthGuard`
- `OptionalAuthGuard`
- `RolesGuard`
- `PermissionGuard`
- `VerifiedSellerGuard`

Đây là thiết kế phân lớp rất tốt.

### `AuthGuard`

Làm các việc:

- hỗ trợ dev actor từ `x-dev-*` header nếu được phép
- kiểm tra Bearer token có mặt không
- dùng Passport JWT strategy verify token
- nếu actor chỉ có thông tin tối thiểu thì gọi `introspect`
- attach actor vào GraphQL context

Điểm mạnh:

- Tách authentication ra khỏi business rule
- Resolver và guard khác dùng `ctx.actor` thống nhất

### `OptionalAuthGuard`

- Nếu có token thì auth
- Nếu không có token thì vẫn cho đi tiếp như guest

Đây là guard rất phù hợp cho các query public nhưng vẫn muốn personalized visibility.

### `RolesGuard`

- Đọc metadata `roles`
- Hỗ trợ wildcard như `ADMIN_*`
- `SUPER_ADMIN` bypass

Điểm này khá tốt vì:

- Không bị cứng vào đúng từng string role
- Cho phép nhóm role theo prefix

### `PermissionGuard`

- Đọc metadata `permissions`
- Hỗ trợ wildcard permission
- Logic hiện tại là OR giữa các permission required

Đây là điểm cần nhớ:

- Nếu endpoint khai báo nhiều permission thì chỉ cần match một cái
- Đây là thiết kế linh hoạt, nhưng phải cẩn thận khi team tưởng nó là AND

### `VerifiedSellerGuard`

Guard này mới là nơi sửa đúng một rủi ro lớn của `user-service`.

Nó yêu cầu đồng thời:

- có role `SELLER`
- `sellerProfile.status === VERIFIED`
- `sellerProfile.isKycVerified === true`

Điều này rất quan trọng vì:

- `user-service` gán role `SELLER` từ lúc apply
- Nếu subgraph chỉ check role thì sẽ hở
- Guard này đã vá đúng lỗ hổng domain đó

Đây là một điểm review rất đáng khen.

## 10. Cache design

`product-subgraph` có cache thật sự bằng Redis, không chỉ là connection reuse.

Các file liên quan:

- [redis.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/cache/redis.service.ts)
- [product-cache.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/infrastructure/product-cache.service.ts)
- [redis.config.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/config/redis.config.ts)

### 10.1 Cái gì đang được cache?

- list product
- detail product

### 10.2 Cache key phụ thuộc vào actor visibility

Đây là điểm rất hay.

Service không dùng một key chung cho tất cả.

Nó tách theo:

- guest/public
- seller theo `userId`
- admin thì không cache

Ví dụ:

- `product:list:public`
- `product:list:seller:<userId>`
- `product:detail:public:<id>`
- `product:detail:seller:<userId>:<id>`

Ý nghĩa:

- Dữ liệu nhìn thấy phụ thuộc vào actor
- Cache phải phản ánh visibility rule

Nếu cache không tách theo actor:

- rất dễ lộ dữ liệu chưa approved cho public

Đây là một thiết kế cache rất đúng với authorization-aware read model.

### 10.3 Vì sao admin không cache?

Trong code:

- nếu actor là admin thì `listKey/detailKey` trả `null`

Đây là quyết định hợp lý vì:

- admin có thể thấy toàn bộ dữ liệu, bao gồm trạng thái thay đổi liên tục
- admin traffic thường thấp hơn public traffic
- cache admin dễ phức tạp, invalidation khó hơn, lợi ích ít hơn

### 10.4 TTL hiện tại

- list: mặc định 300 giây
- detail: mặc định 600 giây

Trade-off:

- tăng hiệu năng đọc
- chấp nhận stale trong khoảng TTL

Nhưng service cũng chủ động invalidate khi có mutation.

### 10.5 Invalidation strategy

Sau các hành động create/update/delete/archive/approve/reject/media change:

- service gọi `invalidateProduct(product.id, product.sellerId)`

Hiện tại invalidation xóa:

- cache public list
- cache seller list của owner
- cache public detail
- cache seller detail của owner

Điểm mạnh:

- đơn giản
- đủ dùng cho visibility hiện tại

Điểm cần lưu ý:

- nếu tương lai có thêm nhiều kiểu view khác, invalidation pattern sẽ phức tạp hơn

## 11. Thiết kế media với MinIO

Đây là phần khá chuyên nghiệp của subgraph.

Các file:

- [minio-product-media.service.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/modules/products/infrastructure/minio-product-media.service.ts)
- [minio.config.ts](/D:/document/study/projects/ECommerce/services/product-subgraph/src/config/minio.config.ts)

### 11.1 Tại sao dùng presigned URL?

Vì upload/download media trực tiếp qua app server có nhiều nhược điểm:

- tăng tải I/O
- tăng độ trễ
- tăng chi phí tài nguyên
- khó scale

Presigned URL cho phép:

- client upload thẳng lên object storage
- client download thẳng từ object storage
- app server chỉ kiểm soát quyền và metadata

Đây là mẫu thiết kế rất tốt cho product media.

### 11.2 Object key namespacing

Object key được build dạng:

- `products/<productId>/<timestamp>-<uuid>-<safeFileName>`

Ý nghĩa:

- tách namespace theo product
- giảm va chạm
- dễ kiểm tra object key có thuộc product không

### 11.3 Xác minh objectKey thuộc product

Service có `ensureObjectKeyMatchesProduct(id, objectKey)`

Tại sao cần?

- Tránh actor cố attach hoặc xóa object thuộc product khác
- Đây là lớp kiểm tra ownership ở tầng object storage namespace

Đây là một lớp bảo vệ rất đúng và thường bị bỏ quên ở nhiều hệ thống.

## 12. Visibility rule và ownership rule

Hai rule nền tảng trong `ProductsService` là:

### 12.1 Visibility rule

`buildVisibilityQuery(actor)`:

- guest chỉ thấy `APPROVED`
- admin thấy tất cả
- seller thấy:
  - tất cả product `APPROVED`
  - cộng với product của chính họ

Đây là một read policy rất hợp marketplace.

### 12.2 Ownership rule

`ensureCanManageProduct(actor, sellerId)`:

- admin bypass
- seller thường chỉ quản lý product của chính họ

Điểm hay là service không để toàn bộ logic này nằm trong guard metadata.

Lý do đúng:

- ownership cần dữ liệu của entity cụ thể
- guard metadata chỉ biết actor-level rule, không biết entity owner

Đây là cách phân tầng hợp lý:

- guard cho rule tổng quát
- service cho entity-aware rule

## 13. Rate limit, worker, audit: hiện có hay chưa?

### 13.1 Rate limit

Hiện tại chưa thấy rate limit riêng trong subgraph.

Điều này có nghĩa:

- GraphQL query/mutation chưa có lớp anti-abuse ở service này
- Có thể kỳ vọng gateway hoặc proxy ngoài xử lý
- Hoặc đây là phần chưa được triển khai

Đây là một điểm nên note khi review, đặc biệt vì:

- presigned URL generation
- media flow
- product query

đều là những chỗ có thể bị abuse.

### 13.2 Worker

Hiện tại `product-subgraph` chưa có background worker.

Điều đó hợp lý vì:

- các mutation hiện xử lý đồng bộ
- chưa có job như image processing, moderation async, search indexing, notification

Nhưng về tương lai, các điểm dễ cần worker là:

- tạo thumbnail
- virus scan media
- sync search index
- moderation pipeline

### 13.3 Audit

Hiện tại không thấy audit log riêng như `user-service`.

Điều này không sai ở giai đoạn đầu, nhưng nếu hệ thống lớn hơn thì các hành động như:

- approve/reject product
- delete product
- media remove

rất nên có audit trail.

## 14. Điểm mạnh kỹ thuật của product-subgraph

- Domain product được model theo state machine rõ ràng
- Authorization không chỉ dựa vào role mà còn kiểm tra verified seller status + KYC
- Tích hợp `user-service introspect` để lấy quyền gần thời gian thực
- Cache Redis có awareness về visibility theo actor
- Media flow với MinIO presigned URL là hướng thiết kế rất thực tế
- Ownership rule và visibility rule được tách khá rõ
- Resolver surface phản ánh đúng workflow marketplace

## 15. Rủi ro, trade-off và điểm cần review kỹ

### 15.1 Phụ thuộc runtime vào user-service để introspect

Ưu điểm:

- quyền mới hơn
- không nhồi claims vào JWT

Rủi ro:

- user-service chậm hoặc down thì product auth bị ảnh hưởng
- tăng latency mỗi request auth

### 15.2 `generateNextId()` hiện tại không scale tốt

Service đang:

- query toàn bộ product id
- tìm max
- tăng lên 1

Với dữ liệu lớn hoặc concurrent create:

- không hiệu quả
- có nguy cơ race condition

Đây là một điểm kỹ thuật rất nên nhắc khi review.

### 15.3 Delete hard + archive cùng tồn tại

Domain cần rõ:

- khi nào archive
- khi nào delete thật

Nếu đã có order/inventory/audit phụ thuộc product, hard delete có thể nguy hiểm.

### 15.4 Permission logic hiện tại là OR

`PermissionGuard` dùng `some(...)`, nghĩa là nhiều permission required là OR.

Nếu team không thống nhất semantics này, rất dễ hiểu sai.

### 15.5 Chưa có audit trail cho admin moderation

Approve/reject product là hành vi nhạy cảm, nên tương lai rất nên có audit.

### 15.6 Chưa có rate limit cho GraphQL layer

Media URL generation và product mutation là các điểm có thể bị abuse.

## 16. Câu hỏi phỏng vấn có thể dùng ngay

- Tại sao product-subgraph lại xác thực JWT rồi còn gọi introspect sang user-service?
- Vì sao permission không nên nhét hết vào JWT?
- Tại sao verified seller phải check cả role lẫn `sellerProfile.status` và `isKycVerified`?
- Vì sao cache product phải tách theo actor visibility?
- Tại sao media upload không đi qua GraphQL mutation trực tiếp mà dùng presigned URL?
- State machine của product giúp gì so với việc cho update status tự do?
- Vì sao ownership check nên nằm ở service thay vì chỉ guard metadata?
- Rủi ro của `generateNextId()` hiện tại là gì?

## 17. Tóm tắt ngắn để nhớ

- `product-subgraph` là domain service quản lý product catalog dưới dạng GraphQL federation subgraph.
- Điểm mạnh nhất của nó là workflow sản phẩm rõ ràng, guard chain phân quyền tốt, và verified-seller check đã xử lý đúng rủi ro role `SELLER` được gán sớm từ `user-service`.
- Redis cache được thiết kế theo actor visibility, đây là một chi tiết rất tốt.
- Media flow với MinIO presigned URL là hướng triển khai thực tế và scale tốt hơn upload qua server.
- Điểm cần review kỹ nhất là phụ thuộc vào `user-service introspect`, thiếu rate limit/audit, và `generateNextId()` chưa phù hợp nếu scale lớn.
