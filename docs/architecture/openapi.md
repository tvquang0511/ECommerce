# OpenAPI strategy

## Goals
- Mỗi service tự host OpenAPI spec tại `GET /openapi.json` và Swagger UI tại `GET /api-docs`.
- Spec dễ mở rộng: mỗi module sở hữu `paths/schemas/tags` của riêng nó.
- Chuẩn hoá cross-service:
  - Error envelope thống nhất: `{ error: { code, message, details } }`
  - Security scheme thống nhất: `bearerAuth` (JWT access token — RS256; downstream services verify bằng public key)

## Pattern (module-owned)
Trong mỗi service:
- `src/openapi/buildOpenApiSpec.ts`
  - Build spec base (info/servers/common components)
  - Merge contributions từ modules
- Mỗi module export 1 hàm kiểu:
  - `authOpenApi(): { tags, schemas, paths }`
  - (Sau này có thể thêm `components.securitySchemes` theo module nếu cần)

Ví dụ: user-service
- `src/openapi/buildOpenApiSpec.ts`
- `src/modules/auth/auth.openapi.ts`

## Postman workflow
- Open `http://localhost:<port>/openapi.json`
- Postman → Import → Link/File → dán URL spec

### Tips để test auth bằng Postman (cookie + 2FA)
- Cookies được lưu theo domain. Hãy dùng thống nhất `localhost` (đừng lúc `127.0.0.1` lúc `localhost`) để tránh mất refresh cookie.
- Refresh token là **HttpOnly cookie**:
  - Postman vẫn nhận `Set-Cookie` và lưu cookie
  - Bạn xem cookie ở Postman → Cookies (góc phải) → `localhost`

**Gợi ý setup environment**
- `baseUrl = http://localhost:4001`
- `accessToken = <paste từ response>`

**Flow cơ bản (không 2FA)**
1) `POST {{baseUrl}}/api/users/auth/login`
  - Body JSON: `{ "email": "...", "password": "..." }`
  - Response: `{ accessToken, user }`
  - Đồng thời server set refresh cookie
2) `GET {{baseUrl}}/api/users/auth/me`
  - Header: `Authorization: Bearer {{accessToken}}`
3) `POST {{baseUrl}}/api/users/auth/refresh`
  - Không cần body (cookie tự gửi)
  - Response: `{ accessToken }` mới
  - Cookie refresh cũng sẽ bị rotate

**Multi-device sessions (quản lý thiết bị)**
- `GET {{baseUrl}}/api/users/auth/sessions`
  - Header: `Authorization: Bearer {{accessToken}}`
- `POST {{baseUrl}}/api/users/auth/sessions/:sessionId/revoke` (logout 1 thiết bị)
- `POST {{baseUrl}}/api/users/auth/logout-all` (logout tất cả thiết bị)

**Flow 2FA (email OTP)**
1) `POST {{baseUrl}}/api/users/auth/login`
  - Nếu user bật 2FA sẽ trả `{ twoFactorRequired: true, challengeId, expiresAt }`
  - Dev mode có thể có `devOtp` nếu SMTP chưa cấu hình
2) `POST {{baseUrl}}/api/users/auth/2fa/verify`
  - Body JSON: `{ "challengeId": "...", "code": "123456" }`
  - Response: `{ accessToken, user }` + set refresh cookie

**Refresh/Logout nếu bạn muốn test bằng token trong body (không dùng cookie)**
- Một số endpoint hỗ trợ body `{ refreshToken }` để tiện cho Postman.
- Tuy nhiên production flow khuyến nghị vẫn là cookie-based refresh.

## Versioning recommendation
Khi bắt đầu milestone tiếp theo, nên chuẩn hoá path dạng:
- `/api/users/v1/...`
hoặc
- `/api/v1/users/...`

MVP hiện tại đang dùng `/api/users/...` để đơn giản.
