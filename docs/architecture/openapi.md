# OpenAPI strategy

## Goals
- Mỗi service tự host OpenAPI spec tại `GET /openapi.json` và Swagger UI tại `GET /api-docs`.
- Spec dễ mở rộng: mỗi module sở hữu `paths/schemas/tags` của riêng nó.
- Chuẩn hoá cross-service:
  - Error envelope thống nhất: `{ error: { code, message, details } }`
  - Security scheme thống nhất: `bearerAuth` (JWT)

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

## Versioning recommendation
Khi bắt đầu milestone tiếp theo, nên chuẩn hoá path dạng:
- `/api/users/v1/...`
hoặc
- `/api/v1/users/...`

MVP hiện tại đang dùng `/api/users/...` để đơn giản.
