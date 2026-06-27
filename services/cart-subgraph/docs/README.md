# cart-subgraph Docs

Thư mục này chứa tài liệu riêng của `cart-subgraph`.

## Mục tiêu của service

`cart-subgraph` quản lý giỏ hàng cho buyer đã đăng nhập và là bước trung gian trước khi tạo order.

## Tài liệu hiện có

- [../README.md](../README.md): giới thiệu service, runtime và cấu trúc chính.
- [CART_TEST_GUIDE.md](CART_TEST_GUIDE.md): hướng dẫn test buyer flow end-to-end từ product sang cart.

## Quy ước nghiệp vụ hiện tại

- Không hỗ trợ guest cart.
- Không còn flow `mergeCart`.
- Chỉ cho thêm sản phẩm ở trạng thái `APPROVED`.
- Cart giữ snapshot hiển thị, nhưng không phải nguồn sự thật cuối cùng cho giá khi submit order.

## Khi nào thêm tài liệu mới

Đặt tài liệu mới vào đây nếu nó chỉ áp dụng cho `cart-subgraph`, ví dụ:

- rule nghiệp vụ cart,
- test guide,
- integration note với order,
- redesign cache hoặc Redis model.
