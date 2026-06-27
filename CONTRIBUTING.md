# Contributing Guide

Tài liệu này mô tả cách làm việc thống nhất cho repo `ECommerce`.

## 1. Mục tiêu

Mục tiêu của guideline này là giúp:

- commit dễ review,
- pull request dễ đọc,
- docs và code nhất quán hơn,
- người mới tham gia dự án có thể theo cùng một cách làm.

## 2. Branch gợi ý

- `main`: nhánh ổn định
- `develop`: nhánh tích hợp nếu cần
- `feature/*`: tính năng mới
- `fix/*`: sửa lỗi
- `docs/*`: thay đổi tài liệu
- `refactor/*`: tái cấu trúc

Nếu làm cá nhân, có thể dùng tối giản:

- `main`
- `feature/*`
- `fix/*`
- `docs/*`

## 3. Commit convention

Theo file [docs/standards/COMMIT_CONVENTION.md](docs/standards/COMMIT_CONVENTION.md).

Ví dụ:

- `feat(order): add order outbox worker`
- `fix(user): repair prisma client import`
- `docs: standardize repository documentation layout`

## 4. Trước khi mở pull request

- Chạy lint/typecheck/test cần thiết.
- Cập nhật docs nếu thay đổi flow, schema hoặc contract.
- Ghi rõ cách test nếu thay đổi lớn.
- Nếu đổi env hoặc migration, phải nêu rõ tác động.

Checklist chi tiết nằm ở [docs/standards/PULL_REQUEST_CHECKLIST.md](docs/standards/PULL_REQUEST_CHECKLIST.md).

## 5. Quy tắc cho docs

- Tài liệu tổng đặt trong `docs/`.
- Tài liệu riêng của service đặt trong `services/<service>/docs/`.
- Pull request template thật sự nằm trong `.github/`, không đặt trong `docs/`.
- Chuẩn viết tài liệu nằm ở [docs/standards/DOCUMENTATION_STYLE_GUIDE.md](docs/standards/DOCUMENTATION_STYLE_GUIDE.md).

## 6. Quy tắc cho thay đổi backend

Nếu một thay đổi tác động tới:

- schema,
- message contract,
- runtime flow giữa các service,
- seed/reset/setup,

thì phải cập nhật docs liên quan trong cùng task hoặc cùng pull request.

## 7. Quy tắc review

Khi review, ưu tiên xem:

1. logic có đúng không,
2. có phá contract không,
3. có thêm technical debt không,
4. có thiếu test/docs không.
