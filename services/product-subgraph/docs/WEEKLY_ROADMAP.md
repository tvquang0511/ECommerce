# Sequential Weekly Roadmap - One Service at a Time

**Goal**: làm theo kiểu tuần tự tuyệt đối. Chỉ hoàn thiện xong service hiện tại rồi mới chuyển sang service kế tiếp.

**Order of execution**

1. `user-service` - chốt auth contract và nâng cấp cần thiết.
2. `product-subgraph` - hoàn thiện catalog, MinIO media, cache, rate limit.
3. `graphql-gateway` - federation entrypoint, auth forwarding, schema composition.
4. `web` Next.js - app test end-to-end cho 3 service.

---

## Phase 1 - Finish user-service completely

**Mục tiêu**: giữ nguyên service này là nguồn sự thật auth, chỉ nâng cấp những gì cần để các service khác dùng ổn định lâu dài.

### Week 1 - Audit and contract stabilization

- Rà soát contract auth end-to-end: login, refresh, introspect, logout.
- Xác nhận claims chuẩn: `sub`, `email`, `roles`, `permissions`, `sellerProfile`.
- Kiểm tra format lỗi và response shape.
- Chốt rate limit cho login, refresh, OTP, forgot-password.
- Ghi rõ các endpoint nào sẽ là public contract chính thức.

**Deliverable**
- Auth contract ổn định.
- Không còn chỗ nào mơ hồ về token payload và introspect.

### Week 2 - Hardening and quality pass

- Rà refresh token rotation và revoke session.
- Bổ sung audit log cho login, refresh, logout, 2FA, reset password.
- Kiểm tra lại seller profile / role contract để các service khác resolve actor đúng.
- Nếu cần, lên kế hoạch JWKS endpoint cho chuẩn hóa verify key.
- Bổ sung test cho các case token hết hạn, token revoke, session invalid.

**Deliverable**
- `user-service` hoàn chỉnh ở mức auth platform.
- Có thể dùng làm nền cho product/gateway/web mà không phải sửa lại auth nữa.

---

## Phase 2 - Finish product-subgraph completely

**Mục tiêu**: catalog phải đủ sâu để có thể demo marketplace thật, gồm schema product, media MinIO, cache, rate limit, và workflow.

### Week 3 - Final product schema

- Chốt schema product final.
- Bổ sung các field còn thiếu: `sku`, `slug`, `brand`, `shortDescription`, `salePrice`, `currency`, `publishedAt`, `archivedAt`.
- Chuẩn hóa `attributes` key-value cho nhiều loại hàng hóa.
- Chốt status flow: `DRAFT`, `PENDING_REVIEW`, `APPROVED`, `REJECTED`, `ARCHIVED`.
- Seed dữ liệu catalog mẫu để test được ngay.

**Deliverable**
- Product model final.
- Catalog CRUD và visibility logic không còn thay đổi lớn.

### Week 4 - Media flow with MinIO

- Thiết kế metadata ảnh trong Mongo.
- Làm presigned upload URL.
- Làm confirm upload để gắn ảnh vào product.
- Quy ước cover image và gallery image.
- Lập cleanup khi xóa hoặc thay ảnh.

**Deliverable**
- Upload ảnh lên MinIO chạy được.
- Product có cover image và gallery metadata.

### Week 5 - Cache and rate limit

- Thiết kế Redis cache cho read queries.
- Tạo key pattern cho list/detail/featured/seller view.
- Thiết kế cache invalidation khi update/approve/archive/media change.
- Thêm rate limit theo nhóm action: public read, seller write, admin action, media upload.
- Kiểm tra seller ownership và verified seller behavior.

**Deliverable**
- Product subgraph đủ ổn định để dùng thật hơn.
- Có cache và rate limit rõ ràng theo hành vi.

---

## Phase 3 - Finish graphql-gateway completely

**Mục tiêu**: biến gateway thành entrypoint duy nhất, không còn gọi subgraph trực tiếp từ frontend.

### Week 6 - Federation setup and auth forwarding

- Compose schema từ product-subgraph.
- Forward `Authorization` và `x-request-id` chuẩn.
- Chuẩn hóa error handling và timeout cho subgraph.
- Bật introspection/dev mode chỉ trong môi trường local.
- Kiểm tra query/mutation đi qua gateway vẫn giữ quyền và context đúng.

**Deliverable**
- Gateway hoạt động như một lớp federation thật.
- Frontend có thể gọi qua một endpoint duy nhất.

---

## Phase 4 - Finish Next.js web app completely

**Mục tiêu**: web app là công cụ test thực tế cho cả 3 service, không chỉ là UI demo.

### Week 7 - Auth and catalog console

- Dựng app shell và layout.
- Làm login/logout/refresh UI.
- Hiển thị token và actor debug panel.
- Gọi gateway để list và xem product detail.
- Chốt env config và API client layer.

**Deliverable**
- Next.js đăng nhập được và đọc catalog qua gateway được.

### Week 8 - Seller/admin actions and end-to-end tests

- Làm màn hình create/update/submit/archive product.
- Làm màn hình approve/reject nếu có role admin.
- Thêm màn hình upload media test.
- Viết checklist test end-to-end cho login → gateway → product.
- Ghi lại cách test lỗi quyền truy cập và cache invalidation.

**Deliverable**
- Web app dùng được như test console thật.
- Có thể demo luồng auth + catalog + seller workflow từ đầu đến cuối.

---

## Strict dependency rule

Không làm song song 4 service. Chỉ chuyển sang service kế tiếp khi service hiện tại đạt đủ các điều kiện sau:

1. Có contract rõ ràng.
2. Có test chính cho luồng quan trọng.
3. Có thể chạy local ổn định.
4. Không còn thay đổi cấu trúc lớn ở bước tiếp theo.

---

## Checkpoints

### Checkpoint A - User-service done
- Login lấy token ổn định.
- Refresh và introspect hoạt động.
- Role/seller contract rõ.

### Checkpoint B - Product-subgraph done
- Catalog schema final.
- MinIO media chạy được.
- Cache và rate limit hoạt động.

### Checkpoint C - Gateway done
- Gateway compose schema ổn định.
- Auth forward đúng.
- Frontend chỉ cần một endpoint.

### Checkpoint D - Next.js done
- Login, catalog, seller actions, debug panel đều chạy.
- Có thể demo end-to-end không cần chạm trực tiếp vào service.
