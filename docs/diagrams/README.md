# Tài Liệu Sơ Đồ

Thư mục `docs/diagrams/` chứa các sơ đồ dùng để hỗ trợ đọc kiến trúc và dữ liệu của hệ thống.

## Mục tiêu

Sơ đồ không phải là nguồn sự thật độc lập. Sơ đồ dùng để:

- giúp người mới hiểu nhanh cấu trúc hệ thống,
- hỗ trợ đối chiếu với code và schema,
- mô tả trực quan các boundary hoặc mối quan hệ dữ liệu.

## Danh mục hiện tại

- [COMPONENT_DIAGRAM.md](COMPONENT_DIAGRAM.md): sơ đồ thành phần và kết nối giữa các service.
- [database-diagram/USER_SERVICE.md](database-diagram/USER_SERVICE.md): sơ đồ dữ liệu của `user-service`.

## Quy tắc cập nhật

- Nếu boundary service thay đổi, phải cập nhật lại `COMPONENT_DIAGRAM.md`.
- Nếu schema thay đổi, phải cập nhật diagram liên quan trong cùng task hoặc cùng pull request.
- Sơ đồ phải bám theo code hiện tại, không giữ sơ đồ cũ chỉ để “tham khảo”.

## Quy tắc tổ chức

- Sơ đồ ở mức hệ thống đặt trực tiếp trong `docs/diagrams/`.
- Sơ đồ theo domain hoặc theo database nên tách thư mục con rõ ràng:
  - `database-diagram/`
  - `sequence-diagrams/`
  - `event-flows/`

Nếu sau này số lượng sơ đồ tăng lên, nên tách tiếp theo domain để dễ tìm.
