# Authentication And Authorization

## 1. Mục tiêu

Tài liệu này mô tả thiết kế xác thực và phân quyền hiện tại, lấy `user-service` làm nguồn sự thật cho identity, token và auth context.

## 2. Phạm vi

Tài liệu này tập trung vào:

- access token,
- refresh token,
- session model,
- OTP/2FA,
- cách downstream service xác thực request,
- mối quan hệ giữa auth và RBAC.

## 3. Thiết kế hiện tại

### Access token

- Dạng JWT
- Ký bằng `RS256`
- `user-service` giữ private key để sign
- Các service khác dùng public key để verify

Thiết kế này giảm việc phải share cùng một secret cho toàn bộ hệ thống.

### Refresh token

- Không dùng JWT
- Dùng opaque random token
- Chỉ lưu hash trong database
- Hỗ trợ multi-device sessions

### OTP và email flow

- OTP/email được dùng cho các flow xác minh cần thiết
- Việc gửi email được tách sang worker nền của `user-service`

## 4. Auth context trong hệ thống

`user-service` là nơi phát hành danh tính. Các service khác không tự tạo user identity, mà chỉ:

- verify access token,
- resolve actor từ token,
- áp business rule của riêng service đó.

Điều này giúp giữ ranh giới rõ:

- `user-service` lo identity,
- service domain lo authorization theo nghiệp vụ của chính nó.

## 5. RBAC gắn vào auth như thế nào

Token và auth context là đầu vào của authorization, nhưng không phải toàn bộ authorization.

Authorization cuối cùng thường dựa trên:

- role,
- permission,
- ownership,
- trạng thái nghiệp vụ của resource.

Ví dụ:

- seller có role đúng nhưng chưa verified thì vẫn không được thao tác như seller hoàn chỉnh
- buyer đã đăng nhập nhưng vẫn không được add product chưa approved vào cart/order

## 6. Service nào làm gì

### `user-service`

- login/register
- refresh/logout
- session management
- OTP/verification
- seller/admin identity data

### `product-subgraph`, `cart-subgraph`, `order-subgraph`

- verify JWT bằng public key
- lấy actor từ request
- tự quyết định business authorization theo domain của mình

## 7. Trade-off

### Điểm mạnh

- tách rõ auth và business domain
- phù hợp microservices
- không cần share secret sign cho toàn hệ thống

### Giới hạn hiện tại

- key distribution hiện vẫn thiên về env/config
- chưa đi sâu vào JWKS/key rotation production-grade
- observability cho auth flow còn có thể cải thiện thêm

## 8. Tài liệu liên quan

- [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md)
- [MARKETPLACE_RBAC.md](MARKETPLACE_RBAC.md)
- [services/user-service/docs/INTROSPECT_ENDPOINT.md](../../services/user-service/docs/INTROSPECT_ENDPOINT.md)

## 9. Việc tiếp theo

- Chuẩn hóa logging cho auth flow
- Chuẩn hóa contract auth context giữa các service
- Nếu cần production-like hơn, nghiên cứu thêm JWKS và key rotation
