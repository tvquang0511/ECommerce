# Commit Convention

## 1. Mục tiêu

Commit message phải giúp người đọc hiểu nhanh:

- thay đổi thuộc loại gì,
- thay đổi vào khu vực nào,
- mục tiêu của thay đổi là gì.

## 2. Format gợi ý

```text
<type>: <short summary>
```

Ví dụ:

- `feat: add order outbox worker`
- `fix: prevent duplicate payment authorization callback`
- `docs: add backend status report`
- `refactor: simplify product auth guards`

## 3. Các type nên dùng

- `feat`: thêm tính năng
- `fix`: sửa lỗi
- `refactor`: tái cấu trúc nhưng không đổi behavior chính
- `docs`: cập nhật tài liệu
- `test`: thêm hoặc sửa test
- `chore`: thay đổi phụ trợ như script, config, tooling
- `build`: thay đổi liên quan build hoặc dependency
- `ci`: thay đổi workflow CI/CD

## 4. Có thể thêm scope nếu muốn

```text
<type>(<scope>): <short summary>
```

Ví dụ:

- `feat(order): add createOrderDirect flow`
- `fix(user): repair prisma client import`
- `docs(product): add product test guide`

## 5. Quy tắc viết summary

- Viết ngắn gọn.
- Dùng động từ rõ nghĩa.
- Không viết mơ hồ kiểu `update code`, `fix stuff`, `change file`.

## 6. Ví dụ tốt

- `feat(order): add repricing during submit flow`
- `fix(payment): handle callback retry safely`
- `docs: standardize repository documentation layout`
- `ci: add backend lint and build workflow`

## 7. Ví dụ không nên dùng

- `update`
- `fix`
- `code`
- `done`
- `final`

## 8. Quy tắc thực dụng cho repo này

Với thay đổi lớn, bạn nên ưu tiên chia commit theo cụm sau:

1. schema/migration
2. application logic
3. docs/test

Cách chia này giúp review dễ hơn rất nhiều.
