# Documentation Style Guide

## 1. Mục tiêu

Tài liệu trong repo này phải đạt 3 tiêu chí:

- dễ tìm,
- dễ đọc,
- dễ cập nhật khi code thay đổi.

Mục tiêu của guideline này là giúp mọi tài liệu mới được viết theo cùng một chuẩn.

## 2. Cấu trúc thư mục chuẩn

### Tài liệu tổng của repo

Đặt trong `docs/` nếu tài liệu:

- áp dụng cho nhiều service,
- giải thích kiến trúc hệ thống,
- là báo cáo tổng,
- là hướng dẫn vận hành hoặc quy ước dùng chung.

### Tài liệu riêng của service

Đặt trong `services/<service-name>/docs/` nếu tài liệu:

- chỉ liên quan đến một service,
- mô tả domain logic cụ thể của service đó,
- là test guide hoặc design note riêng của service.

## 3. Quy ước đặt tên

### Thư mục

- Dùng `kebab-case`
- Ví dụ:
  - `database-diagram`
  - `sequence-diagrams`
  - `event-flows`

### File

- Với tài liệu thông thường: dùng `kebab-case`
  - `SYSTEM_OVERVIEW.md`
  - `local-development-setup.md`
  - `GIT_WORKFLOW.md`
- Với báo cáo hoặc kế hoạch chính thức: có thể dùng uppercase rõ nghĩa
  - `BACKEND_STATUS_REPORT_AND_NEXT_STEPS.md`
  - `DEVOPS_PLAN.md`

### Không nên

- Không trộn `camelCase`, `snake_case`, `PascalCase` ngẫu nhiên cho file markdown.
- Không dùng tên quá mơ hồ như `notes.md`, `new.md`, `temp.md`.

## 4. Cấu trúc nội dung chuẩn cho một file docs

Không phải file nào cũng cần dài, nhưng nên ưu tiên format sau:

```text
# Tiêu đề

## 1. Mục tiêu
## 2. Phạm vi hoặc bối cảnh
## 3. Nội dung chính
## 4. Trade-off / rủi ro / giới hạn
## 5. Việc tiếp theo
```

Nếu là guide thao tác, có thể dùng:

```text
# Tiêu đề

## 1. Mục tiêu
## 2. Điều kiện trước khi bắt đầu
## 3. Các bước thực hiện
## 4. Cách kiểm tra kết quả
## 5. Sự cố thường gặp
```

## 5. Giọng văn và cách viết

- Viết ngắn gọn, rõ ý, thiên về kỹ thuật.
- Ưu tiên tiếng Việt có dấu nếu đây là tài liệu học tập chính của bạn.
- Một câu nên truyền đạt một ý chính.
- Hạn chế viết kiểu “ghi chú nghĩ gì viết nấy”.

## 6. Những gì nên có trong tài liệu kỹ thuật

- mục tiêu của tài liệu,
- phạm vi tài liệu,
- giả định quan trọng,
- decision hoặc rule quan trọng,
- việc chưa làm,
- bước tiếp theo nếu tài liệu còn dang dở.

## 7. Những gì không nên có

- log thô dài dòng dán nguyên xi vào docs,
- đoạn chat hoặc suy nghĩ tạm thời không còn giá trị lâu dài,
- nội dung trùng lặp giữa nhiều file mà không có lý do rõ ràng,
- tài liệu mâu thuẫn với code nhưng không ghi chú rõ.

## 8. Quy tắc liên kết

- Luôn link sang file liên quan nếu có tài liệu nền trước đó.
- Nếu một file phụ thuộc file khác, nên nói rõ “nên đọc trước”.
- Không nên tạo mạng lưới link quá dày nếu không thực sự cần.

## 9. Quy tắc cập nhật

- Nếu thay đổi architecture hoặc runtime flow, phải cập nhật docs trong cùng task.
- Nếu đổi schema, migration hoặc API contract, phải rà lại docs liên quan.
- Nếu một tài liệu không còn đúng, nên sửa hoặc xóa, không nên để “treo”.

## 10. Quy tắc dành cho AI-generated docs

Khi dùng AI để viết docs:

- phải rà lại tên file và vị trí đặt file,
- phải bỏ nội dung lặp,
- phải đổi từ ngữ chung chung thành đúng với repo hiện tại,
- phải thêm section “việc tiếp theo” hoặc “giới hạn hiện tại” nếu cần.
