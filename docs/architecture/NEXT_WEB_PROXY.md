# Next.js Web Proxy

## 1. Mục tiêu

Tài liệu này giải thích vì sao frontend nên đi qua Next.js proxy thay vì gọi trực tiếp `user-service` từ trình duyệt.

## 2. Phạm vi

Tài liệu này tập trung vào auth flow giữa browser, Next.js và `user-service`. Nó không mô tả toàn bộ giao tiếp của frontend với các subgraph khác.

## 3. Bài toán cần giải quyết

Khi browser gọi trực tiếp `user-service`, thường phát sinh các vấn đề:

- CORS và preflight request làm flow rối hơn.
- Cookie refresh cross-origin khó cấu hình ổn định.
- URL nội bộ của service dễ bị lộ ra phía client.
- Khi số service tăng lên, frontend phải quản lý quá nhiều public base URL.

## 4. Thiết kế đề xuất

Để browser chỉ giao tiếp với một origin duy nhất:

- Browser gọi `http://localhost:3000/api/users/...`
- Next.js server forward tiếp sang `user-service`

Trong repo này, path prefix `/api/users/*` được giữ nguyên để cookie refresh vẫn áp đúng vào auth route mong muốn.

## 5. Lợi ích chính

### Same-origin auth flow

- giảm vấn đề CORS,
- giảm preflight noise,
- cấu hình auth ở frontend đơn giản hơn.

### Cookie hoạt động ổn định hơn

Refresh cookie được nhìn như first-party cookie từ góc nhìn của ứng dụng web.

### Ẩn bớt hạ tầng nội bộ

Frontend không cần lộ trực tiếp URL thật của `user-service` ra client bundle.

### Dễ mở rộng

Sau này nếu có thêm service cần proxy, có thể giữ cùng một mô hình thay vì để mỗi service lộ ra một entrypoint riêng.

## 6. Trade-off

- Tăng thêm một lớp proxy ở Next.js.
- Cần quản lý rõ route mapping giữa web app và backend service.
- Nếu proxy viết thiếu nhất quán, debug auth flow có thể khó hơn.

## 7. Khi nào nên dùng tài liệu này

Đọc tài liệu này khi:

- cấu hình auth web app,
- debug cookie/refresh flow,
- giải thích vì sao auth không đi thẳng từ browser sang `user-service`.

## 8. Việc tiếp theo

- Chuẩn hóa tài liệu frontend/backend boundary nếu web app tiếp tục mở rộng.
- Ghi rõ hơn danh sách route nào đang proxy qua Next.js và route nào đi qua gateway/nginx.
