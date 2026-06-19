# RBAC Và Các Luồng Nghiệp Vụ Marketplace

Tài liệu này mô tả cách thiết kế quyền truy cập và các luồng nghiệp vụ cơ bản cho đồ án marketplace.
Mục tiêu không phải là mô phỏng đầy đủ Shopee hay Amazon, mà là chọn một mô hình vừa đủ thực tế, vừa phù hợp với codebase hiện tại của repo.

Phân tích này được viết dựa trên:
- `user-service` hiện đang quản lý auth, role, permission, seller profile, introspect
- `product-subgraph` hiện đang xử lý product lifecycle và moderation
- `cart-subgraph` hiện đang xử lý guest cart và user cart

---

## 1. Kết luận nhanh

Thiết kế RBAC cũ của bạn có hướng đi đúng:
- tách `role` và `permission`
- có `sellerProfile.status`
- để `user-service` làm source of truth
- để từng subgraph tự kiểm tra business rule của nó

Nhưng để đúng với bài toán thực tế và code hiện tại, bạn nên chốt MVP như sau:

1. `BUYER` là role mặc định của mọi user đã đăng ký.
2. `SELLER` là role bổ sung cho user muốn bán hàng.
3. `ADMIN_MODERATOR`, `ADMIN_OPERATIONS`, `ADMIN_ANALYTICS`, `SUPER_ADMIN` là role nội bộ.
4. Permission chỉ cần đủ chi tiết để chặn hành vi.
5. Scope/ownership chưa cần tạo thành bảng riêng ở giai đoạn này; xử lý trong service bằng rule `own` và `all`.
6. Product lifecycle phải là trung tâm của nghiệp vụ marketplace MVP: `DRAFT -> PENDING_REVIEW -> APPROVED/REJECTED -> ARCHIVED`.
7. Cart không cần RBAC phức tạp; chủ yếu là phân biệt `guest`, `buyer đã đăng nhập`, và product có được bán hay không.

Nói ngắn gọn:
- `role` trả lời câu hỏi "ai"
- `permission` trả lời câu hỏi "được làm gì"
- `ownership/status` trả lời câu hỏi "được làm trên dữ liệu nào, trong tình trạng nào"

---

## 2. Đánh giá tài liệu cũ

Tài liệu cũ ổn ở tầm nhìn kiến trúc, nhưng chưa thực sự tối ưu cho đồ án hiện tại.

### Điểm ổn

- Đúng khi kết luận rằng `enum Role { BUYER, SELLER, ADMIN }` là chưa đủ về lâu dài.
- Đúng khi để `user-service` giữ role, permission, seller profile.
- Đúng khi nói `gateway` không nên quyết định nghiệp vụ.
- Đúng khi đưa seller status vào bài toán moderation.

### Điểm cần sửa

- Tài liệu cũ nghiêng về mô hình "marketplace lớn" hơn là "MVP học federation".
- Nhiều chỗ mở rộng quá sớm: affiliate, logistics, premium, warehouse, finance.
- Luồng đăng ký cũ không còn khớp với auth hiện tại.
  Hiện nay `register` không tự đăng nhập nữa; user phải verify email trước rồi mới login.
- Scope được nói đến nhiều, nhưng code hiện tại chủ yếu đang dùng `own` và `all` trong service layer.
- Phần cart chưa được đưa vào bài toán nghiệp vụ một cách rõ ràng.

Vì vậy, phiên bản viết lại nên đặt trọng tâm vào:
- auth + introspect
- seller onboarding
- product moderation
- cart và checkout boundary
- roadmap mở rộng sau

---

## 3. Hiện trạng codebase

### `user-service`

Đang có:
- đăng ký, verify email, login, refresh, logout
- 2FA cho login
- role, permission, seller profile, audit log
- endpoint `POST /api/users/auth/introspect`

RBAC seed hiện tại đã khá hợp lý cho MVP:
- `BUYER`
- `SELLER`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

Permissions đang có:
- product: `view_approved`, `search`, `view_detail`, `create`, `edit_own`, `delete_own_draft`, `submit_for_approval`, `upload_images`, `view_all`, `approve`
- seller: `verify`, `suspend`, `view_all`
- analytics: `view_all`, `view_own`
- cart: `manage`
- wishlist: `manage`

### `product-subgraph`

Đang có sẵn:
- xem danh sách product public
- seller tạo/sửa/xóa/archive product của mình
- submit product for review
- admin approve/reject
- guard cho `Auth`, `Role`, `VerifiedSeller`

Lifecycle hiện tại:
- `DRAFT`
- `PENDING_REVIEW`
- `APPROVED`
- `REJECTED`
- `ARCHIVED`

### `cart-subgraph`

Đang có sẵn:
- guest cart theo `sessionId`
- user cart theo `userId`
- merge guest cart vào user cart sau login
- chỉ cho thêm product `APPROVED`

Tuy nhiên, theo quyết định nghiệp vụ mới của bạn, hướng mong muốn là:
- guest chỉ được xem và tìm kiếm sản phẩm
- muốn thêm vào cart thì phải đăng ký/đăng nhập
- cart chỉ nên tồn tại cho user đã xác thực

---

## 4. Bài toán thực tế của web e-commerce nên được mô hình hóa thế nào

Nếu nhìn ở mức nghiệp vụ, marketplace MVP của bạn có 4 nhóm actor:

1. Guest
2. Buyer
3. Seller
4. Admin

Mỗi nhóm có một mục tiêu khác nhau:

### Guest

- xem sản phẩm được public
- tìm kiếm sản phẩm
- đăng ký tài khoản

### Buyer

- mua hàng
- quản lý cart, đơn hàng, tài khoản
- có thể trở thành seller

### Seller

- tạo và quản lý catalog của chính mình
- gửi sản phẩm cho admin duyệt
- theo dõi tình trạng shop và hiệu suất cơ bản

### Admin

- duyệt seller
- duyệt product
- xử lý seller vi phạm
- xem báo cáo vận hành hoặc analytics

Với đồ án này, "thực tế" không nằm ở số lượng role thật nhiều, mà nằm ở:
- seller không được tự do bán ngay
- product không được public ngay
- cart phải gắn với user đã đăng nhập
- quyền phải đi kèm với ownership và status

---

## 5. Mô hình RBAC đề xuất cho đồ án

### 5.1 Role

Giữ nguyên bộ role sau:

- `BUYER`
- `SELLER`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

Khuyến nghị:
- Mọi user mới tạo đều có `BUYER`
- `SELLER` là role bổ sung, không thay thế `BUYER`
- Admin role là role nội bộ, không public cho người dùng tự đăng ký

### 5.2 Permission

Giữ permission theo domain thay vì chỉ theo role.

Nhóm product:
- `product:view_approved`
- `product:search`
- `product:view_detail`
- `product:create`
- `product:edit_own`
- `product:delete_own_draft`
- `product:submit_for_approval`
- `product:upload_images`
- `product:view_all`
- `product:approve`

Nhóm seller:
- `seller:verify`
- `seller:suspend`
- `seller:view_all`

Nhóm analytics:
- `analytics:view_own`
- `analytics:view_all`

Nhóm cart:
- `cart:manage`

### 5.3 Ownership và scope

Chưa cần model thành bảng riêng.
Dùng rule trong service:

- `own`: user chỉ được thao tác trên dữ liệu của mình
- `all`: admin được thao tác toàn hệ thống

Ví dụ:
- seller sửa product của mình: `product:edit_own` + `actor.userId === product.sellerId`
- admin xem tất cả product: `product:view_all`

### 5.4 Status là một phần của authorization

Trong marketplace, role thôi là chưa đủ.
Bạn cần status để quyết định có được thao tác hay không.

Status quan trọng:

- `emailVerifiedAt` của user
- `sellerProfile.status`
- `sellerProfile.isKycVerified`
- `product.status`

Authorization thực tế nên đọc theo mẫu:

`có role/permission` + `đúng owner/scope` + `resource đang ở status hợp lệ`

---

## 6. Luồng nghiệp vụ đề xuất cho MVP

### 6.1 Đăng ký và trở thành buyer

```text
Guest đăng ký
  -> tạo User
  -> gán role BUYER
  -> gửi OTP verify email
  -> user verify email
  -> user login
  -> có access token + refresh token
```

Ý nghĩa nghiệp vụ:
- mọi người dùng phải là buyer trước
- email phải được xác minh trước khi đăng nhập

### 6.2 Apply trở thành seller

Đây là luồng bạn nên có tiếp theo, dù hiện tại chưa code xong:

```text
Buyer bấm "Become a seller"
  -> nhập shopName, shopDesc, thông tin cơ bản
  -> hệ thống tạo SellerProfile
  -> status = PENDING_VERIFICATION
  -> gán role SELLER
  -> seller có thể vào seller dashboard ở mức hạn chế
```

Tại sao gán `SELLER` sớm vẫn hợp lý:
- để user vào được seller area
- nhưng các hành vi quan trọng vẫn bị chặn bởi `VerifiedSellerGuard`

Nghĩa là:
- có `SELLER` chưa đủ
- phải `SELLER + VERIFIED + KYC` mới được tạo product

### 6.3 Tạo và quản lý product

```text
Seller verified tạo product
  -> status = DRAFT
  -> chỉ owner hoặc admin mới thấy và sửa
  -> seller upload media
  -> seller submit for review
  -> status = PENDING_REVIEW
```

Rule nghiệp vụ:
- seller chỉ được quản lý product của mình
- product `ARCHIVED` không được sửa
- product chưa `APPROVED` không được public

### 6.4 Duyệt product

```text
Admin moderator xem product đang chờ duyệt
  -> approve -> status = APPROVED
  -> reject -> status = REJECTED
```

Rule nghiệp vụ:
- chỉ admin mới được approve/reject
- buyer và guest chỉ thấy `APPROVED`
- seller thấy được product của mình, kể cả khi chưa approved

### 6.5 Tìm kiếm và xem product

```text
Guest/Buyer query products
  -> chỉ nhận APPROVED
Seller query products
  -> thấy APPROVED của public
  -> và thấy thêm product của mình
Admin query products
  -> thấy tất cả
```

Đây chính là bài toán "visibility policy", rất quan trọng với marketplace.

### 6.6 Cart chỉ dành cho user đã đăng nhập

```text
Guest xem và tìm kiếm sản phẩm
  -> muốn mua thì đăng ký/đăng nhập
Buyer thêm sản phẩm vào cart
  -> cart gắn với userId
Buyer tiếp tục mua hàng
```

Rule nghiệp vụ:
- guest không được thêm vào cart
- tất cả mutation của cart nên yêu cầu đăng nhập
- cart chỉ gắn với `userId`, không cần guest cart
- chỉ product `APPROVED` mới được thêm vào cart
- cart vẫn nên lưu `snapshot` giá, tên, ảnh để giảm phụ thuộc vào product hiện tại

Hướng này đơn giản hơn cho đồ án và cũng dễ giải thích khi demo:
"xem hàng thì ai cũng xem được, nhưng muốn mua thì phải có tài khoản".

---

## 7. Mapping quyền theo service

### `user-service`

Nên chịu trách nhiệm:
- auth
- role/permission
- seller profile
- introspect
- audit log auth và account-level action

Không nên chịu trách nhiệm:
- product moderation logic cụ thể
- cart logic

### `product-subgraph`

Nên chịu trách nhiệm:
- product lifecycle
- ownership của product
- visibility của product
- moderation rule

Nên kiểm tra:
- actor có được xác thực không
- actor có role/permission không
- actor có phải verified seller không
- actor có phải owner của product không
- status transition có hợp lệ không

### `cart-subgraph`

Nên chịu trách nhiệm:
- user cart
- xác thực product có thể mua được ở mức tối thiểu

Nên kiểm tra:
- user phải đăng nhập mới được thao tác cart
- nếu thêm vào cart thì product phải tồn tại và `APPROVED`
- cart được khóa theo `userId`

### `graphql-gateway`

Nên chỉ:
- compose schema
- forward header `Authorization`
- forward correlation header nếu cần

Không nên chứa business authorization.

---

## 8. Đề xuất policy cụ thể cho đồ án

### Account policy

- email chưa verify: không được login
- user bị khóa trong tương lai: không được thực hiện thao tác nhạy cảm

### Seller policy

- `SELLER` + `sellerProfile.status = VERIFIED` + `isKycVerified = true`
  -> mới được tạo product
- `PENDING_VERIFICATION`
  -> được vào seller dashboard, nhưng không được tạo product
- `SUSPENDED` hoặc `BANNED`
  -> không được quản lý catalog

### Product policy

- `DRAFT`: seller owner được sửa/xóa
- `PENDING_REVIEW`: seller được xem, admin được duyệt
- `APPROVED`: public
- `REJECTED`: seller được sửa rồi gửi lại
- `ARCHIVED`: không được sửa nữa

### Cart policy

- guest không được thêm vào cart
- buyer phải đăng nhập mới được dùng cart
- cart không nên phụ thuộc vào quyền seller hay admin

### Admin policy

- `ADMIN_MODERATOR`: duyệt product, duyệt seller, suspend seller
- `ADMIN_OPERATIONS`: xem dữ liệu vận hành, có thể xử lý seller support
- `ADMIN_ANALYTICS`: xem dashboard, report
- `SUPER_ADMIN`: full access

---

## 9. Đề xuất luồng buôn bán thực tế cho đồ án

Nếu bạn muốn web giống marketplace thật, luồng nên là:

### Luồng 1: Mua hàng

```text
Guest/Buyer xem product
  -> đăng nhập
  -> thêm vào cart
  -> checkout
  -> tạo order
  -> trừ tồn kho
  -> seller nhận order
```

Trong giai đoạn hiện tại, repo của bạn mới đến `product + cart`, nên tạm thời dừng ở:
- browse product
- add to cart
- chuẩn bị checkout boundary cho `order-subgraph`

### Luồng 2: Bán hàng

```text
Buyer -> apply seller
  -> admin verify seller
  -> seller tạo draft product
  -> submit review
  -> admin approve
  -> product lên sàn
  -> buyer mua
```

Đây là luồng bán hàng cốt lõi mà đồ án nên thể hiện rõ nhất.

### Luồng 3: Moderation

```text
Admin xem seller pending
  -> verify seller
Admin xem product pending
  -> approve/reject
Nếu seller vi phạm
  -> suspend seller
  -> ẩn product khỏi public listing
```

Đây là điểm giúp đồ án của bạn "ra chất marketplace", không chỉ là CRUD sản phẩm.

---

## 10. Lộ trình triển khai hợp lý

### Phase 1: Chốt auth contract

- giữ `user-service` làm source of truth
- chốt format `introspect`
- các subgraph dùng chung actor contract

### Phase 2: Hoàn thiện seller onboarding

- thêm API `apply seller`
- thêm API admin verify seller
- thêm trạng thái pending/verified/suspended

### Phase 3: Hoàn thiện product moderation

- thêm lý do reject
- thêm audit log cho approve/reject
- thêm query "my products" và "pending review"

### Phase 4: Nối tiếp cart -> order

- checkout từ cart
- tạo order snapshot
- validate lại giá/stock ở lúc checkout

---

## 11. Các quyết định thực dụng mình đề xuất cho đồ án này

Để tránh làm quá tay, bạn nên chủ động KHÔNG làm sớm:

- ABAC đầy đủ
- permission inheritance phức tạp
- organization/team trong seller account
- affiliate, logistics partner, warehouse role
- chính sách commission phức tạp
- dynamic policy engine

Thay vào đó, nên làm rất chắc 5 thứ:

1. Email verification và auth flow đúng.
2. Introspect contract đúng và ổn định.
3. Seller onboarding rõ ràng.
4. Product moderation có lifecycle thật.
5. Cart guest/user merge ổn định.
5. Cart chỉ mở cho user đã đăng nhập và hoạt động ổn định.

Nếu 5 thứ này chắc, đồ án đã rất ổn để học:
- GraphQL Federation
- service boundary
- RBAC thực tế
- asynchronous workflow sau này

---

## 12. Kết luận đề xuất

RBAC cũ của bạn không tệ; ngược lại, nó có nền khá dùng được.
Vấn đề là tài liệu cũ đang ở tầm "tham khảo hệ thống lớn", trong khi đồ án của bạn cần một phiên bản thực dụng hơn.

Đề xuất cuối cùng của mình là:

- giữ role/permission hiện tại trong `user-service`
- dùng `sellerProfile.status` làm business gate quan trọng
- để `product-subgraph` quản lý ownership + lifecycle + moderation
- để `cart-subgraph` tập trung vào guest/user cart và product snapshot
- xem `gateway` là lớp chuyển tiếp, không là lớp authorization

MVP marketplace của bạn nên được hiểu bằng câu sau:

`Buyer đăng ký -> verify email -> apply seller -> admin verify seller -> seller tạo product -> admin approve product -> buyer đăng nhập -> thêm vào cart -> checkout`

Đó là một bài toán đủ thực tế, đủ đẹp để trình bày, và vẫn nằm trong tầm tay của một đồ án học tập.
