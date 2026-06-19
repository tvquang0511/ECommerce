# Apollo + NestJS Learning Roadmap (Tách Biệt Product Plan)

Mục tiêu tài liệu này: giúp bạn đi từ nền tảng GraphQL cơ bản (`express-graphql`) sang NestJS + Apollo theo lộ trình học riêng, không trộn với kế hoạch nghiệp vụ product.

---

## 1) Nguyên tắc học

- Học theo lớp từ dễ đến khó: GraphQL core -> Apollo trong NestJS -> tối ưu resolver -> mới qua Federation.
- Mỗi giai đoạn phải có demo chạy được.
- Chỉ học thứ cần cho bước tiếp theo, tránh "đọc hết docs trước khi code".

---

## 2) Điểm xuất phát hiện tại

Bạn đã có:
- GraphQL cơ bản với Node.js (`express-graphql`).
- Một chút NestJS.

Bạn chưa cần học ngay:
- Federation directives (`@key`, `@provides`, `@requires`).
- Apollo Gateway internals sâu.

---

## 3) Lộ trình 4 giai đoạn

### Giai đoạn A - Apollo cơ bản trong NestJS (3-5 ngày)

Mục tiêu:
- Hiểu GraphQLModule trong Nest.
- Viết resolver/query/mutation theo code-first.
- Tách resolver -> service.

Checklist:
1. Tạo `Product` model bằng decorator GraphQL.
2. Query `ping`, `product(id)`, `products`.
3. Mutation đơn giản: `createProduct` (in-memory).
4. Xử lý lỗi cơ bản bằng exception của Nest.

Done khi:
- Chạy được `/graphql` ổn định.
- Bạn tự thêm field mới vào Product mà không cần xem lại hướng dẫn.

### Giai đoạn B - Data + validation + cấu trúc module (5-7 ngày)

Mục tiêu:
- Dùng Mongo (hoặc mock repo ban đầu), tách layer rõ ràng.
- Áp validation cho input.
- Quen với cách tổ chức module trong Nest.

Checklist:
1. Tạo `products.module`, `products.resolver`, `products.service`, `products.repository`.
2. Có input type cho filter/sort/pagination.
3. Có unit test tối thiểu cho service.
4. Có healthcheck + env config.

Done khi:
- CRUD cơ bản chạy được bằng GraphQL.
- Code không còn dồn logic vào resolver.

### Giai đoạn C - Apollo nâng cao (5-7 ngày)

Mục tiêu:
- Nắm các concept thường gặp trước khi vào Federation.

Checklist:
1. Pagination kiểu cursor.
2. DataLoader (giảm N+1 query).
3. Caching layer đọc (Redis key đơn giản).
4. Authorization cơ bản cho mutation admin.
5. Error codes thống nhất.

Done khi:
- Bạn hiểu vì sao resolver nào cần DataLoader.
- Bạn debug được query chậm bằng logging/metrics cơ bản.

### Giai đoạn D - Chuẩn bị chuyển qua Federation (3-5 ngày)

Mục tiêu:
- Không code Federation vội, chỉ chuẩn bị mindset và boundaries.

Checklist:
1. Xác định entity chính (`Product`) và key ổn định (`id`).
2. Tách rõ data ownership (service nào sở hữu dữ liệu nào).
3. Review schema để tránh coupling chéo service.
4. Chuẩn hóa response shape cho các field thường được reference.

Done khi:
- Bạn biết chính xác khi nào nên dùng `@key` và `__resolveReference`.

---

## 4) Chương trình học theo tuần (gợi ý)

### Tuần 1
- Hoàn thành Giai đoạn A.
- Build một API GraphQL gọn: query + mutation + error handling.

### Tuần 2
- Hoàn thành Giai đoạn B.
- Bắt đầu lưu dữ liệu thật (Mongo) cho product.

### Tuần 3
- Hoàn thành Giai đoạn C.
- Tối ưu và chuẩn hóa chất lượng code.

### Tuần 4
- Hoàn thành Giai đoạn D.
- Bắt đầu nâng service sang Federation theo `product-service-plan.md`.

---

## 5) Bạn nên học tài liệu theo thứ tự nào

1. NestJS fundamentals: module/provider/injector.
2. NestJS GraphQL (Apollo driver) phần cơ bản.
3. GraphQL best practices (pagination, N+1, errors).
4. Apollo Federation docs (chỉ đọc sau khi xong Giai đoạn C).

---

## 6) Quy tắc "đủ để đi tiếp"

- Không cần chờ "giỏi hết" mới bắt đầu Federation.
- Chỉ cần đạt 4 điều sau:
1. Tự thiết kế schema vừa đủ cho domain.
2. Tách resolver/service rõ ràng.
3. Biết xử lý validation + error code chuẩn.
4. Hiểu data ownership và contract giữa service.

Khi đạt đủ 4 điều trên, bạn chuyển sang federation sẽ rất mượt.

---

## 7) Bước kế tiếp đề xuất ngay trong repo này

1. Chạy `product-subgraph` ở mode Apollo-first (NestJS).
2. Thêm mutation `createProduct` + input validation.
3. Thêm pagination cho `products`.
4. Sau đó mới bật nhánh migration Federation.

Tài liệu liên quan:
- Product plan tổng thể: `docs/architecture/product-service-plan.md`
- Service hiện tại: `services/product-subgraph/`
