# product-subgraph Docs

Thư mục này chứa tài liệu domain và policy riêng của `product-subgraph`.

## Nên đọc theo thứ tự

1. [../README.md](../README.md)
2. [PRODUCT_OPERATION_POLICY.md](PRODUCT_OPERATION_POLICY.md)
3. [ADVANCED_RBAC_AND_WORKFLOWS.md](ADVANCED_RBAC_AND_WORKFLOWS.md)
4. [PRODUCT_TEST_GUIDE.md](PRODUCT_TEST_GUIDE.md)
5. [PRODUCT_INTEGRATION_CHECKLIST.md](PRODUCT_INTEGRATION_CHECKLIST.md)
6. [AUTH_GUARD_PROFESSIONAL_DESIGN.md](AUTH_GUARD_PROFESSIONAL_DESIGN.md)

## Mô tả từng tài liệu

- `PRODUCT_OPERATION_POLICY.md`: rule thao tác product, visibility theo role, seller flow và admin moderation.
- `ADVANCED_RBAC_AND_WORKFLOWS.md`: RBAC nhiều lớp, policy và workflow nâng cao.
- `PRODUCT_TEST_GUIDE.md`: hướng dẫn test tay product bằng token thật.
- `PRODUCT_INTEGRATION_CHECKLIST.md`: checklist xác nhận product-subgraph tích hợp đúng với user-service.
- `AUTH_GUARD_PROFESSIONAL_DESIGN.md`: ghi chú thiết kế guard và auth chain.

## Quy ước cho docs của product

- Tài liệu nên phân biệt rõ quyền của guest, buyer, seller và admin.
- Khi đổi status flow hoặc product visibility, phải cập nhật lại policy docs và test guide.
