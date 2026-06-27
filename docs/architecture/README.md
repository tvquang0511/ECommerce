# Tài Liệu Kiến Trúc

Thư mục `docs/architecture/` chứa các tài liệu giải thích kiến trúc ở mức toàn hệ thống. Đây là nơi trả lời các câu hỏi:

- hệ thống được chia service như thế nào,
- vì sao chọn kiến trúc đó,
- auth và RBAC đi qua đâu,
- event-driven flow đang được tổ chức ra sao,
- giai đoạn hiện tại của dự án đang tập trung vào phần nào.

## Danh mục hiện tại

- [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md): bức tranh tổng quan của hệ thống.
- [SERVICE_BOUNDARIES_AND_RESPONSIBILITIES.md](SERVICE_BOUNDARIES_AND_RESPONSIBILITIES.md): mô tả vai trò và phạm vi của từng service.
- [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md): luồng xác thực và phân quyền.
- [MARKETPLACE_RBAC.md](MARKETPLACE_RBAC.md): mô hình quyền trong marketplace.
- [NEXT_WEB_PROXY.md](NEXT_WEB_PROXY.md): ghi chú về hướng proxy qua Next.js.
- [ARCHITECTURE_PRINCIPLES.md](ARCHITECTURE_PRINCIPLES.md): nguyên tắc kiến trúc tổng đang theo.
- [CURRENT_FOCUS.md](CURRENT_FOCUS.md): phần đang tập trung triển khai hoặc học sâu.
- [apollo-nestjs-learning-roadmap.md](apollo-nestjs-learning-roadmap.md): roadmap học tập liên quan Apollo/NestJS.
- [ARCHITECTURE_DOCUMENT_TEMPLATE.md](ARCHITECTURE_DOCUMENT_TEMPLATE.md): mẫu chuẩn để viết tài liệu kiến trúc mới.

## Khi nào viết vào `architecture/`

Đặt tài liệu vào đây nếu tài liệu:

- ảnh hưởng nhiều hơn một service,
- giải thích quyết định ở mức system design,
- mô tả boundary giữa các domain,
- là “nguồn tham khảo lâu dài” cho người đọc mới.

Không nên đặt vào đây nếu tài liệu chỉ phục vụ một service cụ thể. Khi đó hãy đặt trong `services/<service>/docs/`.

## Thứ tự đọc gợi ý

1. [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md)
2. [SERVICE_BOUNDARIES_AND_RESPONSIBILITIES.md](SERVICE_BOUNDARIES_AND_RESPONSIBILITIES.md)
3. [AUTHENTICATION_AND_AUTHORIZATION.md](AUTHENTICATION_AND_AUTHORIZATION.md)
4. [MARKETPLACE_RBAC.md](MARKETPLACE_RBAC.md)
5. [CURRENT_FOCUS.md](CURRENT_FOCUS.md)

## Chuẩn viết tài liệu kiến trúc

Một file trong `architecture/` nên cố gắng có đủ các phần sau:

1. Mục tiêu
2. Phạm vi
3. Bối cảnh
4. Thiết kế đề xuất hoặc hiện trạng
5. Trade-off
6. Rủi ro
7. Việc tiếp theo

Không cần file nào cũng quá dài, nhưng nên trả lời được câu hỏi “vì sao hệ thống được làm như vậy”.
