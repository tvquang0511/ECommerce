# Order Lifecycle và Outbox

Tài liệu này chốt lại rule nghiệp vụ cho `order-subgraph` ở giai đoạn hiện tại, đồng thời giải thích rõ vai trò của `outbox` trong kiến trúc `CQRS + DDD + Event Sourcing`.

Mục tiêu là để sau này khi quay lại code, bạn nhìn vào đây là hiểu ngay:

- order được tạo ra như thế nào
- trạng thái nào được `submit`
- trạng thái nào được `cancel`
- khi nào `FAILED`
- khi nào `CONFIRMED`
- draft có hết hạn hay không
- outbox đang làm gì và sẽ còn phải làm gì tiếp

---

## 1. Trạng thái order hiện có

`OrderStatusEnum` hiện đang có:

- `DRAFT`
- `SUBMITTED`
- `AWAITING_INVENTORY`
- `AWAITING_PAYMENT`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Tuy nhiên, ở code hiện tại aggregate mới đang dùng thực tế các trạng thái sau:

- `DRAFT`
- `SUBMITTED`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Hai trạng thái:

- `AWAITING_INVENTORY`
- `AWAITING_PAYMENT`

hiện mới là trạng thái dự phòng cho phase sau, chưa đi vào flow chính.

---

## 2. Lifecycle nghiệp vụ nên hiểu thế nào

Ở thời điểm hiện tại, lifecycle thực tế của order là:

```text
createOrderDirect / createOrderFromCart
  -> DRAFT

submitOrder
  -> SUBMITTED
  -> inventoryStatus = PENDING
  -> paymentStatus = PENDING

inventory reserved + payment authorized
  -> CONFIRMED

payment failed
  -> FAILED (chuyển tiếp)
  -> CANCELLED (trạng thái cuối hiện tại)

inventory rejected
  -> FAILED (chuyển tiếp)
  -> CANCELLED (trạng thái cuối hiện tại)

buyer/admin cancel
  -> CANCELLED
```

Điểm rất quan trọng:

- `FAILED` hiện có xuất hiện trong aggregate.
- Nhưng với flow `payment failed` và `inventory rejected`, aggregate đang bắn tiếp `OrderCancelledEvent`.
- Vì vậy trạng thái cuối cùng đang được giữ lại là `CANCELLED`, không phải `FAILED`.

Nói ngắn gọn:

- `FAILED` hiện tại là trạng thái trung gian về mặt domain event
- `CANCELLED` mới là trạng thái cuối cùng đang nhìn thấy rõ nhất ở order

Nếu sau này bạn muốn tách bạch hơn, có thể đổi sang:

- lỗi hệ thống hoặc lỗi tích hợp: giữ `FAILED`
- hủy do người dùng hoặc nghiệp vụ: dùng `CANCELLED`

Nhưng ở phase hiện tại, giữ cách đơn giản như bây giờ là ổn để học flow trước.

---

## 3. Rule submit order

### 3.1 Trạng thái nào được submit

Chỉ `DRAFT` mới được phép `submit`.

Rule này đang khớp với code trong aggregate:

- nếu `status !== DRAFT` thì ném lỗi

### 3.2 Ý nghĩa nghiệp vụ

`DRAFT` là đơn nháp:

- buyer đã chọn sản phẩm
- giá đã được snapshot tại thời điểm tạo draft
- nhưng hệ thống chưa bắt đầu workflow mua hàng thật sự

Khi `submitOrder`:

- order chuyển sang `SUBMITTED`
- order bắt đầu bước nghiệp vụ thật
- inventory sẽ cần được giữ hàng
- payment sẽ cần được authorize hoặc capture tùy chiến lược sau này

### 3.3 Trạng thái nào không được submit

Không được submit lại khi order đã là:

- `SUBMITTED`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Lý do:

- tránh double submit
- tránh phát lại side effects sang inventory/payment
- giữ cho command side có tính quyết định rõ ràng

---

## 4. Rule cancel order

### 4.1 Trạng thái nào được cancel

Ở code hiện tại, order được `cancel` nếu chưa ở:

- `CONFIRMED`
- `CANCELLED`

Tức là đang cho phép cancel khi order là:

- `DRAFT`
- `SUBMITTED`
- `FAILED`

### 4.2 Cách hiểu nghiệp vụ nên dùng

Nên chốt rule như sau:

- `DRAFT`: được cancel
- `SUBMITTED`: được cancel nếu hệ thống chưa đi quá xa hoặc chưa khóa nghiệp vụ downstream
- `CONFIRMED`: không được cancel bằng command thông thường nữa
- `CANCELLED`: không cancel lại
- `FAILED`: thường không cần cancel tay nữa nếu flow fail đã tự kết thúc bằng `CANCELLED`

### 4.3 Khuyến nghị thực tế cho phase sau

Khi bạn làm sâu hơn với inventory/payment, nên tách:

- `cancel before confirmation`
- `request cancellation after confirmation`

Vì sau `CONFIRMED`, bài toán không còn là “cancel đơn” nữa mà gần với:

- hoàn tác nghiệp vụ
- refund
- release inventory hoặc reverse shipment

Đó là một use case khác.

---

## 5. Khi nào order chuyển FAILED

### 5.1 Theo code hiện tại

Order được set `FAILED` khi:

- `markPaymentFailed()`
- `markInventoryRejected()`

Tức là khi:

- payment bị từ chối
- inventory không giữ được hàng

### 5.2 Nhưng vì sao cuối cùng lại thành CANCELLED

Sau khi bắn:

- `OrderPaymentFailedEvent`
- hoặc `OrderInventoryRejectedEvent`

aggregate bắn tiếp:

- `OrderCancelledEvent`

Do đó trạng thái cuối cùng hiện tại sẽ là:

- `CANCELLED`

### 5.3 Chốt rule nên ghi nhớ

Ở phase hiện tại:

- `FAILED` dùng để biểu diễn “bước xử lý quan trọng đã thất bại”
- `CANCELLED` là “order này đã kết thúc theo nhánh thất bại”

Nếu nhìn theo business:

- fail là nguyên nhân
- cancelled là kết cục

---

## 6. Khi nào order chuyển CONFIRMED

Order chỉ được `CONFIRMED` khi đồng thời thỏa cả 3 điều kiện:

- `status === SUBMITTED`
- `inventoryStatus === RESERVED`
- `paymentStatus === AUTHORIZED`

Nói cách khác:

- chỉ giữ hàng xong thì chưa đủ
- chỉ authorize payment xong thì cũng chưa đủ
- phải đủ cả hai mới xác nhận order thành công

Đây là rule rất quan trọng vì nó thể hiện đúng tư duy orchestration của order:

- order không tự confirmed chỉ vì buyer bấm submit
- order chỉ confirmed sau khi các điều kiện downstream đã ok

---

## 7. Draft order có expire không

### 7.1 Hiện trạng code

Hiện tại draft order chưa có cơ chế tự expire.

Tức là:

- buyer tạo `DRAFT`
- nếu không submit
- draft vẫn còn trong hệ thống

### 7.2 Có nên expire không

Với đồ án học tập ở phase này, tôi đề xuất:

- chưa cần auto-expire ngay

Lý do:

- flow hiện tại tập trung vào CQRS, event sourcing, outbox
- thêm expiry lúc này sẽ kéo theo cron/job/cleanup/event mới
- dễ làm phân tán trọng tâm học

### 7.3 Rule nghiệp vụ nên chốt cho hiện tại

Chốt tạm thời:

- `DRAFT` không tự expire trong phase hiện tại
- buyer có thể submit sau
- buyer có thể cancel draft

### 7.4 Hướng mở rộng phase sau

Nếu muốn giống thực tế hơn, phase sau có thể thêm:

- `draftExpiresAt`
- job quét draft quá hạn
- `OrderExpiredEvent`
- projector cập nhật read model sang `CANCELLED` hoặc `EXPIRED`

Nếu làm vậy, nên cân nhắc thêm trạng thái mới:

- `EXPIRED`

thay vì dùng chung `CANCELLED`.

---

## 8. Draft order có khóa giá không

Đây là rule nghiệp vụ cần chốt rất rõ để tránh mâu thuẫn giữa `cart`, `draft order` và `submitOrder`.

### 8.1 Câu trả lời ngắn gọn

Không.

`DRAFT` **không khóa giá**.

Nó chỉ lưu snapshot tại thời điểm buyer tạo nháp để:

- hiển thị lại đơn cho buyer
- phục vụ audit
- giúp aggregate/read model biết buyer đã nhìn thấy gì ở thời điểm đó

Nhưng snapshot trong `DRAFT` không phải cam kết giá cuối cùng.

### 8.2 Giá nào mới là giá chính thức

Giá chính thức của giao dịch phải được chốt ở lúc `submitOrder`.

Tức là:

- `createOrderDirect` và `createOrderFromCart` có thể tạo `DRAFT`
- nhưng khi buyer bấm `submit`
- order-service phải đọc lại `product` hiện tại
- re-check lại trạng thái sản phẩm
- re-check lại seller
- re-check lại giá
- re-calculate lại total

Rồi mới cho order đi tiếp sang `SUBMITTED`.

### 8.3 Vì sao phải làm như vậy

Vì trong hệ thống thực tế:

- giá product có thể đổi liên tục
- product có thể bị ẩn, archived, rejected
- seller có thể cập nhật media, tên, giá hoặc trạng thái bán

Nếu khóa giá ngay từ `DRAFT` mà không có expiry hoặc reservation thật, buyer có thể:

- tạo draft ở giá cũ
- quay lại rất lâu sau
- submit với dữ liệu đã lỗi thời

Điều đó không phù hợp với e-commerce thông thường.

### 8.4 Cách hiểu đúng cho 3 lớp dữ liệu

- `cart snapshot`: dữ liệu UX, chỉ để hiển thị nhanh
- `draft order snapshot`: ảnh chụp nghiệp vụ để buyer xem lại ý định mua
- `submitOrder`: thời điểm chốt giá thật và xác nhận giao dịch thật

### 8.5 Rule nên chốt cho phase hiện tại

- `cart` không phải nguồn giá chính thức
- `DRAFT` không phải cam kết giá
- `submitOrder` luôn phải re-price
- nếu dữ liệu product thay đổi thì phải dùng dữ liệu mới nhất

### 8.6 Ví dụ nghiệp vụ

Ví dụ:

- 10:00 buyer tạo `DRAFT` với giá sản phẩm là `1.200.000`
- 10:30 seller giảm giá xuống `1.050.000`
- 10:35 buyer quay lại bấm `submitOrder`

Hành vi đúng nên là:

- order-service đọc lại product hiện tại
- thấy giá mới là `1.050.000`
- cập nhật lại snapshot/total trước khi submit
- order đi tiếp với giá mới

Nói cách khác:

- draft cũ vẫn còn giá cũ để audit là buyer từng thấy gì
- nhưng giao dịch thật phải đi theo giá mới tại lúc submit

---

## 9. Rule cart khi tạo order từ cart

Rule đã chốt theo hướng an toàn UX:

- buyer được chọn `selectedItemIds`
- `createOrderFromCart` chỉ lấy các item đã chọn
- cart không bị xóa ngay lúc tạo draft
- chỉ khi `submitOrder` thành công mới xóa các item đã chọn khỏi cart
- nếu `submitOrder` fail thì cart vẫn giữ nguyên

Ý nghĩa:

- draft order chỉ là “bản nháp giao dịch”
- chưa nên làm mất dữ liệu giỏ hàng của người dùng quá sớm

---

## 10. Submit order phải re-price như thế nào

`submitOrder` không nên chỉ làm việc “đổi status từ `DRAFT` sang `SUBMITTED`”.

Về nghiệp vụ, `submitOrder` phải được hiểu là:

- bước xác nhận cuối cùng trước khi hệ thống bắt đầu workflow mua bán thật

Vì vậy lúc này cần:

1. Nạp lại order aggregate từ event store.
2. Kiểm tra order còn đang là `DRAFT`.
3. Đọc lại toàn bộ product hiện tại theo `productId` của từng line.
4. Kiểm tra từng product còn hợp lệ để bán.
5. Tính lại `unitPrice`, `lineTotal`, `orderTotal`.
6. So sánh snapshot cũ với snapshot mới.
7. Cập nhật order bằng event reprice nếu có thay đổi.
8. Chỉ sau đó mới bắn `OrderSubmittedEvent`.

Nếu không làm bước re-price ở đây, hệ thống sẽ ngầm coi `DRAFT` là một kiểu giữ giá, trong khi thực tế ta chưa hề có cơ chế giữ giá hoặc expiry tương ứng.

---

## 11. Outbox là gì trong bài toán này

Outbox là một bảng trung gian dùng để lưu các integration event mà order-service muốn gửi ra ngoài.

Ở đây cần phân biệt 2 loại event:

### 9.1 Domain event

Ví dụ:

- `OrderCreatedFromCartEvent`
- `OrderSubmittedEvent`
- `OrderPaymentFailedEvent`

Đây là event nội bộ của domain.

Nó giúp:

- aggregate đổi state
- projector cập nhật read model
- handler nội bộ phản ứng tiếp

### 9.2 Integration event

Ví dụ:

- `order.submitted`
- sau này có thể là `order.confirmed`
- hoặc `inventory.reservation.requested`
- hoặc `payment.requested`

Đây là event mang tính giao tiếp giữa service với service.

Outbox tồn tại để phục vụ nhóm event này.

---

## 12. Outbox đang làm gì ở code hiện tại

Flow hiện tại là:

```text
CommandHandler
  -> append event vào event store
  -> publish domain event nội bộ qua EventBus

EventHandler kiểu outbox
  -> ghi 1 bản ghi vào bảng order_outbox

OrderOutboxWorker
  -> đọc các dòng chưa publish
  -> gọi InventoryPublisher / PaymentPublisher
  -> publish thành công thì mark publishedAt
  -> publish lỗi thì tăng retryCount
```

Trong code hiện tại:

- `OrderSubmittedOutboxHandler`
  - ghi `order.submitted` vào outbox

- `OrderCreatedFromCartOutboxHandler`
  - ghi `order.created-from-cart` vào outbox

- `OrderOutboxWorker`
  - đọc pending rows
  - nếu là `order.submitted`
    - gọi `InventoryPublisherService.publishReservationRequested(orderId)`
    - gọi `PaymentPublisherService.publishPaymentRequested(orderId)`
  - nếu publish lỗi
    - tăng `retryCount`

Nói ngắn gọn:

- outbox chưa phải là nơi “xử lý nghiệp vụ chính”
- outbox là nơi “đảm bảo việc gửi side effect ra ngoài không bị quên”

---

## 13. Vì sao phải cần outbox

Nếu không có outbox, bạn sẽ rất dễ gặp tình huống:

```text
submitOrder
  -> lưu event store thành công
  -> chuẩn bị gọi RabbitMQ
  -> service chết ngang
```

Kết quả:

- order đã thành `SUBMITTED`
- nhưng inventory/payment không nhận được yêu cầu
- hệ thống lệch trạng thái

Outbox giải quyết bằng cách:

- trước hết lưu ý định publish vào database
- worker sẽ publish lại sau
- nếu lỗi tạm thời, vẫn còn bản ghi để retry

Đây chính là tư duy:

- local transaction trước
- external publish sau
- chấp nhận `eventual consistency`

---

## 14. Outbox không đảm bảo điều gì

Outbox không làm cho hệ thống thành “exactly once” tuyệt đối.

Thứ outbox thường giúp bạn đạt được là:

- không làm mất integration event
- retry được
- dễ audit
- hỗ trợ at-least-once delivery

Vì vậy downstream consumer vẫn nên idempotent.

Ví dụ:

- inventory nhận lại cùng một `reservation requested` hai lần
- thì nên nhận ra đó là cùng một order, không giữ hàng hai lần

---

## 15. Các công việc thực tế của outbox trong phase tiếp theo

Outbox của order nên tiếp tục gánh các việc sau:

### 13.1 Phát yêu cầu sang inventory

Ví dụ:

- `inventory.reservation.requested`

Mục tiêu:

- nhờ inventory service giữ hàng cho order

### 13.2 Phát yêu cầu sang payment

Ví dụ:

- `payment.authorization.requested`
- hoặc `payment.session.requested`

Mục tiêu:

- bắt đầu workflow thanh toán

### 13.3 Phát event business đã xác nhận

Ví dụ:

- `order.confirmed`

Mục tiêu:

- cho notification
- cho analytics
- cho shipment phase sau

### 13.4 Phát event thất bại hoặc hủy

Ví dụ:

- `order.cancelled`
- `order.failed`

Mục tiêu:

- giải phóng tài nguyên downstream
- gửi thông báo cho buyer

### 13.5 Retry và quan sát vận hành

Outbox còn giúp:

- biết event nào chưa publish
- biết event nào publish lỗi
- đếm retry
- về sau thêm dead-letter hoặc manual replay

---

## 16. Chốt rule đề xuất cho phase hiện tại

Để tránh lan quá rộng, tôi đề xuất chốt như sau:

- `submit`: chỉ `DRAFT` mới được submit
- `submit`: luôn re-price lại từ `product` trước khi chuyển sang `SUBMITTED`
- `cancel`: cho `DRAFT` và `SUBMITTED`; không cho `CONFIRMED`, `CANCELLED`
- `FAILED`: dùng như trạng thái lỗi trung gian ở aggregate
- `CONFIRMED`: chỉ khi inventory reserved và payment authorized đều xong
- `draft expire`: chưa làm ở phase hiện tại
- `draft pricing`: không khóa giá
- `cart cleanup`: chỉ xóa các `selectedItemIds` sau `submitOrder` thành công
- `outbox`: dùng để đảm bảo gửi integration side effects sang inventory/payment một cách retryable

---

## 17. Hướng triển khai tiếp theo nên làm

Sau khi chốt lifecycle này, thứ tự hợp lý là:

1. Chuẩn hóa lại docs/test case theo đúng lifecycle vừa chốt.
2. Hoàn thiện outbox message contract rõ ràng hơn thay vì chỉ `order.submitted`.
3. Làm callback flow từ inventory/payment quay ngược về order.
4. Tách rõ hơn `FAILED` và `CANCELLED` nếu bạn muốn semantics business sạch hơn.
5. Chỉ sau đó mới cân nhắc draft expiry hoặc saga sâu hơn.
