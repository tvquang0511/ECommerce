# Pull Request Checklist

Tài liệu này là checklist logic cho pull request. Nếu sau này bạn muốn GitHub dùng tự động, hãy chuyển checklist này sang `.github/PULL_REQUEST_TEMPLATE.md`.

## Checklist trước khi mở PR

- [ ] Thay đổi có mục tiêu rõ ràng
- [ ] Không trộn quá nhiều việc không liên quan
- [ ] Đã chạy lint/typecheck/test cần thiết
- [ ] Đã cập nhật docs nếu flow hoặc contract thay đổi
- [ ] Đã ghi rõ cách test tay nếu đây là thay đổi lớn
- [ ] Đã rà lại env, migration, seed nếu có tác động

## Checklist khi mô tả PR

- [ ] Có phần “mục tiêu thay đổi”
- [ ] Có phần “các thay đổi chính”
- [ ] Có phần “cách test”
- [ ] Có phần “rủi ro hoặc tác động”

## Checklist riêng cho microservices

- [ ] Có ảnh hưởng contract giữa service không
- [ ] Có ảnh hưởng message/event payload không
- [ ] Có ảnh hưởng schema/database không
- [ ] Có cần cập nhật Docker Compose hoặc env không
