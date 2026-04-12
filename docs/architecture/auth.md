# Auth architecture (user-service)

Tài liệu này mô tả thiết kế auth hiện tại của `user-service` sau khi:
- Chuyển **access token** từ HMAC (HS256/shared secret) sang **RSA (RS256)**.
- Chuyển **refresh token** sang **opaque random token** (không phải JWT) + lưu **hash trong DB**.
- Thêm **2FA (email OTP)** với TTL 2 phút.
- Tách việc gửi email sang **BullMQ worker** (mức B: 1 process khác, vẫn thuộc user-service).

---

## 1) Token model

### 1.1 Access token (JWT, RS256)
- **Dạng**: JWT
- **Algorithm**: `RS256`
- **TTL**: `JWT_ACCESS_TTL` (mặc định `15m`)
- **Ký (sign)**: chỉ `user-service` giữ **private key** để sign.
- **Xác thực (verify)**: các service khác chỉ cần **public key** để verify.

**Mục tiêu**: loại bỏ yêu cầu “mọi service phải share cùng secret key”, giảm blast radius nếu bị lộ.

**Key distribution**
- Dev/simple: copy public key vào env của các service cần verify.
- Chuẩn hơn (giai đoạn sau): expose JWKS endpoint (ví dụ `/.well-known/jwks.json`) để các service fetch + cache theo `kid` (hỗ trợ rotation).

### 1.2 Refresh token (opaque, single-device, rotation)
Refresh token **không phải JWT**.

- **Format**: `<tokenId>.<secret>`
  - `tokenId`: random, dùng để lookup nhanh
  - `secret`: random, không lưu plaintext
- **Lưu DB**: bảng `refresh_tokens`
  - `tokenId` (unique)
  - `tokenHash = sha256(secret + "." + REFRESH_TOKEN_PEPPER)`
  - `revokedAt`, `expiresAt`, `replacedByTokenId`, `lastUsedAt`

**Single-device**
- Mỗi user chỉ nên có 1 refresh token active.
- Khi login/register hoặc refresh rotation, hệ thống revoke các refresh token active khác.

**Rotation**
- Mỗi lần gọi `POST /api/users/auth/refresh` thành công:
  1) Token cũ bị revoke
  2) Tạo token mới
  3) Set cookie refresh token = token mới

**Reuse detection (token bị lộ)**
- Nếu refresh token đã bị revoke mà vẫn được dùng lại (reuse) hoặc secret mismatch:
  - Revoke toàn bộ refresh token active của user ngay lập tức
  - Trả lỗi `AUTH_REFRESH_COMPROMISED`
  - Client phải ép user login lại

---

## 2) 2FA (Email OTP)

### 2.1 User flag
- `users.twoFactorEnabled`: nếu `true` thì login yêu cầu OTP.

> Lưu ý: hiện tại doc tập trung vào flow auth. Cơ chế “enable/disable 2FA” (settings UI/API) có thể bổ sung sau.

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
- Worker-side (consume): `src/workers/mail/worker.ts` + entry `src/workers/mail/index.ts`
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
- `POST /api/users/auth/forgot-password` (enqueue mail)
- `POST /api/users/auth/reset-password` (revoke refresh tokens; enqueue mail)

---

## 5) Environment variables

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

## 6) Dev notes

- Nếu không set RSA keys và `NODE_ENV!=production`, `user-service` sẽ tự generate keypair ephemeral để dev chạy nhanh.
- Nếu SMTP chưa cấu hình, một số endpoint sẽ trả dev helper (ví dụ `devResetToken` hoặc `devOtp`) để test bằng Postman.

### 6.1 Run API + mail worker bằng Docker Compose
Repo có overlay compose để chạy `user-service` và `mail-worker` cùng với Postgres/Redis:

```bash
docker compose \
  -f infra/docker-compose.dev.yml \
  -f infra/docker-compose.user-service.dev.yml \
  up -d --build
```

Ghi chú:
- File `infra/docker-compose.user-service.dev.yml` load env từ `services/user-service/.env` (SMTP/keys/...) và override `DATABASE_URL`/`REDIS_URL` để trỏ vào container services (`postgres`, `redis`).

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
