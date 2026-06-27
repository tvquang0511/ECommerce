# Order Communication Boundaries

## 1. Mục tiêu

Tài liệu này chốt cách `order-subgraph` giao tiếp với các service khác trong kiến trúc hiện tại của đồ án.

Mục tiêu là trả lời rõ 3 câu hỏi:

- Khi nào `order` nên gọi trực tiếp sang service khác
- Khi nào `order` nên giao tiếp bất đồng bộ qua `outbox + RabbitMQ`
- Vì sao project này chọn `order` làm entrypoint của flow checkout thay vì bắt đầu từ `cart` phát event sang `order`

## 2. Phạm vi

Tài liệu này áp dụng cho các tương tác giữa:

- `order-subgraph`
- `product-subgraph`
- `cart-subgraph`
- `inventory-service`
- `payment-service`

Tài liệu này không bàn sâu về frontend, gateway hay UI checkout.

## 3. Quyết định kiến trúc chính

### 3.1. Quy tắc tổng quát

Trong project này, ta dùng nguyên tắc:

- `direct call` cho nhu cầu đọc dữ liệu đồng bộ
- `event-driven` cho workflow liên service có tính bất đồng bộ, retry và eventual consistency

Nói ngắn gọn:

- cần dữ liệu ngay để xử lý command hiện tại thì gọi trực tiếp
- cần kích hoạt tiến trình hậu xử lý liên service thì phát event

### 3.2. Quyết định entrypoint

Project này chọn:

- client gọi trực tiếp vào `order-subgraph` để tạo order

Cụ thể:

- `createOrderDirect`
- `createOrderFromCart`
- `submitOrder`

`cart-subgraph` không phải là service bắt đầu workflow checkout chính bằng event trong phiên bản hiện tại.

## 4. Phân loại từng hướng giao tiếp

### 4.1. `cart -> product`

`cart-subgraph` được phép gọi trực tiếp sang `product-subgraph` khi cần:

- lấy thông tin sản phẩm để hiển thị
- kiểm tra sản phẩm có còn bán được hay không
- chụp snapshot title, image, price để hiển thị trong cart

Lý do:

- đây là read dependency
- cart không điều phối workflow liên service dài hạn
- dữ liệu cần phản hồi ngay cho người dùng

### 4.2. `order -> product`

`order-subgraph` được phép gọi trực tiếp sang `product-subgraph` khi:

- tạo order trực tiếp từ trang sản phẩm
- re-check lại dữ liệu sản phẩm trước khi submit
- lấy giá chính thức tại thời điểm business cần xác nhận

Lý do:

- `product` là nguồn dữ liệu catalog
- `order` cần dựng snapshot của order từ dữ liệu hiện tại
- đây là phần đọc dữ liệu để ra quyết định trong command

### 4.3. `order -> cart`

`order-subgraph` được phép gọi trực tiếp sang `cart-subgraph` khi:

- tạo order từ cart
- lấy các item đã chọn trong cart
- sau này xóa đúng các item đã submit thành công

Lý do:

- `cart` là trạng thái tạm của người dùng
- `order` chỉ cần đọc đúng phần cart hiện tại để dựng draft
- đây chưa phải distributed workflow chính

Lưu ý:

- snapshot trong cart chỉ phục vụ UX
- giá cuối cùng của order không nên mặc định tin tuyệt đối từ snapshot của cart
- trước khi submit cần re-check lại giá và availability từ nguồn chính thức

### 4.4. `order -> inventory`

`order-subgraph` không nên gọi trực tiếp `inventory-service` ở bước hậu submit.

Project này chọn:

- `order` ghi `outbox`
- `outbox worker` publish message qua RabbitMQ
- `inventory-service` consume message
- `inventory-service` callback ngược về `order`

Lý do:

- reserve inventory là bước xử lý hậu submit
- có thể thất bại, retry hoặc xử lý chậm
- cần mô phỏng event-driven workflow đúng tinh thần khóa học

### 4.5. `order -> payment`

`order-subgraph` không nên gọi trực tiếp `payment-service` ở bước hậu submit.

Project này chọn:

- `order` ghi `outbox`
- worker publish message qua RabbitMQ
- `payment-service` consume message
- `payment-service` callback kết quả về `order`

Lý do:

- đây là tiến trình side effect ngoài boundary của order
- phù hợp với eventual consistency
- cũng là chỗ tốt để sau này thay `payment-service` bằng service học blockchain

## 5. Vì sao không bắt đầu từ cart phát event sang order

Trong nhiều khóa học microservices, flow thường là:

1. client gọi `basket/cart`
2. `basket` publish `BasketCheckoutRequested`
3. `order` consume event
4. `order` tạo order
5. `order` tiếp tục fanout event

Đây là một thiết kế hợp lệ, nhưng không phải lựa chọn tối ưu nhất cho project hiện tại.

### 5.1. Điểm hợp lý của cách làm trong khóa học

Cách đó phù hợp khi:

- checkout luôn bắt đầu từ basket
- không có flow buy-now trực tiếp từ product
- muốn nhấn mạnh event-driven từ entrypoint đầu tiên
- muốn basket là nơi nắm trạng thái checkout

### 5.2. Vì sao project này chưa chọn cách đó

Project hiện tại có cả:

- `createOrderDirect`
- `createOrderFromCart`

Nếu ép mọi thứ đi qua `cart` event trước, sẽ phát sinh:

- flow buy-now bị gượng ép
- khó test tay hơn
- debug khó hơn
- boundary của `cart` trở nên quá lớn
- `order` bị lệ thuộc vào event khởi tạo từ service khác ngay từ bước đầu

Vì vậy, thiết kế hiện tại chọn:

- `order` là entrypoint của purchase intent
- `cart` chỉ là nguồn dữ liệu hỗ trợ cho một biến thể tạo order

## 6. Boundary nghiệp vụ được chốt

### 6.1. Product

`product-subgraph` chịu trách nhiệm:

- catalog
- giá đang publish
- trạng thái hiển thị
- thông tin sản phẩm phục vụ browse và order snapshot

`product` không phải nơi finalize inventory reservation.

### 6.2. Cart

`cart-subgraph` chịu trách nhiệm:

- giữ item tạm của user
- cho phép chọn item nào sẽ đem đi checkout
- lưu snapshot để hiển thị UX

`cart` không phải nguồn sự thật cuối cùng cho giá order.

### 6.3. Order

`order-subgraph` chịu trách nhiệm:

- nhận purchase intent
- tạo draft order
- chụp order snapshot
- re-check dữ liệu quan trọng trước submit
- điều phối workflow sau submit qua outbox

`order` là nơi sở hữu trạng thái order chính thức.

### 6.4. Inventory

`inventory-service` chịu trách nhiệm:

- quyết định có reserve được stock hay không
- phản hồi `reserved` hoặc `rejected`

### 6.5. Payment

`payment-service` chịu trách nhiệm:

- quyết định authorize thanh toán thành công hay thất bại
- callback trạng thái về `order`

## 7. Flow chuẩn được khuyến nghị

### 7.1. Create order direct

1. client gọi `createOrderDirect`
2. `order` gọi trực tiếp sang `product`
3. `order` tạo draft + lưu event store + cập nhật read model
4. client nhận `orderId`

### 7.2. Create order from cart

1. client gọi `createOrderFromCart`
2. `order` gọi trực tiếp sang `cart` để lấy selected items
3. `order` có thể gọi thêm `product` nếu cần đối chiếu dữ liệu hiện tại
4. `order` tạo draft + lưu event store + cập nhật read model
5. client nhận `orderId`

### 7.3. Submit order

1. client gọi `submitOrder`
2. `order` rehydrate aggregate
3. `order` re-check giá và availability cần thiết
4. `order` append event vào event store
5. `order` ghi message vào outbox
6. `outbox worker` publish sang RabbitMQ
7. `inventory` và `payment` consume message
8. mỗi service callback ngược về `order`
9. `order` cập nhật event store + projector + read model đến trạng thái cuối

## 8. Trade-off và giới hạn hiện tại

### 8.1. Ưu điểm

- dễ test tay
- boundary rõ ràng
- hỗ trợ tốt cả `buy now` lẫn `checkout from cart`
- phần event-driven tập trung đúng vào chỗ có giá trị học tập cao nhất
- không ép mọi giao tiếp liên service phải thành event

### 8.2. Giới hạn

- `order` vẫn phụ thuộc trực tiếp vào khả năng đọc của `product` và `cart`
- nếu upstream read service chậm, create order sẽ bị ảnh hưởng
- chưa mô phỏng một flow event-driven hoàn toàn từ đầu vào checkout

### 8.3. Kết luận về trade-off

Đây là trade-off chấp nhận được cho đồ án hiện tại vì:

- mục tiêu chính là học sâu `CQRS + DDD + Event Sourcing + Outbox`
- không cần tối đa hóa độ phức tạp ở entrypoint checkout
- cần giữ flow đủ rõ để demo và giải thích trong báo cáo

## 9. Khi nào nên nâng cấp sang cart checkout event-first

Chỉ nên chuyển sang hướng:

- `cart checkout requested -> event -> order`

khi có một trong các nhu cầu sau:

- muốn basket/cart trở thành checkout service thực thụ
- toàn bộ flow mua hàng luôn đi qua cart
- cần workflow event-driven từ ngay entrypoint đầu tiên
- muốn nghiên cứu sâu hơn choreography giữa nhiều service

Trong giai đoạn hiện tại, chưa cần chuyển.

## 10. Việc tiếp theo

- giữ `createOrderDirect` và `createOrderFromCart` là command đi thẳng vào `order`
- tiếp tục hoàn thiện `submitOrder` như điểm bắt đầu distributed workflow
- hoàn thiện message contract giữa `order`, `inventory`, `payment`
- chỉ cân nhắc flow `cart checkout event-first` như một phase mở rộng sau này
