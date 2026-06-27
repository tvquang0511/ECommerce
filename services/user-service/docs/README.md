# user-service Docs

Thư mục này chứa tài liệu riêng của `user-service`.

## Nên đọc theo thứ tự

1. [../README.md](../README.md)
2. [INTROSPECT_ENDPOINT.md](INTROSPECT_ENDPOINT.md)
3. [SELLER_ONBOARDING_DESIGN.md](SELLER_ONBOARDING_DESIGN.md)
4. [ADMIN_DOMAIN_DESIGN.md](ADMIN_DOMAIN_DESIGN.md)

## Mô tả từng tài liệu

- `INTROSPECT_ENDPOINT.md`: mô tả contract xác thực mà các service khác có thể dựa vào.
- `SELLER_ONBOARDING_DESIGN.md`: thiết kế seller onboarding và lifecycle seller.
- `ADMIN_DOMAIN_DESIGN.md`: thiết kế domain admin trong phạm vi `user-service`.

## Quy ước cho docs của user-service

- Tài liệu ở đây nên tập trung vào identity, auth, role, seller và admin domain.
- Nếu đổi token contract, role model hoặc onboarding flow, phải cập nhật docs tương ứng trong cùng task.
