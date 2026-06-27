# Tài Liệu Dự Án

Thư mục `docs/` là nơi chứa tài liệu tổng của toàn bộ repo. Mục tiêu của khu vực này là:

- mô tả kiến trúc hệ thống ở mức tổng quan,
- ghi lại các quyết định thiết kế quan trọng,
- hướng dẫn cách chạy, test và vận hành backend,
- chuẩn hóa cách viết tài liệu để nhiều người cùng làm vẫn thống nhất.

Nếu bạn mới vào repo, nên đọc theo thứ tự sau:

1. [README của repo](../README.md)
2. [Tổng quan tài liệu kiến trúc](architecture/README.md)
3. [Báo cáo hiện trạng backend](reports/BACKEND_STATUS_REPORT_AND_NEXT_STEPS.md)
4. [Tổng quan sơ đồ](diagrams/README.md)
5. Tài liệu trong `docs/standards/`
6. README và docs riêng của từng service

## Cấu trúc chuẩn của `docs`

```text
docs/
  README.md
  architecture/
  diagrams/
  guides/
  reports/
  standards/
  templates/
```

## Ý nghĩa từng khu vực

### `architecture/`

Chứa tài liệu kiến trúc tổng của hệ thống:

- service boundaries,
- auth/RBAC,
- event-driven flow,
- định hướng kỹ thuật,
- các quyết định ở mức toàn repo.

### `diagrams/`

Chứa sơ đồ và tài liệu giải thích sơ đồ:

- component diagram,
- database diagram,
- sequence diagram,
- integration flow.

### `guides/`

Chứa tài liệu thao tác:

- chạy local,
- seed/reset dữ liệu,
- test tay,
- debug,
- chạy demo bằng Docker Compose.

### `reports/`

Chứa báo cáo theo giai đoạn:

- hiện trạng backend,
- kế hoạch DevOps,
- kế hoạch blockchain,
- roadmap học tập hoặc triển khai.

### `standards/`

Chứa quy ước làm việc:

- quy ước đặt tên tài liệu,
- cấu trúc file docs,
- git workflow,
- commit convention,
- checklist review,
- logging/observability convention nếu cần.

### `templates/`

Chứa mẫu tài liệu để viết nhanh và thống nhất:

- technical design,
- runbook,
- test guide,
- postmortem,
- release checklist.

## Quy tắc tổ chức tài liệu

- `docs/` chỉ chứa tài liệu ở mức toàn repo hoặc dùng chung nhiều service.
- Tài liệu chỉ liên quan đến một service nên đặt trong `services/<service-name>/docs/`.
- Pull request template và issue template không đặt trong `docs/`, mà đặt trong `.github/`.
- `docs/README.md` đóng vai trò mục lục điều hướng, không nên biến thành nơi chứa quá nhiều nội dung chi tiết.

## Quy tắc đặt tên file

- Ưu tiên `kebab-case` cho file tài liệu tổng: ví dụ `SYSTEM_OVERVIEW.md`, `GIT_WORKFLOW.md`.
- Nếu tài liệu là một “artefact tên riêng” hoặc đã dùng ổn định lâu dài, có thể giữ dạng uppercase rõ nghĩa như:
  - `BACKEND_STATUS_REPORT_AND_NEXT_STEPS.md`
  - `DEVOPS_PLAN.md`
- Không trộn nhiều kiểu đặt tên ngẫu hứng trong cùng một khu vực.
- Với tài liệu mới từ bây giờ:
  - `architecture/`, `guides/`, `standards/`, `templates/` nên ưu tiên `kebab-case`.
  - `reports/` có thể dùng uppercase nếu đó là báo cáo/plan chính thức.

## Nguồn sự thật theo thứ tự ưu tiên

Khi có mâu thuẫn giữa các tài liệu:

1. Code
2. Schema/migration
3. Diagram gắn trực tiếp với schema hoặc flow
4. Tài liệu kiến trúc
5. README và các tài liệu tóm tắt

Tài liệu phải phản ánh code, không được thay thế code.
