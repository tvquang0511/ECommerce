# Admin Domain Design

## 1. Mục tiêu

Tài liệu này mô tả thiết kế tổng thể cho domain `admin` trong `user-service`.

Mục tiêu là:

- xác định rõ admin là ai trong hệ thống marketplace
- phân chia trách nhiệm giữa các loại admin
- định nghĩa ranh giới giữa:
  - admin của `user-service`
  - admin của `product-subgraph`
  - admin của các service khác trong tương lai
- làm nền trước khi triển khai các workflow admin thực tế

Tài liệu này không thay thế tài liệu seller onboarding.
Nó đứng ở tầng cao hơn và mô tả toàn bộ vai trò quản trị nội bộ của hệ thống.

---

## 2. Vì sao admin cần một thiết kế riêng

Nếu chỉ nhìn đơn giản, ta có thể nghĩ:

```ts
enum Role {
  BUYER,
  SELLER,
  ADMIN
}
```

Nhưng trong một marketplace thật, `ADMIN` không phải chỉ là một nhóm người duy nhất.

Các công việc quản trị thường tách ra:

- người duyệt seller
- người duyệt product
- người xem báo cáo
- người xử lý vận hành
- người có toàn quyền cấu hình hệ thống

Nếu dùng một role `ADMIN` duy nhất:

- khó mở rộng
- khó audit
- dễ cấp quyền quá tay
- khó mô tả đúng nghiệp vụ

Vì vậy, admin nên được thiết kế như một domain riêng.

---

## 3. Phạm vi của admin trong hệ thống hiện tại

Trong giai đoạn hiện tại của đồ án, admin nên tập trung vào 3 nhóm việc:

### 3.1 Quản trị seller

- xem seller profiles
- duyệt seller đang chờ xác minh
- suspend seller
- ban seller

### 3.2 Quản trị product

- xem product chờ duyệt
- approve product
- reject product
- xem các product không public

### 3.3 Xem dữ liệu vận hành và analytics

- xem danh sách seller
- xem danh sách product
- xem audit log hoặc số liệu tổng quan trong tương lai

Những việc chưa cần làm sớm:

- quản trị tài chính
- quản trị hoàn tiền
- quản trị logistics
- quản trị kho
- quản trị dispute phức tạp

---

## 4. Các loại admin đề xuất

Dựa trên RBAC seed hiện tại, hệ thống đang có:

- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

Đây là bộ role hợp lý cho MVP.

## 4.1 `ADMIN_MODERATOR`

Mục tiêu:

- kiểm duyệt seller và product

Quyền chính:

- `seller:view_all`
- `seller:verify`
- `seller:suspend`
- `product:view_all`
- `product:approve`

Trách nhiệm:

- approve seller
- suspend seller
- approve/reject product
- theo dõi nội dung cần moderation

## 4.2 `ADMIN_OPERATIONS`

Mục tiêu:

- xử lý vận hành hệ thống ở mức service

Quyền chính hiện tại:

- `seller:view_all`
- `seller:suspend`
- `product:view_all`

Trách nhiệm:

- xem seller
- xử lý seller support
- can thiệp trạng thái seller khi cần
- xem product toàn hệ thống để hỗ trợ vận hành

Ghi chú:

Ở MVP hiện tại, `ADMIN_OPERATIONS` có thể được phép approve seller hoặc không.
Bạn cần chốt rõ trong code.

Nếu muốn đơn giản:

- cho `ADMIN_OPERATIONS` được approve seller
- nhưng chưa cho approve product

## 4.3 `ADMIN_ANALYTICS`

Mục tiêu:

- xem báo cáo

Quyền chính:

- `analytics:view_all`
- `seller:view_all`
- `product:view_all`

Trách nhiệm:

- xem số liệu seller
- xem số liệu product
- xem dashboard analytics

Không nên có quyền:

- approve seller
- suspend seller
- approve product

## 4.4 `SUPER_ADMIN`

Mục tiêu:

- toàn quyền

Quyền:

- tất cả role/permission

Trách nhiệm:

- override toàn hệ thống
- xử lý sự cố
- cấu hình hoặc can thiệp khi cần

---

## 5. Nguyên tắc phân quyền admin

## 5.1 Admin là internal actor

Admin không phải là loại user mà ai cũng tự đăng ký được.

Admin chỉ nên được tạo qua:

- seed data
- script nội bộ
- công cụ quản trị nội bộ trong tương lai

Không nên có endpoint public kiểu:

- “đăng ký admin”
- “apply admin”

## 5.2 Admin phải dùng cùng auth system với user thường

Admin vẫn là một `User` trong `user-service`.
Chỉ khác ở chỗ:

- được gán role admin
- có permission nội bộ

Điều này giúp:

- không cần auth system thứ hai
- `introspect` vẫn dùng chung contract
- mọi subgraph đều chỉ cần đọc role/permission hiện tại

## 5.3 Admin permission phải nhỏ hơn role tổng quát

Trong code, đừng suy nghĩ theo kiểu:

- có role `ADMIN` thì muốn làm gì cũng được

Nên suy nghĩ theo:

- role admin dùng để phân nhóm actor
- permission mới là cái chặn hành vi
- service vẫn phải kiểm tra thêm rule nghiệp vụ

Ví dụ:

- `ADMIN_MODERATOR` có thể có quyền `product:approve`
- nhưng product chỉ được approve nếu đang ở `PENDING_REVIEW`

## 5.4 Audit log là bắt buộc với admin action

Mọi hành động nhạy cảm của admin nên ghi audit log:

- ai làm
- làm trên ai / tài nguyên nào
- lúc nào
- dữ liệu thay đổi là gì

Đây là phần rất quan trọng nếu sau này bạn học sâu hơn về event-driven hoặc auditability.

---

## 6. Ranh giới giữa `user-service` và các service khác

## 6.1 `user-service` quản lý admin identity

`user-service` là nơi quản lý:

- admin role
- admin permission
- admin profile ở mức user
- audit log account-level action

`user-service` chịu trách nhiệm trả về admin state qua `introspect`.

## 6.2 `product-subgraph` quản lý admin product workflow

`product-subgraph` nên tự quyết định các rule như:

- product nào được approve
- product nào được reject
- product nào được public

Tức là:

- `user-service` nói “actor này là admin moderator”
- `product-subgraph` nói “admin này có được approve product cụ thể này không”

## 6.3 `order-subgraph` sau này sẽ có admin workflow riêng

Khi bạn làm `order-subgraph`, admin bên đó có thể cần:

- xem order toàn hệ thống
- can thiệp trạng thái order
- xử lý dispute
- xem audit order

Nhưng identity admin vẫn nên đi từ `user-service`.

---

## 7. Contract admin qua `introspect`

Admin không cần contract riêng.
Vẫn dùng chung `introspect`:

```json
{
  "userId": "admin_123",
  "email": "admin@example.com",
  "roles": ["ADMIN_MODERATOR"],
  "permissions": [
    "product:view_all",
    "product:approve",
    "seller:view_all",
    "seller:verify",
    "seller:suspend"
  ],
  "sellerProfile": null,
  "exp": 1705000000
}
```

Các service khác chỉ cần đọc:

- `roles`
- `permissions`

và áp thêm business rule của riêng chúng.

---

## 8. API admin nên đặt ở đâu

Ở giai đoạn hiện tại, admin API của `user-service` nên đặt dưới namespace:

- `/api/users/admin/...`

Ví dụ:

- `/api/users/admin/sellers`
- `/api/users/admin/sellers/:sellerProfileId/approve`
- `/api/users/admin/sellers/:sellerProfileId/suspend`
- `/api/users/admin/sellers/:sellerProfileId/ban`

Lý do:

- rõ đây là internal admin flow
- tách khỏi luồng user thường
- thuận tiện cho frontend admin panel

Sau này khi mở rộng:

- `user-service` chỉ nên giữ admin API nào liên quan trực tiếp đến user/seller identity
- còn product admin API nên nằm trong `product-subgraph`

---

## 9. Cấu trúc thư mục đề xuất

Với `user-service`, mình đề xuất chưa cần tạo ngay module `admin` riêng nếu admin chỉ đang thao tác seller.

Hiện tại có thể tổ chức như sau:

```text
src/modules/
  auth/
  users/
  sellers/
```

Trong đó:

- flow user thường của seller nằm ở `sellers/*`
- flow admin seller cũng tạm nằm ở `sellers/*`

Khi nào nên tách `admin/` riêng:

- khi có admin workflow cho nhiều domain trong `user-service`
- khi có admin dashboard nội bộ phức tạp
- khi có quá nhiều admin endpoints

### Cấu trúc tương lai nếu cần tách

```text
src/modules/
  auth/
  users/
  sellers/
  admin/
    admin.controller.ts
    admin.router.ts
    admin.service.ts
    admin.openapi.ts
```

Nhưng ở hiện tại, chưa cần vội.

---

## 10. Quy tắc nghiệp vụ admin nên chốt từ sớm

## 10.1 Ai được duyệt seller

Nên chốt rõ một trong hai hướng:

### Hướng A: Chặt chẽ hơn

- `SUPER_ADMIN`
- `ADMIN_MODERATOR`

được approve seller

### Hướng B: Thực dụng hơn cho MVP

- `SUPER_ADMIN`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`

được approve seller

Nếu bạn đang ưu tiên tốc độ làm đồ án, hướng B là hợp lý hơn.

Trạng thái implement hiện tại của repo nên chốt như sau:

- `SUPER_ADMIN`: full access
- `ADMIN_MODERATOR`: list seller, approve seller, suspend seller, ban seller
- `ADMIN_OPERATIONS`: list seller, suspend seller, ban seller
- `ADMIN_ANALYTICS`: chỉ list seller / xem dữ liệu, không được approve/suspend/ban

## 10.2 Ai được duyệt product

Nên để:

- `SUPER_ADMIN`
- `ADMIN_MODERATOR`

được approve/reject product

Không nên cho `ADMIN_ANALYTICS` làm việc này.

## 10.3 Ai được xem dữ liệu toàn hệ thống

- `SUPER_ADMIN`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`

đều có thể có `view_all` tùy domain

Nhưng không phải ai xem được thì cũng sửa được.

## 10.4 Ai được suspend seller

Nên cho:

- `SUPER_ADMIN`
- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`

Nếu muốn chặt hơn nữa, bạn có thể giới hạn riêng.

---

## 11. Audit log cho admin

Nên có nhóm audit event riêng cho admin action.

### Trong `user-service`

- `SELLER_VERIFIED`
- `SELLER_SUSPENDED`
- `SELLER_BANNED`

### Sau này trong `product-subgraph`

- `PRODUCT_APPROVED`
- `PRODUCT_REJECTED`
- `PRODUCT_ARCHIVED_BY_ADMIN`

Metadata nên có:

- actor admin id
- target user id hoặc resource id
- lý do nếu có
- timestamp

---

## 12. Seed data cho admin

Để test tốt, nên có ít nhất:

- `admin@demo.local`
  - role: `SUPER_ADMIN`

Có thể thêm:

- `moderator@demo.local`
  - role: `ADMIN_MODERATOR`

- `ops@demo.local`
  - role: `ADMIN_OPERATIONS`

- `analytics@demo.local`
  - role: `ADMIN_ANALYTICS`

Lợi ích:

- test đúng phân quyền
- test UI admin rõ hơn
- dễ chứng minh RBAC hoạt động

---

## 13. Lộ trình triển khai admin hợp lý

Mình đề xuất theo thứ tự:

### Giai đoạn 1

- hoàn thiện seller onboarding
- để admin can thiệp seller qua module `sellers`

### Giai đoạn 2

- bổ sung seed admin đủ các role
- test lại RBAC admin bằng user demo riêng

### Giai đoạn 3

- hoàn thiện moderation bên `product-subgraph`
- map `ADMIN_MODERATOR` vào approve/reject product

### Giai đoạn 4

- nếu cần, tách `admin` thành module riêng trong `user-service`
- thêm audit/log/report nội bộ

---

## 14. Kết luận

Admin trong đồ án này không nên được hiểu là “một role toàn năng duy nhất”.

Thiết kế phù hợp hơn là:

- `ADMIN_MODERATOR`
- `ADMIN_OPERATIONS`
- `ADMIN_ANALYTICS`
- `SUPER_ADMIN`

`user-service` nên là nơi giữ:

- admin identity
- role
- permission
- introspect contract

Còn từng domain service khác như `product-subgraph` sẽ tự áp business rule của chính nó.

Nói ngắn gọn:

- `user-service` trả lời: admin này là ai, có quyền gì
- domain service trả lời: admin đó có được làm việc này trên tài nguyên này không

Đó là cách tách trách nhiệm rõ, thực tế, và rất phù hợp để sau này bạn học tiếp sang CQRS, event-driven, và `order-subgraph`.
