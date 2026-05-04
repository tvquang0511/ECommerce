# Auth architecture (user-service)

Tài liệu này mô tả thiết kế auth hiện tại của `user-service` sau khi:
- Chuyển **access token** từ HMAC (HS256/shared secret) sang **RSA (RS256)**.
- Chuyển **refresh token** sang **opaque random token** (không phải JWT) + lưu **hash trong DB**.
- Thêm **2FA (email OTP)** với TTL 2 phút.
- Tách việc gửi email sang **BullMQ worker** (mức B: 1 process khác, vẫn thuộc user-service).
- Nâng cấp **refresh token** từ single-device sang **multi-device sessions**.

Chuẩn kiến trúc tổng thể và cách RBAC gắn vào marketplace nằm ở:
- [architecture-standard.md](architecture-standard.md)
- [rbac-marketplace-access-control.md](rbac-marketplace-access-control.md)

---

## 1) Token model

### 1.1 Access token (JWT, RS256)
- **Dạng**: JWT
- **Algorithm**: `RS256`
- **TTL**: `JWT_ACCESS_TTL` (mặc định `15m`)
- **Ký (sign)**: chỉ `user-service` giữ **private key** để sign.
- **Xác thực (verify)**: các service khác chỉ cần **public key** để verify.

**Mục tiêu**: loại bỏ yêu cầu “mọi service phải share cùng secret key”, giảm blast radius nếu bị lộ.

So sánh nhanh HMAC vs RSA:
- HMAC (HS256): sign/verify đều dùng **cùng 1 secret** → service nào verify được thì cũng sign được (nếu lộ secret thì blast radius lớn).
- RSA (RS256): sign dùng **private key** (chỉ user-service giữ), verify dùng **public key** (có thể phân phối cho nhiều service) → giảm rủi ro lộ key ở downstream.

**Key distribution**
- Dev/simple: copy public key vào env của các service cần verify.

### (Future) JWKS + key rotation
Ghi chú để làm sau (vì tương đối phức tạp):
- Mục tiêu: service khác **không cần** copy public key thủ công qua env; thay vào đó fetch từ `/.well-known/jwks.json` và cache.
- Rotation đúng nghĩa là: theo thời gian sẽ có **nhiều public keys hợp lệ** (key cũ để verify token chưa hết hạn + key mới để sign token mới).
- Cần thêm các khái niệm:
  - `kid` trong JWT header
  - JWKS endpoint trả danh sách public keys
  - Cache/refresh policy ở downstream services
- Lợi ích: rotate key không downtime, giảm effort redeploy đồng loạt, và phản ứng nhanh hơn nếu nghi ngờ private key bị lộ.

### 1.2 Refresh token (opaque) + multi-device sessions
Refresh token **không phải JWT**.

- **Format**: `<tokenId>.<secret>`
  - `tokenId`: random, dùng để lookup nhanh
  - `secret`: random, không lưu plaintext

**Persistence model (multi-device)**
- Bảng `auth_sessions`: đại diện 1 “thiết bị / trình duyệt” (1 session)
  - `id` (session id)
  - `userId`
  - `revokedAt`, `createdAt`, `lastUsedAt`
  - `createdByIp/userAgent`, `lastUsedIp/userAgent` (audit)
- Bảng `refresh_tokens`: mỗi session có thể có nhiều refresh token theo thời gian (rotation chain)
  - `sessionId` (FK)
  - `tokenId` (unique)
  - `tokenHash = sha256(secret + "." + REFRESH_TOKEN_PEPPER)`
  - `revokedAt`, `expiresAt`, `replacedByTokenId`, `lastUsedAt`

**Multi-device**
- Một user có thể có nhiều `auth_sessions` đang active (nhiều thiết bị).
- Mỗi thiết bị có refresh cookie riêng.
- Refresh rotation chỉ ảnh hưởng **session hiện tại**, không logout các thiết bị khác.

**Rotation**
- Mỗi lần gọi `POST /api/users/auth/refresh` thành công:
  1) Token cũ bị revoke
  2) Tạo token mới
  3) Set cookie refresh token = token mới

**Reuse detection (token bị lộ)**
- Nếu refresh token đã bị revoke mà vẫn được dùng lại (reuse) hoặc secret mismatch:
  - Để an toàn, revoke toàn bộ sessions + refresh tokens active của user ngay lập tức
  - Trả lỗi `AUTH_REFRESH_COMPROMISED`
  - Client phải ép user login lại

So sánh nhanh single-device vs multi-device:
- Single-device: mỗi user chỉ có 1 refresh token/session active → đơn giản, an toàn hơn mặc định, nhưng UX kém (login thiết bị mới sẽ đá thiết bị cũ).
- Multi-device: mỗi thiết bị có 1 session riêng → UX tốt (quản lý thiết bị), nhưng cần thêm endpoints để list/revoke sessions và policy xử lý compromise rõ ràng.

---

## 2) 2FA (Email OTP)

### 2.1 User flag
- `users.twoFactorEnabled`: nếu `true` thì login yêu cầu OTP.

2FA management endpoints (đã có):
- `GET /api/users/auth/2fa`
- `POST /api/users/auth/2fa/enable`
- `POST /api/users/auth/2fa/disable`

### 2.2 OTP persistence
- Bảng `email_otps`
  - `purpose = LOGIN_2FA`
  - `codeHash = sha256(code + "." + REFRESH_TOKEN_PEPPER)`
  - `expiresAt` (TTL mặc định 2 phút, `TWO_FACTOR_OTP_TTL_SECONDS=120`)
  - `attempts` (max 5)
  - `consumedAt`

### 2.3 Flow
- `POST /api/users/auth/login`
  - Nếu user `twoFactorEnabled = false`: trả `accessToken` + set refresh cookie như bình thường
  - Nếu `true`: tạo OTP challenge + enqueue email OTP, trả:
    - `twoFactorRequired: true`
    - `challengeId`
    - `expiresAt`

- `POST /api/users/auth/2fa/verify`
  - Input: `{ challengeId, code }`
  - Nếu OTP đúng + chưa hết hạn + chưa consumed + chưa vượt attempts:
    - consume OTP
    - phát `accessToken` + refresh cookie

---

## 3) Email sending (SMTP via BullMQ)

### 3.1 Vì sao cần worker
- Gửi SMTP có thể chậm/timeout.
- Worker giúp:
  - API trả response nhanh
  - retry/backoff rõ ràng
  - tách failure domain (mail fail không làm hỏng auth logic)

### 3.2 Kiến trúc
- API process (`user-service`) chỉ **enqueue job** vào BullMQ queue `mail`.
- Worker process (`user-service worker:mail`) consume queue và gửi mail bằng Nodemailer.

Mapping code (để dễ maintain):
- API-side (enqueue): `src/modules/mail/mail.queue.ts`
- Worker-side (consume): `src/workers/worker.ts` + entry `src/workers/main.ts`
- Worker templates: `src/workers/mail/templates/*`

### 3.3 Mail templates
3 mẫu mail:
1) `forgot-password`: gửi link reset password
2) `password-reset-success`: thông báo password đã đổi
3) `otp`: gửi mã OTP

---

## 4) Endpoints summary

- `POST /api/users/auth/register` → issue tokens
- `POST /api/users/auth/login` → issue tokens **hoặc** trả challenge nếu 2FA
- `POST /api/users/auth/2fa/verify` → issue tokens (sau OTP)
- `GET /api/users/auth/me` (Bearer access token)
- `POST /api/users/auth/refresh` (refresh cookie; rotate; detect reuse)
- `POST /api/users/auth/logout` (revoke refresh cookie)
- `POST /api/users/auth/logout-all` (revoke all sessions)
- `GET /api/users/auth/sessions` (list sessions)
- `POST /api/users/auth/sessions/:sessionId/revoke` (revoke 1 session)
- `POST /api/users/auth/forgot-password` (enqueue mail)
- `POST /api/users/auth/reset-password` (revoke refresh tokens; enqueue mail)

---

## 5) RBAC cho marketplace

Auth chỉ lo xác thực danh tính và phát token. Còn quyền nghiệp vụ cho marketplace nên được mô tả tách riêng trong tài liệu RBAC:

- [RBAC for Marketplace Access Control](rbac-marketplace-access-control.md)

Tóm tắt nhanh:
- `BUYER` là role mặc định khi đăng ký.
- `SELLER` cần đi qua luồng apply + verification.
- `ADMIN_*` nên được chia thành role theo chức năng, không nên gom thành một admin duy nhất nếu muốn mở rộng sau này.
- Quyền thật nên kiểm tra bằng permission + scope, không chỉ dựa vào enum role.
- `GET /api/users/auth/me` và `GET /api/users/me` hiện trả thêm RBAC context: `roles`, `permissions`, `sellerProfile`.

---

## 6) Environment variables

### JWT (RS256)
- `JWT_ACCESS_PRIVATE_KEY_PEM_B64` / `JWT_ACCESS_PUBLIC_KEY_PEM_B64` (recommended)
- or `JWT_ACCESS_PRIVATE_KEY_PEM` / `JWT_ACCESS_PUBLIC_KEY_PEM` (with literal `\\n`)

### Refresh tokens
- `REFRESH_TOKEN_PEPPER`
- `JWT_REFRESH_TTL`

### 2FA
- `TWO_FACTOR_OTP_TTL_SECONDS` (default 120)

### Redis (BullMQ)
- `REDIS_URL`

### SMTP
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`
- `SMTP_USER`, `SMTP_PASS` (optional depending on provider)
- `SMTP_FROM`

---

## 7) Dev notes

- Nếu không set RSA keys và `NODE_ENV!=production`, `user-service` sẽ tự generate keypair ephemeral để dev chạy nhanh.
- Nếu SMTP chưa cấu hình, flow 2FA có thể trả dev helper (ví dụ `devOtp`) để test bằng Postman.

### 7.1 Hardening (giai đoạn 1)
Phạm vi: làm những thứ “đủ dùng” để giảm brute force + có trace sự kiện bảo mật, chưa làm metrics/worker health nâng cao.

#### 6.3.1 Rate limit theo route (Redis)
Mục tiêu: chặn brute force/spam ở các route nhạy cảm, và giảm “enumeration” theo email.

Đã áp dụng rate limit (Redis-backed) cho 4 route:
- `POST /api/users/auth/login`
- `POST /api/users/auth/2fa/verify`
- `POST /api/users/auth/forgot-password`
- `POST /api/users/auth/refresh`

Rule hiện tại (hard-code trong router, có thể đưa ra env sau):
- Login
  - theo IP: `10 / 60s`
  - theo email: `5 / 60s`
- 2FA verify
  - theo IP: `20 / 60s`
  - theo challengeId: `10 / 5m`
- Forgot password
  - theo IP: `10 / 1h`
  - theo email: `3 / 1h`
- Refresh
  - theo IP: `120 / 60s`
  - theo tokenId: `60 / 60s`

Response khi bị limit:
- HTTP `429`
- error envelope: `{ error: { code: "RATE_LIMITED", message: "Too many requests" } }`

Ghi chú triển khai:
- Nếu Redis tạm down/unreachable, limiter **fail-open** (không chặn request) nhưng sẽ log warning 1 lần để tránh spam log.

#### 6.3.2 Generic responses (anti-enumeration)
Mục tiêu: giảm khả năng “đoán email tồn tại hay không” hoặc leak trạng thái OTP.

Đã sửa:
- `POST /forgot-password` luôn trả `{ ok: true }` dù email có tồn tại hay không.
- `POST /2fa/verify`:
  - OTP hết hạn / sai / đã dùng / challengeId không tồn tại đều trả chung lỗi `AUTH_OTP_INVALID` với message `OTP invalid or expired`.

Lưu ý: trong dev, flow 2FA có thể trả `devOtp` khi SMTP chưa cấu hình (chỉ để test). `forgot-password` đã bỏ dev helper (`devResetToken`, `resetUrl`) để giảm leak.

#### 6.3.3 Audit logs (DB)
Mục tiêu: có lịch sử sự kiện bảo mật quan trọng để debug và điều tra.

Persistence:
- Bảng `audit_logs` (Postgres)
- Field chính: `eventType`, `actorUserId`, `targetUserId`, `sessionId`, `ip`, `userAgent`, `metadata`, `createdAt`

Sự kiện đang ghi:
- `TWO_FACTOR_ENABLED`
- `TWO_FACTOR_DISABLED`
- `REFRESH_COMPROMISED` (khi hash mismatch, reuse token revoked, hoặc race/reuse trong rotation)
- `PASSWORD_RESET_SUCCESS`

Policy quan trọng:
- Không log plaintext OTP/reset/refresh token.
- `REFRESH_COMPROMISED` sẽ revoke **tất cả sessions** của user ngay lập tức (ép login lại mọi thiết bị).

Quick verify (DB):
```sql
SELECT "eventType", "actorUserId", "targetUserId", "ip", "createdAt", "metadata"
FROM "audit_logs"
ORDER BY "createdAt" DESC
LIMIT 50;
```

### 6.1 Run API + mail worker (khuyến nghị hiện tại)
Hiện tại repo không còn overlay compose riêng cho `user-service`.

Luồng dev khuyến nghị:
1) Chạy hạ tầng bằng compose:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
```

2) Chạy app trên host:

```bash
pnpm --filter user-service dev
pnpm --filter user-service worker:mail
```

Tuỳ chọn bật UI xem DB:

```bash
docker compose \
  -f infra/docker/docker-compose.dev.yml \
  -f infra/docker/docker-compose.tool.yml \
  up -d
```

- Mongo Express: `http://localhost:8081`
- Redis Commander: `http://localhost:8082`

### 6.2 Prisma migrate (bắt buộc khi đổi schema)
Sau khi pull thay đổi multi-device sessions:

```bash
pnpm --filter user-service prisma:migrate
pnpm --filter user-service prisma:generate
```

Nếu không chạy 2 lệnh này, Prisma Client sẽ chưa có model/field mới (`AuthSession`, `RefreshToken.sessionId`).

---

## 7) Generate RSA keypair + Base64 (Git Bash & PowerShell)

### 7.1 Vì sao dùng PEM_B64
PEM là multi-line text (có nhiều dòng). `.env` / Docker env / CI thường khó xử lý multi-line value.

Vì vậy `JWT_ACCESS_PRIVATE_KEY_PEM_B64` và `JWT_ACCESS_PUBLIC_KEY_PEM_B64` là cách an toàn:
- Key vẫn là PEM
- Nhưng được **base64** thành 1 dòng để đặt vào env

> Production: **phải** set private/public key rõ ràng. Dev có thể để trống để chạy nhanh, nhưng access token sẽ invalid sau khi restart service (vì keypair ephemeral đổi).

### 7.2 Git Bash (OpenSSL)
Tạo key files:

```bash
mkdir -p .keys

# Private key (RSA 2048)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out .keys/jwt_access_private.pem

# Public key
openssl pkey -in .keys/jwt_access_private.pem -pubout -out .keys/jwt_access_public.pem
```

Convert PEM → Base64 (1 dòng):

```bash
# Nếu base64 hỗ trợ -w 0 (GNU coreutils)
base64 -w 0 .keys/jwt_access_private.pem

# Nếu không có -w (fallback):
base64 .keys/jwt_access_private.pem | tr -d '\n'
```

Làm tương tự cho public:

```bash
base64 -w 0 .keys/jwt_access_public.pem || base64 .keys/jwt_access_public.pem | tr -d '\n'
```

Sau đó paste vào `.env`:

```env
JWT_ACCESS_PRIVATE_KEY_PEM_B64=<output base64 private pem>
JWT_ACCESS_PUBLIC_KEY_PEM_B64=<output base64 public pem>
```

### 7.3 PowerShell (Base64 encode PEM)
Nếu bạn đã có file `.pem` (tạo bằng OpenSSL như trên hoặc tool khác), PowerShell có thể base64 như sau:

```powershell
$privPem = Get-Content .\.keys\jwt_access_private.pem -Raw
$pubPem  = Get-Content .\.keys\jwt_access_public.pem -Raw

$privB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($privPem))
$pubB64  = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pubPem))

$privB64
$pubB64
```

Paste kết quả vào `.env` giống phần trên.

### 7.4 Notes an toàn
- Không commit `.keys/` hoặc `.env` lên git.
- Private key chỉ nằm ở `user-service`.
- Các service khác chỉ cần public key để verify (không cần private key).
