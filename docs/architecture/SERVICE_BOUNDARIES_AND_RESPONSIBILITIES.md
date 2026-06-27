# Service Boundaries And Responsibilities

## 1. Mục tiêu

Tài liệu này mô tả trách nhiệm của từng service, subgraph và worker trong hệ thống để tránh chồng chéo domain khi dự án tiếp tục mở rộng.

## 2. Phạm vi

Tài liệu này trả lời:

- service nào sở hữu domain nào,
- service nào được phép lưu dữ liệu nào,
- service nào chỉ nên tích hợp chứ không sở hữu business logic đó,
- boundary nào cần giữ vững.

## 3. Quy ước từ ngữ

- **Service**: REST internal service, ví dụ `inventory-service`, `payment-service`
- **Subgraph**: GraphQL Federation subgraph, ví dụ `product-subgraph`, `cart-subgraph`, `order-subgraph`
- **Worker**: tiến trình nền xử lý queue hoặc side effect

## 4. Trách nhiệm theo service

### `user-service`

Sở hữu:

- identity,
- auth,
- session,
- seller onboarding,
- admin domain cơ bản.

Không nên sở hữu:

- product catalog,
- cart state,
- order lifecycle.

### `product-subgraph`

Sở hữu:

- product catalog,
- product status,
- seller ownership của product,
- product moderation flow.

Không nên sở hữu:

- cart state,
- order transaction,
- auth source of truth.

### `cart-subgraph`

Sở hữu:

- buyer cart,
- cart item snapshot phục vụ UX,
- thao tác add/update/remove/clear cart.

Không nên sở hữu:

- giá cuối cùng của order,
- inventory truth,
- payment logic.

### `order-subgraph`

Sở hữu:

- order aggregate,
- order event store,
- read model/projection,
- order lifecycle,
- outbox cho integration event.

Không nên sở hữu:

- product catalog gốc,
- user identity gốc,
- inventory source of truth,
- payment source of truth.

### `inventory-service`

Hiện tại chỉ nên sở hữu:

- stock state cơ bản phục vụ demo,
- reserve/reject callback flow cho order.

### `payment-service`

Hiện tại chỉ nên sở hữu:

- payment authorization result ở mức mock,
- callback/event flow về order.

### `notification-worker`

Nên chỉ làm:

- consume event,
- gửi notification hoặc side effect nền,
- không chứa core business logic.

## 5. Boundary tích hợp quan trọng

### `user-service` -> các service khác

- cung cấp token và auth context
- downstream service tự áp authorization theo domain

### `product-subgraph` <-> `cart-subgraph`

- cart lấy snapshot sản phẩm để phục vụ hiển thị

### `cart-subgraph` -> `order-subgraph`

- order có thể tạo từ các item đã chọn trong cart
- cart không quyết định giá cuối cùng khi submit order

### `order-subgraph` -> `inventory-service` / `payment-service`

- giao tiếp theo hướng event-driven + callback
- order vẫn là nơi chốt trạng thái giao dịch

## 6. Quy tắc khi thêm tính năng mới

Khi chuẩn bị thêm một feature, hãy hỏi trước:

1. domain này thuộc service nào,
2. dữ liệu gốc nên nằm ở đâu,
3. service khác có thật sự cần sở hữu logic này không,
4. nên tích hợp sync hay async.

## 7. Việc tiếp theo

- Rà lại các docs riêng của service để bảo đảm boundary ở đây không bị mâu thuẫn
- Khi mở rộng order, payment hoặc inventory, luôn kiểm tra lại boundary trước khi code
