# Git Workflow

## 1. Mục tiêu

Quy ước này giúp repo dễ review hơn, dễ bảo trì hơn và gần với cách làm việc trong môi trường chuyên nghiệp.

## 2. Nhánh gợi ý

- `main`: nhánh ổn định nhất
- `develop`: nhánh tích hợp trong giai đoạn phát triển
- `feature/*`: tính năng mới
- `fix/*`: sửa lỗi
- `docs/*`: cập nhật tài liệu
- `refactor/*`: tái cấu trúc

Nếu bạn đang làm một mình, có thể giản lược còn:

- `main`
- `feature/*`
- `fix/*`
- `docs/*`

## 3. Quy tắc commit

- Một commit nên giải quyết một ý chính.
- Không trộn quá nhiều loại thay đổi không liên quan vào một commit.
- Nếu có thể, tách riêng:
  - code change,
  - schema/migration,
  - docs,
  - test.

## 4. Quy tắc pull request

- PR nên có phạm vi rõ.
- Tiêu đề PR nên nói được kết quả cuối cùng.
- Nếu thay đổi runtime flow, cần mô tả cách test.
- Nếu thay đổi schema hoặc env, phải ghi rõ tác động.

## 5. Quy tắc review

Khi review một thay đổi, ưu tiên xem:

1. Có làm sai logic hoặc regression không
2. Có phá contract giữa các service không
3. Có thiếu test hoặc thiếu docs không
4. Có làm cấu trúc repo rối hơn không

## 6. Khi nào cần tách commit

Nên tách commit riêng nếu bạn làm đồng thời các việc sau:

- đổi cấu trúc thư mục,
- thêm feature,
- đổi schema,
- cập nhật docs,
- thêm script vận hành.

Mục tiêu là để `git log` có giá trị học tập và review, không chỉ là nơi lưu snapshot ngẫu nhiên.
