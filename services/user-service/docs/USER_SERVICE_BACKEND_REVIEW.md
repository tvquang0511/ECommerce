# User Service Backend Review

## 1. Mục tiêu tài liệu

Tài liệu này dùng để review kỹ `user-service` dưới góc nhìn thiết kế backend, không chỉ để biết “API nào đang có”, mà để hiểu:

- Service này đang giải quyết bài toán gì
- Mỗi module được tách ra vì lý do gì
- Mỗi API đang được thiết kế theo tư duy nào
- Các cơ chế bảo mật, worker, rate limit, cache đang hoạt động ra sao
- Những điểm mạnh, trade-off, rủi ro và câu hỏi phỏng vấn có thể khai thác

Nếu nói ngắn gọn, `user-service` không chỉ là service CRUD user. Nó đang ôm khá nhiều trách nhiệm quan trọng:

- Quản lý danh tính người dùng
- Xác thực và phân quyền
- Quản lý session đa thiết bị
- Quản lý vòng đời mật khẩu
- Seller onboarding
- Một phần admin governance cho seller

## 2. Tổng quan kiến trúc

`user-service` được tổ chức theo hướng `modules-first`, mount route trong [app.ts](/D:/document/study/projects/ECommerce/services/user-service/src/app.ts).

Các router chính:

- `authRouter` mount tại `/api/users/auth`
- `usersRouter` mount tại `/api/users`
- `sellersRouter` mount tại `/api/users`
- `adminRouter` mount tại `/api/users/admin`

Stack chính:

- HTTP layer: Express
- Validation: Zod
- Database: PostgreSQL + Prisma
- Authentication: JWT access token RS256 + opaque refresh token
- Background job: BullMQ + Redis
- Object storage: MinIO cho avatar
- API documentation: OpenAPI JSON + Swagger UI

Luồng xử lý request tương đối chuẩn và sạch:

1. `router` định nghĩa endpoint và middleware
2. `controller` parse input bằng Zod, lấy dữ liệu từ `req`
3. `service` xử lý business logic
4. `repo` thao tác với Prisma/Postgres

Đây là một tổ chức code khá tốt để học và để review, vì:

- `controller` mỏng, dễ nhìn
- `service` là nơi chứa tư duy nghiệp vụ
- `repo` cô lập phần truy cập dữ liệu
- Khi phỏng vấn, bạn có thể giải thích rất rõ ranh giới trách nhiệm của từng lớp

## 3. Bức tranh nghiệp vụ tổng thể

Nhìn vào schema Prisma trong [schema.prisma](/D:/document/study/projects/ECommerce/services/user-service/prisma/schema.prisma), có thể thấy service này đang mô hình hóa nhiều lớp nghiệp vụ chồng lên nhau.

Các model quan trọng:

- `users`: dữ liệu user cốt lõi
- `auth_sessions`: session đăng nhập theo thiết bị/browser
- `refresh_tokens`: refresh token có thể rotate và revoke
- `email_otps`: OTP cho 2FA/email verification
- `password_reset_tokens`: token reset password
- `email_verification_tokens`: token verify email
- `seller_profiles`: profile seller và trạng thái seller
- `roles`, `permissions`, `user_roles`, `user_permissions`, `role_permissions`: RBAC
- `audit_logs`: log các sự kiện bảo mật và hành động quản trị

Điểm đáng chú ý là service này không đi theo kiểu “JWT là xong”. Nó dùng nhiều bảng để lưu state bảo mật. Điều đó cho thấy tư duy thiết kế đang nghiêng về:

- Chấp nhận stateful ở những chỗ cần kiểm soát an toàn
- Không đẩy toàn bộ trách nhiệm sang token stateless
- Ưu tiên khả năng revoke, audit, phát hiện abuse và quản lý đa thiết bị

Đây là một hướng khá thực tế cho hệ thống thương mại điện tử.

## 4. Phân tích module auth

`auth` là module quan trọng nhất của service. Đây cũng là module đáng ôn kỹ nhất nếu bạn muốn trả lời phỏng vấn tốt, vì nó chạm tới rất nhiều chủ đề: authentication, session, token rotation, OTP, password reset, audit, anti-abuse.

### 4.1 Thiết kế token và cơ chế xác thực

Trong [auth.service.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/auth/auth.service.ts) và [jwtKeys.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/auth/jwtKeys.ts):

- Access token được ký bằng RS256
- Private/public key lấy từ env, hoặc generate tạm trong dev
- Refresh token không dùng JWT mà dùng opaque token dạng `<tokenId>.<secret>`
- Database chỉ lưu `tokenId` và `tokenHash`, không lưu raw token
- Mỗi lần refresh thành công sẽ rotate refresh token
- Nếu phát hiện dấu hiệu token bị reuse hoặc giả mạo thì revoke toàn bộ session của user

Tư duy đằng sau thiết kế này:

- Access token cần nhẹ, nhanh, stateless để đi qua các service hoặc gateway
- Refresh token cần stateful để có thể revoke, rotate, audit, phát hiện compromise

Đây là một điểm thiết kế mạnh vì nó giải quyết được mâu thuẫn phổ biến:

- Muốn access token nhanh và ít hit DB
- Nhưng vẫn muốn có khả năng kiểm soát vòng đời đăng nhập

Nếu dùng JWT cho cả refresh token mà không lưu state, khả năng phát hiện reuse sẽ yếu hơn nhiều.

### 4.2 `POST /api/users/auth/register`

Luồng xử lý:

- Validate `email`, `password`, `displayName`
- Chuẩn hóa email về lowercase
- Kiểm tra email đã tồn tại chưa
- Hash password bằng bcrypt
- Tạo user
- Gán role `BUYER`
- Tạo email verification token
- Đẩy job gửi email xác thực

Response:

- `201 Created`
- Trả về `requiresEmailVerification`, `expiresAt`, `user`
- Trong môi trường dev, nếu SMTP chưa cấu hình thì có thể trả thêm `devVerificationUrl`

Ý nghĩa thiết kế:

- Hệ thống không auto-login sau đăng ký
- Email verification là bắt buộc trước khi login
- Đây là lựa chọn hợp lý cho domain e-commerce vì tài khoản thường gắn với email thật, đơn hàng, hoàn tiền, thông báo, support

Điểm mạnh:

- Giảm nguy cơ spam account hoạt động ngay
- Ép hệ thống có dữ liệu email đáng tin hơn

Trade-off:

- Friction cao hơn lúc onboarding
- Tăng phụ thuộc vào mail delivery

### 4.3 `GET /api/users/auth/verify-email?token=...`

Luồng xử lý:

- Có rate limit theo IP
- Nhận token từ query string
- Hash token rồi đối chiếu với DB
- Chỉ chấp nhận token chưa dùng và chưa hết hạn
- Mark token là đã dùng
- Set `emailVerifiedAt`
- Ghi audit log `EMAIL_VERIFIED`
- Trả về HTML thành công hoặc thất bại

Thiết kế này nói lên điều gì:

- Đây là endpoint hướng tới người dùng click từ email, nên trả HTML là hợp lý
- Controller bắt `ApiError` rồi render một HTML nhẹ, giúp UX tốt hơn thay vì trả JSON thô

Điểm mạnh:

- Dễ dùng cho end-user
- Không buộc frontend phải đứng giữa để hiện thông báo

Điểm cần nhớ khi đi phỏng vấn:

- Endpoint verify email thường không chỉ là “đổi cờ verified”, mà còn phải xử lý token one-time-use và hết hạn
- Audit log ở đây có giá trị vì email verification là một security event

### 4.4 `POST /api/users/auth/verify-email/resend`

Luồng xử lý:

- Rate limit theo IP
- Nếu user không tồn tại hoặc đã verify, vẫn trả `ok: true`
- Kiểm tra cooldown 30 giây dựa trên token verify gần nhất
- Invalidate token active cũ
- Tạo token mới
- Enqueue email mới

Tư duy thiết kế:

- Bảo vệ khỏi user enumeration
- Có cả middleware-level protection và business-level cooldown

Điểm hay:

- `ok: true` dù email không tồn tại là một kỹ thuật rất phổ biến để tránh lộ dữ liệu
- Cooldown 30 giây giúp ngăn spam resend dù attacker có cố bắn request đúng ngưỡng rate limit

### 4.5 `POST /api/users/auth/login`

Đây là endpoint thể hiện nhiều tư duy thiết kế nhất.

Luồng xử lý chung:

- Rate limit theo IP
- Rate limit thêm theo email
- Kiểm tra email/password
- Bắt buộc email đã verify

Sau đó tách làm 2 nhánh:

#### Nhánh 1: user chưa bật 2FA

- Tạo access token
- Cố gắng tái sử dụng session hiện có nếu request đang mang refresh token hợp lệ cũ
- Nếu không có session phù hợp thì tạo session mới
- Tạo refresh token mới
- Cập nhật `lastUsedAt`, `lastUsedIp`, `lastUsedUserAgent`

Điểm đáng chú ý:

- Service không mù mờ với khái niệm “thiết bị”
- Nó đang cố gắng map login vào session lifecycle thực sự

Ý nghĩa:

- Nếu user đang hoạt động trên cùng một thiết bị, service có thể rotate refresh token trong cùng session thay vì tạo session rác liên tục
- Đây là thiết kế khá trưởng thành so với kiểu login xong luôn phát token mới mà không quản session

#### Nhánh 2: user đã bật 2FA

- Tìm OTP còn active gần nhất
- Nếu mới tạo quá gần thì chặn bằng cooldown 30 giây
- Tạo OTP 6 chữ số
- Lưu OTP dưới dạng hash
- Tạo record `email_otps`
- Gửi OTP qua email
- Trả về `twoFactorRequired`, `challengeId`, `expiresAt`

Điểm mạnh:

- Luồng 2FA được tách thành challenge-based login
- Login chưa hoàn tất ngay ở bước nhập password
- Chỉ khi verify OTP thành công mới cấp token

Điểm cần hiểu sâu:

- `challengeId` ở đây chính là handle để đại diện cho tiến trình xác minh 2FA
- Service không giữ OTP trong memory mà lưu xuống DB, nghĩa là worker/process restart không làm mất trạng thái xác minh

### 4.6 `POST /api/users/auth/2fa/verify`

Luồng xử lý:

- Rate limit theo IP
- Rate limit theo `challengeId`
- Tìm OTP theo `challengeId`
- Kiểm tra đúng purpose, chưa consume, chưa hết hạn, chưa vượt số lần thử
- Nếu sai code thì tăng `attempts`
- Nếu đúng thì consume OTP
- Tạo session mới
- Tạo access token và refresh token

Điểm thiết kế đáng học:

- OTP không lưu plaintext
- Có giới hạn số lần nhập sai
- Session chỉ được tạo sau khi 2FA hoàn tất

Điều này cho thấy service phân biệt rất rõ:

- “Đúng password” chưa đủ để được xem là login thành công
- “Đúng password + đúng challenge thứ hai” mới hoàn tất xác thực

### 4.7 `GET /api/users/auth/2fa`

- Yêu cầu Bearer token
- Trả về trạng thái `enabled`

Đây là API đơn giản, chủ yếu để frontend biết có cần hiển thị trạng thái bảo mật hay không.

### 4.8 `POST /api/users/auth/2fa/enable`

Luồng xử lý:

- User phải đăng nhập
- Nhập lại password hiện tại
- Nếu đúng thì bật `twoFactorEnabled`
- Ghi audit log `TWO_FACTOR_ENABLED`

### 4.9 `POST /api/users/auth/2fa/disable`

Luồng xử lý tương tự:

- User phải đăng nhập
- Xác minh lại password
- Nếu đúng thì tắt `twoFactorEnabled`
- Ghi audit log `TWO_FACTOR_DISABLED`

Nhận xét thiết kế:

- Re-auth bằng password là hợp lý
- Nhưng chưa có bước xác minh OTP để bật/tắt 2FA

Đây là một điểm rất đáng đem ra phân tích:

- Nếu attacker đã chiếm được session và password, họ có thể tắt 2FA
- Hệ thống hiện tại ưu tiên đơn giản hơn là security mức cao nhất

Nếu muốn nâng cấp:

- Khi bật 2FA: yêu cầu gửi OTP và xác minh OTP trước khi bật
- Khi tắt 2FA: yêu cầu re-auth mạnh hơn, ví dụ password + OTP hiện tại

### 4.10 `POST /api/users/auth/refresh`

Đây là phần quan trọng nhất về mặt bảo mật.

Luồng xử lý:

- Nhận refresh token từ cookie HTTP-only, fallback sang body
- Rate limit theo IP
- Rate limit thêm theo `tokenId`
- Parse opaque token
- Tìm refresh token record trong DB
- Kiểm tra hết hạn chưa
- So khớp hash của secret
- Kiểm tra session còn active không
- Tạo access token mới
- Rotate refresh token trong transaction
- Update metadata `lastUsed*`

Các nhánh compromise detection:

- Nếu hash mismatch: coi như token bị giả mạo hoặc bị lộ
- Nếu token đã revoked mà vẫn bị dùng lại: coi như reuse
- Nếu update trong transaction không revoke được đúng 1 record: có thể là race/reuse

Trong các tình huống này, service:

- Ghi audit log `REFRESH_COMPROMISED`
- Revoke toàn bộ session của user
- Trả lỗi `AUTH_REFRESH_COMPROMISED`

Đây là điểm mạnh nhất của service.

Tại sao làm vậy?

- Refresh token đáng lẽ chỉ được dùng một lần trong mô hình rotation
- Nếu một refresh token cũ bị dùng lại, rất có khả năng nó đã bị lộ
- Khi đó phản ứng an toàn nhất là kill toàn bộ session, buộc user đăng nhập lại

Đây là tư duy “fail secure” ở lớp token lifecycle.

### 4.11 `POST /api/users/auth/logout`

Luồng xử lý:

- Lấy refresh token từ cookie hoặc body
- Nếu token hợp lệ thì revoke toàn bộ refresh token trong session đó
- Revoke luôn session
- Clear cookie
- Nếu token không hợp lệ thì vẫn trả `ok: true`

Ý nghĩa:

- Logout là thao tác idempotent
- Không cần biến logout thành nơi lộ ra trạng thái token

### 4.12 `POST /api/users/auth/logout-all`

- Yêu cầu đăng nhập
- Revoke toàn bộ refresh token và auth session của user

Đây là API phục vụ “đăng xuất tất cả thiết bị”, một feature khá thực tế.

### 4.13 `GET /api/users/auth/sessions`

- Trả về danh sách session của user
- Bao gồm `createdAt`, `lastUsedAt`, `revokedAt`, IP, userAgent

Điểm hay:

- Service coi session là first-class concept
- Không chỉ có token, mà còn có lifecycle theo thiết bị

### 4.14 `POST /api/users/auth/sessions/:sessionId/revoke`

- Chỉ cho phép user revoke session của chính mình
- Revoke session và tất cả refresh token của session đó

Ý nghĩa thiết kế:

- User có khả năng quản lý thiết bị bị mất, browser lạ, máy cũ

### 4.15 `GET /api/users/auth/me`

- Trả thông tin user hiện tại
- Bao gồm role, permission, seller profile

Đây là endpoint “self identity snapshot”, thường dùng cho frontend hydrate auth state.

### 4.16 `POST /api/users/auth/introspect`

Luồng xử lý:

- Yêu cầu Bearer token
- Middleware `authJwt` verify token trước
- Service decode token để lấy `exp`
- Trả về:
  - `userId`
  - `email`
  - `roles`
  - `permissions`
  - `sellerProfile` rút gọn
  - `exp`

Ý nghĩa thiết kế:

- Đây là endpoint phục vụ authorization giữa các service
- Một service khác có thể gọi sang `user-service` để biết actor hiện tại là ai và có quyền gì

Điểm cần lưu ý:

- Endpoint này có trong code nhưng chưa thấy trong OpenAPI
- Đây là dấu hiệu documentation drift

### 4.17 `POST /api/users/auth/forgot-password`

Luồng xử lý:

- Rate limit theo IP
- Rate limit thêm theo email
- Dù email có tồn tại hay không vẫn trả `ok: true`
- Nếu user tồn tại:
  - Invalidate các reset token active cũ
  - Tạo token reset mới
  - Build reset URL
  - Enqueue email reset

Điểm rất đáng học:

- Link reset dùng fragment `#token=...`

Tại sao đây là thiết kế tốt?

- Fragment không được gửi lên server trong HTTP request
- Giảm nguy cơ token lộ qua access log, reverse proxy log, referrer

### 4.18 `POST /api/users/auth/reset-password`

Luồng xử lý:

- Verify reset token còn hợp lệ
- Hash mật khẩu mới
- Update password
- Mark token là đã dùng
- Revoke toàn bộ session
- Enqueue email thông báo reset thành công
- Ghi audit log `PASSWORD_RESET_SUCCESS`

Điểm thiết kế:

- Reset password là security event lớn nên phải revoke toàn bộ session
- Không chỉ đổi password là xong

### 4.19 `POST /api/users/auth/change-password`

Luồng xử lý:

- User đang đăng nhập
- Nhập `currentPassword`
- Verify password cũ
- Hash mật khẩu mới
- Revoke toàn bộ session
- Gửi email thông báo
- Ghi audit log `PASSWORD_CHANGED`

Điểm đáng nói:

- Code có comment rất đúng: access token là JWT stateless nên không thể “thu hồi ngay lập tức” nếu không có cơ chế bổ sung

Đây là điểm bạn nên nhớ để trả lời phỏng vấn:

- Revoke refresh token thì dễ vì có state trong DB
- Revoke access token ngay lập tức thì khó hơn
- Muốn làm mạnh hơn cần:
  - access token TTL ngắn hơn
  - token version / session version
  - blacklist
  - hoặc introspection/state check ở downstream service

## 5. Phân tích module users

Module `users` phụ trách profile của người dùng hiện tại, không xử lý lifecycle đăng nhập.

### 5.1 `GET /api/users/me`

- Yêu cầu `authJwt`
- Gọi `usersService.me`
- Trả về public profile của current user

Response bao gồm:

- thông tin cơ bản của user
- `bio`, `dateOfBirth`, `phoneNumber`, `gender`
- `roles`, `permissions`
- `sellerProfile` nếu có

Điểm thiết kế:

- API này đóng vai trò “self profile read model”
- Nó đã aggregate cả user core data lẫn RBAC và seller profile

Nghĩa là frontend chỉ cần hit một endpoint là có khá đủ dữ liệu để render profile + trạng thái tài khoản.

### 5.2 `PATCH /api/users/me`

Luồng xử lý:

- Yêu cầu `authJwt`
- Validate body bằng Zod
- Cho phép update từng phần:
  - `displayName`
  - `bio`
  - `dateOfBirth`
  - `phoneNumber`
  - `gender`
- Service trim string, convert date, rồi update DB

Điểm tốt:

- Dùng `PATCH` là đúng semantic hơn `PUT`
- Validation tương đối chặt
- Có xử lý `null` để hỗ trợ clear field

Điểm cần lưu ý:

- `phoneNumber` là unique trong DB
- Ở tầng docs/OpenAPI đã nói có thể xảy ra `409`, nhưng actual error mapping còn phụ thuộc vào error handler chung

### 5.3 `POST /api/users/me/avatar`

Luồng xử lý:

- Yêu cầu `authJwt`
- Upload `multipart/form-data`, field `avatar`
- Dùng Multer `memoryStorage`
- Giới hạn 2MB
- Chỉ chấp nhận `jpeg/png/webp`
- Upload lên MinIO public bucket
- Update `avatarUrl`
- Cố gắng xóa avatar cũ theo kiểu best-effort

Phân tích thiết kế:

- `memoryStorage` hợp lý khi file nhỏ
- Việc validate mime type ở controller là bước bảo vệ đầu tiên
- Tên file object có `userId + timestamp + nonce` để giảm va chạm
- Xóa ảnh cũ không làm fail request chính, đây là cách xử lý pragmatic

Điểm cần chú ý:

- Route static `/api/users/files` vẫn còn trong app, nhưng flow avatar hiện tại đang dùng MinIO
- Điều này cho thấy có thể service từng dùng local file serving, sau đó chuyển sang object storage nhưng chưa dọn tài liệu hoặc code cũ hoàn toàn

## 6. Phân tích module sellers

Module `sellers` xử lý seller onboarding cho current user.

### 6.1 `POST /api/users/seller/apply`

Luồng xử lý:

- Yêu cầu `authJwt`
- Validate `shopName`, `shopDesc`
- User phải tồn tại
- User phải verify email trước
- User chưa có `sellerProfile`
- Tìm role `SELLER`
- Tạo `sellerProfile` với status mặc định `PENDING_VERIFICATION`
- Upsert role `SELLER` cho user
- Ghi audit log `SELLER_APPLIED`

Đây là nơi có một trade-off thiết kế rất quan trọng.

Hệ thống đang làm hai việc song song:

1. Tạo seller profile với trạng thái chờ duyệt
2. Gán role `SELLER` ngay lúc apply

Điều này tiện ở chỗ:

- Các service khác có thể biết user “đã thuộc seller domain”
- Không cần chờ admin duyệt mới gán role

Nhưng rủi ro là:

- Nếu downstream service chỉ check `role === SELLER` mà không check `sellerProfile.status`
- Thì user đang `PENDING_VERIFICATION` vẫn có thể được xem như seller đã hợp lệ

Đây là một điểm nên ghi nhớ rất kỹ khi review:

- Authorization trong domain seller không thể chỉ dựa vào role
- Nó phải là authorization theo role + state

Nói theo ngôn ngữ phỏng vấn:

- “`SELLER` là identity/affiliation, còn `sellerProfile.status` mới là business eligibility.”

### 6.2 `GET /api/users/seller/me`

- Yêu cầu `authJwt`
- Trả về `sellerProfile` của current user hoặc `null`

API này đơn giản nhưng hữu ích vì frontend hoặc service khác có thể biết:

- user đã apply seller chưa
- seller đang ở trạng thái gì

## 7. Phân tích module admin

Module `admin` hiện tại tập trung vào seller governance.

### 7.1 Cơ chế phân quyền admin

Trong [admin.service.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/admin/admin.service.ts), kiểm tra quyền admin không nằm ở middleware riêng mà nằm trong service qua `assertAdminActionAllowed`.

Mapping hiện tại:

- `SUPER_ADMIN`: toàn quyền
- `ADMIN_MODERATOR`:
  - list seller
  - approve seller
  - suspend seller
  - ban seller
- `ADMIN_OPERATIONS`:
  - list seller
  - suspend seller
  - ban seller
- `ADMIN_ANALYTICS`:
  - chỉ được list seller

Phân tích:

- Đây là role-based authorization hard-code trong code
- Trong khi schema lại đã có cả `permissions`

Điều này nói lên gì?

- Team đang dùng data model RBAC tương đối đầy đủ
- Nhưng implementation thực tế ở admin action vẫn đang theo kiểu đơn giản, trực tiếp, dễ đọc

Trade-off:

- Ưu điểm: nhanh, rõ, ít abstraction
- Nhược điểm: khó đồng bộ với permission data trong DB nếu hệ thống lớn lên

Nếu sau này quyền tăng nhiều:

- Cần chuyển dần sang permission-driven authorization
- Hoặc ít nhất tạo một authorization layer dùng chung

### 7.2 `GET /api/users/admin/sellers`

Luồng xử lý:

- Yêu cầu `authJwt`
- Parse optional query `status`
- Check actor có quyền `seller:list`
- Query danh sách seller profile kèm user và role

Ý nghĩa:

- Đây là API backoffice/read model cho admin
- Nó trả cả dữ liệu seller lẫn snapshot thông tin user để admin không phải gọi nhiều API

### 7.3 `POST /api/users/admin/sellers/:sellerProfileId/approve`

Luồng xử lý:

- Yêu cầu auth
- Check quyền `seller:approve`
- Tìm seller profile
- Chỉ cho approve nếu đang `PENDING_VERIFICATION`
- Update status thành `VERIFIED`
- Set `isKycVerified = true`
- Ghi audit log `SELLER_VERIFIED`

Điểm tốt:

- Có state guard rõ ràng
- Không cho approve seller ở trạng thái sai

### 7.4 `POST /api/users/admin/sellers/:sellerProfileId/suspend`

Luồng xử lý:

- Yêu cầu auth
- Check quyền `seller:suspend`
- Tìm seller
- Update status thành `SUSPENDED`
- Ghi audit `SELLER_SUSPENDED`

### 7.5 `POST /api/users/admin/sellers/:sellerProfileId/ban`

Luồng xử lý:

- Yêu cầu auth
- Check quyền `seller:ban`
- Tìm seller
- Update status thành `BANNED`
- Ghi audit `SELLER_BANNED`

Điểm cần để ý:

- `suspend` và `ban` hiện chưa check state transition chặt như `approve`
- Nghĩa là về mặt nghiệp vụ, có thể đang cho phép chuyển trạng thái khá thoáng

Ví dụ:

- ban một seller đã bị ban rồi
- suspend seller đang pending
- suspend seller đã banned

Điều này chưa chắc là sai, nhưng cần team thống nhất:

- Có muốn state machine chặt không?
- Hay chấp nhận status update đơn giản để admin thao tác nhanh?

## 8. Cơ chế worker của user-service

`user-service` có worker riêng cho mail, entry tại [main.ts](/D:/document/study/projects/ECommerce/services/user-service/src/workers/main.ts).

### 8.1 Kiến trúc tổng thể

Luồng mail async hiện tại là:

1. API xử lý request business
2. Nếu cần gửi mail thì gọi `mailQueue.enqueue(...)`
3. BullMQ ghi job vào Redis
4. Mail worker đọc job từ queue `mail`
5. Worker build nội dung email
6. Worker gửi mail qua SMTP

Files liên quan:

- Queue producer: [mail.queue.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/mail/mail.queue.ts)
- Job types: [mail.types.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/mail/mail.types.ts)
- Worker consumer: [worker.ts](/D:/document/study/projects/ECommerce/services/user-service/src/workers/worker.ts)

### 8.2 Các loại mail job hiện có

- `email-verification`
- `forgot-password`
- `password-reset-success`
- `otp`

Điều này cho thấy queue hiện tại đang phục vụ nhóm tác vụ transactional email, chưa phải notification system tổng quát.

### 8.3 Tại sao phải tách mail sang worker?

Nếu gửi mail ngay trong request:

- request chậm hơn
- phụ thuộc trực tiếp vào SMTP
- nếu SMTP chập chờn thì UX login/register/reset password bị tệ

Khi tách sang queue:

- API response nhanh hơn
- retry được
- tách lỗi mail khỏi luồng request chính
- dễ scale consumer độc lập với API server

Đây là một quyết định thiết kế rất hợp lý cho các tác vụ:

- chậm
- I/O bound
- có thể retry
- không bắt buộc phải hoàn thành đồng bộ với response

### 8.4 Queue config

Queue `mail` đang được cấu hình:

- `attempts: 5`
- `backoff: exponential, delay 2000`
- `removeOnComplete: 200`
- `removeOnFail: 500`

Ý nghĩa:

- Job fail sẽ được retry
- Retry có backoff tăng dần để tránh spam SMTP hoặc đập liên tục vào dịch vụ lỗi
- Queue không giữ lịch sử vô hạn
- Vẫn giữ lại một lượng job đủ để debug

### 8.5 Worker behavior

Worker:

- Tạo SMTP transport một lần lúc khởi động
- Nếu SMTP chưa cấu hình thì warning
- Có log khi `ready`, `completed`, `failed`
- Có graceful shutdown với `SIGINT`, `SIGTERM`
- Có bắt `unhandledRejection`, `uncaughtException`

Đây là dấu hiệu service đã nghĩ tới vận hành chứ không chỉ nghĩ tới code chạy local.

### 8.6 Cách service ứng xử khi SMTP chưa cấu hình

Trong [mail.queue.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/mail/mail.queue.ts):

- Nếu SMTP chưa cấu hình thì `enqueue()` trả `enqueued: false`

Business layer sau đó xử lý theo ngữ cảnh:

- Ở dev: có thể trả `devVerificationUrl` hoặc `devOtp`
- Ở production: một số flow sẽ trả `503`, một số flow giữ `ok: true` để tránh lộ thông tin

Đây là một quyết định thực dụng:

- Dev experience tốt
- Không bắt local setup phải có SMTP thật

Nhưng cũng tạo ra khác biệt hành vi giữa dev và prod, nên team phải hiểu rõ.

## 9. Cơ chế rate limit

Rate limit nằm ở [rateLimit.ts](/D:/document/study/projects/ECommerce/services/user-service/src/common/middlewares/rateLimit.ts).

### 9.1 Cách hoạt động

Middleware nhận một `rule` gồm:

- `name`
- `limit`
- `windowSeconds`
- `identifiers(req)`

Cho mỗi identifier, nó tạo Redis key dạng:

- `rl:<rule>:<identifier>:<window>`

Sau đó dùng Lua script:

- `INCR`
- nếu là request đầu tiên trong cửa sổ thời gian đó thì `EXPIRE`

Nếu vượt ngưỡng:

- throw `429 RATE_LIMITED`

### 9.2 Đây là fixed window, không phải sliding window

Implementation đang tính:

- `Math.floor(Date.now() / (windowSeconds * 1000))`

Nghĩa là request được đếm theo từng cửa sổ thời gian rời rạc.

Ưu điểm:

- Rất đơn giản
- Nhanh
- Dễ debug
- Dễ mở rộng

Nhược điểm:

- Có edge case burst ở ranh giới hai window liên tiếp

Ví dụ:

- User có thể bắn gần hết quota ở cuối window A
- rồi bắn tiếp gần hết quota ở đầu window B
- tổng thể tạo ra burst lớn hơn kỳ vọng

Đây là trade-off phổ biến. Với auth flow thông thường, fixed window thường đủ tốt nếu ngưỡng hợp lý.

### 9.3 Fail-open khi Redis gặp sự cố

Nếu Redis không khả dụng:

- Middleware nhận diện lỗi connection
- Log warning một lần
- Cho request đi tiếp

Tư duy thiết kế:

- Ưu tiên availability
- Không muốn Redis outage làm login, refresh, verify bị sập hoàn toàn

Trade-off:

- Khi Redis down, rate limit mất tác dụng

Đây là điểm rất nên phân tích trong phỏng vấn:

- Với e-commerce bình thường, fail-open có thể chấp nhận
- Với hệ thống ngân hàng hoặc admin cực nhạy cảm, có thể phải fail-closed ở một số route

### 9.4 Các endpoint đang được rate limit

Trong `auth.router.ts`:

- `GET /verify-email`: 20 req / 60s / IP
- `POST /verify-email/resend`: 10 req / 1h / IP
- `POST /login`: 10 req / 60s / IP và 5 req / 60s / email
- `POST /2fa/verify`: 20 req / 60s / IP và 10 req / 5m / challengeId
- `POST /refresh`: 120 req / 60s / IP và 60 req / 60s / tokenId
- `POST /forgot-password`: 10 req / 1h / IP và 3 req / 1h / email

Ngoài middleware, service còn có cooldown nghiệp vụ:

- resend verify email: 30 giây
- login có 2FA: OTP mới phải cách OTP trước ít nhất 30 giây

Điều này rất hay vì:

- Middleware chống abuse ở tầng hạ tầng
- Business cooldown chống abuse ở tầng nghiệp vụ

Đó là layered defense đúng nghĩa.

## 10. Cache và các hình thức lưu tạm

Service này không có cache dữ liệu kiểu “cache profile user trong Redis” theo nghĩa truyền thống. Tuy nhiên vẫn có một số lớp cache hoặc reuse state đáng lưu ý.

### 10.1 Redis client singleton

Trong [redis.ts](/D:/document/study/projects/ECommerce/services/user-service/src/db/redis.ts):

- Redis client được tạo theo singleton
- Ở non-production còn gắn lên `globalThis` để tránh tạo lại khi hot reload

Đây không phải cache business data, nhưng là connection reuse để tiết kiệm tài nguyên.

### 10.2 Cache in-memory cho JWT keys

Trong [jwtKeys.ts](/D:/document/study/projects/ECommerce/services/user-service/src/modules/auth/jwtKeys.ts):

- Sau khi resolve được RSA keys, service cache trong biến `cached`
- Nếu dev không cung cấp key thì generate keypair tạm và giữ trong memory

Ý nghĩa:

- Tránh parse/generate nhiều lần
- Hợp lý về hiệu năng

Trade-off:

- Với dev ephemeral key, restart service sẽ làm access token cũ mất hiệu lực

### 10.3 Cache-Control cho avatar và static file

Có hai chỗ:

- Object trên MinIO được set `Cache-Control: public, max-age=86400`
- Route static `/api/users/files` được set `Cache-Control: public, max-age=3600`

Điều này cho thấy:

- Service có tư duy tối ưu browser/CDN caching cho file public
- Nhưng đồng thời cũng lộ ra sự chuyển tiếp kiến trúc giữa local static serving và object storage

### 10.4 DB state như “nguồn sự thật” thay vì cache

Những thực thể sau không phải cache mà là state bảo mật bắt buộc phải lưu:

- refresh token
- auth session
- OTP
- email verification token
- password reset token

Đây là một điểm quan trọng về tư duy hệ thống:

- Không phải cái gì cũng nên stateless
- Với security-sensitive flow, DB state giúp revoke, audit và kiểm soát lifecycle tốt hơn

## 11. OpenAPI và tài liệu API

OpenAPI được build trong [buildOpenApiSpec.ts](/D:/document/study/projects/ECommerce/services/user-service/src/openapi/buildOpenApiSpec.ts), merge từ:

- `authOpenApi()`
- `usersOpenApi()`
- `sellersOpenApi()`
- `adminOpenApi()`

Expose:

- `GET /openapi.json`
- `GET /api-docs`

Nhận xét:

- Việc để mỗi module tự khai báo OpenAPI rồi merge lại là một hướng khá tốt để docs bám theo module
- Dễ review theo domain
- Dễ phát hiện endpoint nào docs thiếu

Điểm lệch hiện thấy:

- `POST /api/users/auth/introspect` có trong code nhưng chưa thấy trong OpenAPI
- README còn mô tả static avatar theo local path, trong khi code upload avatar hiện dùng MinIO

Đây là hai dấu hiệu documentation drift khá điển hình.

## 12. Điểm mạnh kỹ thuật của user-service

- Auth flow tương đối đầy đủ: verify email, 2FA, refresh rotation, session revoke
- Refresh token compromise detection làm khá chắc tay
- Session được mô hình hóa như một thực thể nghiệp vụ thật, không chỉ là token phát ra rồi quên
- Audit log được dùng ở nhiều security event và admin event
- Rate limit có nhiều lớp theo IP, email, challengeId, tokenId
- Mail worker được tách riêng, có retry và graceful shutdown
- Cấu trúc controller/service/repo rõ ràng, dễ đọc và dễ mở rộng

## 13. Rủi ro, trade-off và các điểm cần review kỹ

### 13.1 Role `SELLER` được gán quá sớm

Đây là rủi ro lớn nhất về mặt domain logic.

Vấn đề:

- User vừa apply đã có role `SELLER`
- Nhưng seller vẫn đang `PENDING_VERIFICATION`

Nếu hệ thống khác chỉ check role:

- có thể cho user làm hành vi seller khi chưa được duyệt

Kết luận khi review:

- Role không đủ
- Phải check thêm `sellerProfile.status`

### 13.2 Admin authorization đang hard-code

Schema đã có `permissions`, nhưng code admin vẫn tự map role -> action.

Điều này không sai, nhưng sẽ khó scale khi:

- số lượng action tăng
- nhiều team cùng sửa quyền
- cần audit quyền theo data thay vì theo code

### 13.3 Revoke access token chưa thật sự tức thời

Đây không hẳn là bug, mà là giới hạn tự nhiên của JWT stateless.

Bạn nên hiểu rõ:

- revoke refresh token thì được
- revoke session thì được
- nhưng access token đã cấp ra rồi vẫn còn sống đến hết TTL nếu downstream chỉ verify chữ ký

### 13.4 Rate limit fail-open là một lựa chọn vận hành, không phải lựa chọn bảo mật mạnh nhất

Nếu Redis chết:

- service vẫn chạy
- nhưng lớp chống abuse yếu đi

Đây là quyết định cân bằng giữa:

- availability
- security

### 13.5 State transition của seller chưa đồng đều

- `approve` có guard rõ
- `suspend` và `ban` khá thoáng

Điều này có thể ổn trong MVP, nhưng khi lớn lên nên chuẩn hóa state machine.

### 13.6 Docs chưa khớp 100% với implementation

Hai chỗ nổi bật:

- `introspect` thiếu trong OpenAPI
- avatar flow đang dùng MinIO nhưng README vẫn nói static local

## 14. Những câu hỏi phỏng vấn bạn có thể dùng ngay

### Về auth

- Tại sao access token dùng JWT RS256 còn refresh token lại dùng opaque token?
- Tại sao phải rotate refresh token thay vì cho dùng lặp lại?
- Tại sao khi phát hiện reuse refresh token cũ lại revoke toàn bộ session?
- Tại sao hệ thống vẫn cần `auth_sessions` khi đã có token?

### Về seller/admin

- Vì sao gán role `SELLER` ngay khi apply có thể nguy hiểm?
- Khi nào nên check role, khi nào phải check thêm business status?
- Tại sao admin permission hard-code có thể là nợ kỹ thuật?

### Về worker

- Khi nào nên tách email sang queue?
- BullMQ retry + exponential backoff giải quyết vấn đề gì?
- Vì sao local dev nên cho phép chạy mà không cần SMTP thật?

### Về rate limit

- Vì sao dùng fixed window thay vì sliding window?
- Vì sao rate limit vừa theo IP vừa theo email/challenge/tokenId?
- Khi nào fail-open hợp lý, khi nào fail-closed hợp lý hơn?

## 15. Tóm tắt ngắn để nhớ

Nếu cần mô tả thật ngắn trong phỏng vấn:

- `user-service` là service quản lý identity, authentication, session, seller onboarding và một phần admin governance cho seller.
- Điểm mạnh nhất của nó nằm ở auth design: access token RS256, refresh token opaque có rotation, multi-device session, audit log và compromise detection.
- Redis được dùng cho rate limit và mail queue, không phải cache dữ liệu người dùng theo nghĩa truyền thống.
- Cache hiện có chủ yếu là cache key trong memory và cache header cho file public.
- Điểm cần review kỹ nhất là authorization của seller phải dựa trên cả role lẫn trạng thái nghiệp vụ, không thể chỉ check role `SELLER`.
