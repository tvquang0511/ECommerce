# Next Steps Plan - Product Subgraph, Gateway, and Web App

**Scope**: tập trung đúng 4 mảng chính của đồ án hiện tại

1. `user-service` - rà soát, chỉ nâng cấp cần thiết.
2. `product-subgraph` - thiết kế product chi tiết, media MinIO, cache, rate limit.
3. `graphql-gateway` - federation entrypoint và auth forwarding.
4. `web` Next.js - app test end-to-end cho 3 service.

**Current status summary**

- `user-service`: auth flow đã chạy, JWT RS256 đã có, login lấy access token được.
- `product-subgraph`: GraphQL subgraph đã chạy, có auth guards và verified seller guard.
- `graphql-gateway`: còn cần hoàn thiện thành entrypoint thống nhất cho frontend.
- `web`: đã có Next.js app, chưa gắn vào luồng test chính thức.

---

## 1) User Service - chỉ rà soát và nâng cấp cần thiết

Mục tiêu ở mảng này không phải rewrite, mà là làm cho auth contract đủ ổn định để các service khác dùng lâu dài.

### 1.1 Việc cần rà soát

- Token contract giữa `user-service` và các service khác.
- Cấu trúc claims: `sub`, `email`, `roles`, `permissions`, `sellerProfile`.
- Refresh token rotation và revoke session.
- Audit log cho login, refresh, logout, 2FA, reset password.
- Rate limit cho login, refresh, forgot-password, OTP.
- Chuẩn hóa lỗi trả về để frontend và gateway xử lý thống nhất.

### 1.2 Nâng cấp nên làm nếu còn thiếu

- Thêm JWKS endpoint nếu muốn chuẩn hóa verify key cho nhiều service.
- Tách rõ user identity với seller profile để tránh auth payload quá nặng.
- Chuẩn hóa response cho `me`, `login`, `introspect`.
- Bổ sung test cho các case token hết hạn, revoke, và session invalid.

### 1.3 Kết quả mong muốn

- `user-service` là nguồn sự thật duy nhất cho auth.
- Các service khác chỉ verify token và resolve actor data qua contract ổn định.
- Không có logic auth rải rác, tránh lệch hành vi giữa gateway và subgraph.

---

## 2) Product Subgraph - product design, MinIO media, cache, rate limit

Đây là phần cần làm sâu nhất vì nó là lõi catalog của marketplace.

### 2.1 Product model đề xuất

Product nên được thiết kế để đủ cho marketplace thật, nhưng vẫn giữ cấu trúc dễ mở rộng.

#### Core fields

- `id`: định danh nội bộ hoặc public id.
- `sellerId`: chủ sản phẩm.
- `name`: tên sản phẩm.
- `slug`: URL-friendly identifier.
- `sku`: mã hàng hóa nội bộ.
- `status`: trạng thái vòng đời sản phẩm.
- `categoryId`: phân loại sản phẩm.
- `brand`: thương hiệu.

#### Commerce fields

- `price`: giá hiện tại.
- `salePrice`: giá khuyến mãi.
- `currency`: đơn vị tiền tệ, ví dụ `VND`.
- `stockPolicy`: policy tồn kho, ví dụ `IN_STOCK`, `PREORDER`, `OUT_OF_STOCK`.
- `weight`, `dimensions`: nếu sau này có shipping.

#### Content fields

- `shortDescription`.
- `description`.
- `tags`.
- `attributes`: object key-value cho màu, size, material, RAM, storage, v.v.
- `metaTitle`.
- `metaDescription`.
- `isFeatured`.

#### Lifecycle fields

- `createdAt`.
- `updatedAt`.
- `publishedAt`.
- `archivedAt`.
- `approvedAt`.
- `rejectedAt`.

### 2.2 Media bằng MinIO

Không lưu file ảnh trong Mongo. Nên tách rõ metadata và file vật lý.

#### Mô hình nên dùng

- MongoDB lưu metadata: loại file, url public, minio object key, size, mimeType, sortOrder, isCover.
- MinIO lưu file binary.
- Client upload qua presigned URL để tránh product-subgraph phải relay file lớn.
- Sau upload thành công, client gọi mutation để gắn media vào product.

#### Media fields nên có

- `coverImage`
- `galleryImages`
- `mediaKeys`
- `thumbnailKey`
- `mimeType`
- `fileSize`
- `altText`
- `sortOrder`

#### Flow upload đề xuất

1. Frontend xin presigned upload URL từ product-subgraph.
2. Frontend upload file trực tiếp lên MinIO.
3. Frontend gọi mutation confirm upload để lưu metadata.
4. Khi đổi ảnh hoặc xóa product, chạy cleanup metadata và object key.

#### Quy tắc media

- 1 product nên có 1 cover image.
- Gallery nhiều ảnh.
- Có thể sinh thumbnail/medium/large sau này bằng worker hoặc background job.
- Không xóa file MinIO ngay trong request chính nếu có thể tránh, nên dùng async cleanup.

### 2.3 Rate limit nên áp dụng

Rate limit nên chia theo nhóm hành vi, không dùng một mức chung cho toàn service.

#### Public read

- `products` list.
- `product` detail.
- Giới hạn nhẹ để chống scrape.
- Có thể ưu tiên cache thay vì limit quá nặng.

#### Seller write

- `createProduct`.
- `updateProduct`.
- `submitProductForReview`.
- `archiveProduct`.
- `upload media`.
- Giới hạn chặt hơn để chống spam và giảm lỗi dữ liệu.

#### Admin actions

- `approveProduct`.
- `rejectProduct`.
- Giới hạn vừa phải, nhưng cần audit log rõ.

#### Suggested policy

- Read public: 60-120 req/min/IP.
- Seller write: 10-20 req/min/user.
- Media upload: 5-10 req/min/user.
- Admin action: 20-30 req/min/user.

### 2.4 Cache nên dùng

Cache nên ưu tiên cho read path.

#### Nên cache

- Product list public.
- Product detail public.
- Featured products.
- Category listing.

#### Không nên cache hoặc cache rất ngắn

- Mutation response.
- Dashboard riêng theo seller.
- Product chờ duyệt hoặc nội dung quá động.

#### Redis key pattern đề xuất

- `product:list:public`
- `product:list:category:<categoryId>`
- `product:detail:<id>`
- `product:seller:<sellerId>`
- `product:featured`

#### TTL gợi ý

- List public: 30-60 giây.
- Detail: 1-5 phút.
- Featured: 1-10 phút.
- Seller dashboard: ngắn hơn hoặc bypass nếu dữ liệu thay đổi liên tục.

#### Invalidation

- Update product -> xóa detail + list liên quan.
- Change status -> xóa cache public.
- Update media -> xóa detail cache.
- Approve/reject -> xóa cả list public và cache theo seller.

### 2.5 Product workflow nên hoàn thiện

- `DRAFT`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `ARCHIVED`

#### Luồng khuyến nghị

1. Seller tạo product ở `DRAFT`.
2. Seller bổ sung media và nội dung.
3. Seller submit để review.
4. Admin approve hoặc reject.
5. Product approved mới hiển thị public.
6. Archive chỉ dành cho owner hoặc admin.

### 2.6 Kết quả mong muốn ở product-subgraph

- Schema product đủ cho marketplace thật.
- Media dùng MinIO đúng cách.
- Cache và rate limit tách biệt theo action.
- Dễ đưa lên federation sau này mà không phải đập lại model.

---

## 3) GraphQL Gateway - federation entrypoint

Gateway là nơi frontend gọi vào, nên nó phải đóng vai trò composition và forwarding.

### 3.1 Mục tiêu gateway

- Compose schema từ product-subgraph và sau này cart/order.
- Forward `Authorization` xuống subgraph.
- Forward correlation id hoặc request id.
- Làm entrypoint duy nhất cho web app.

### 3.2 Quy tắc thiết kế

- Gateway không giữ business logic nặng.
- Authorization vẫn nằm ở subgraph/service.
- Gateway chỉ nên giữ policy nhẹ như rate limit, depth limit, complexity limit.
- Không query DB trực tiếp.

### 3.3 Federation plan

#### Phase 1

- Gateway compose product-subgraph.
- Web app đọc catalog thông qua gateway.
- Kiểm tra auth passthrough hoạt động.

#### Phase 2

- Thêm cart-subgraph.
- Gateway merge product + cart.
- Test query chéo giữa product và cart.

#### Phase 3

- Thêm order-subgraph.
- Gateway trở thành entrypoint cho checkout flow.

### 3.4 Gateway policies nên có

- Request timeout cho từng subgraph.
- Forward header chuẩn hóa.
- Error mapping rõ ràng.
- Bật introspection chỉ ở dev.
- Query complexity limit nếu frontend bắt đầu query sâu.

### 3.5 Kết quả mong muốn

- Một endpoint GraphQL duy nhất cho web app.
- Không cần frontend biết từng subgraph riêng lẻ.
- Dễ mở rộng sang cart/order mà không đổi contract frontend quá nhiều.

---

## 4) Next.js Web App - test console cho 3 service

Web app nên được làm như một console vận hành hơn là chỉ là UI demo.

### 4.1 Mục tiêu

- Dùng để login và lấy access token.
- Dùng để test gateway GraphQL.
- Dùng để test product CRUD và media flow.
- Dùng để kiểm tra role/seller/admin behavior.

### 4.2 Kiến trúc Next.js nên có

- App shell.
- Auth store.
- API client layer.
- GraphQL client layer.
- UI test pages.
- Debug panel hiển thị token/header/response.

### 4.3 Các màn hình nên xây

#### Auth panel

- Login.
- Logout.
- Refresh token.
- Hiển thị actor hiện tại.
- Hiển thị roles/permissions/sellerProfile.

#### Catalog panel

- List products.
- Product detail.
- Filter theo category/tag/status.
- Search cơ bản.

#### Seller panel

- Create product.
- Update product.
- Upload media.
- Submit for review.
- Archive product.

#### Admin panel

- Approve product.
- Reject product.
- Xem các product pending review.

### 4.4 Luồng test chính qua Next.js

1. Login vào user-service.
2. Lấy access token.
3. Gọi gateway để đọc product.
4. Tạo/update product nếu có seller đủ quyền.
5. Upload media lên MinIO qua product-subgraph.
6. Kiểm tra cache/rate limit bằng các thao tác lặp.

### 4.5 Kết quả mong muốn

- Next.js là nơi bạn test được toàn bộ luồng từ auth đến catalog.
- Không phụ thuộc vào Playground/Postman mãi.
- Sau này có thể mở rộng thành admin dashboard thật.

---

## 5) Thứ tự thực thi đề xuất

### Giai đoạn A - ổn định nền tảng

1. Chốt lại auth contract ở user-service.
2. Chốt schema product final.
3. Quyết định gateway dùng federation line nào.
4. Tạo skeleton Next.js để gọi user-service và gateway.

### Giai đoạn B - hoàn thiện product

1. Thêm các field product còn thiếu.
2. Làm MinIO media flow.
3. Bổ sung cache Redis.
4. Bổ sung rate limit theo action.
5. Seed catalog mẫu.

### Giai đoạn C - federation và test end-to-end

1. Gateway compose product-subgraph.
2. Next.js gọi gateway thay vì gọi subgraph trực tiếp.
3. Viết test case public/auth/seller/admin.
4. Dọn lỗi runtime, log, timeout, header forwarding.

### Giai đoạn D - mở rộng marketplace

1. Làm cart-subgraph.
2. Làm order-subgraph.
3. Làm inventory/payment.
4. Bổ sung notification service.

---

## 6) Definition of Done cho từng mảng

### User service done khi

- Login/refresh/introspect ổn định.
- Token contract không đổi bất ngờ.
- Có rate limit và audit log cơ bản.
- Seed user demo chạy lại được.

### Product subgraph done khi

- Product schema đủ cho marketplace.
- Media MinIO chạy được.
- Cache và rate limit hoạt động.
- Public read và seller/admin mutation đều có test.

### Gateway done khi

- Chạy được như entrypoint duy nhất.
- Forward auth và request id đúng.
- Compose subgraph ổn định.

### Next.js done khi

- Login được.
- Gọi gateway được.
- Test được read/write flow.
- Có panel debug đủ cho dev.

---

## 7) Gợi ý ưu tiên thực tế ngay sau tài liệu này

1. Chốt schema product final.
2. Chốt flow media MinIO.
3. Định nghĩa cache keys và rate limit policy.
4. Nâng gateway thành entrypoint federation.
5. Tạo Next.js test console tối thiểu.

Nếu muốn đi nhanh, hãy làm theo đúng thứ tự này; đây là thứ tự ít rủi ro nhất và giúp bạn có demo sớm.
