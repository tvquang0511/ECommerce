# Thiết Kế Outbox Cho `order-subgraph`

Tài liệu này chốt lại thiết kế `outbox` cho `order-subgraph` theo hướng:

- phù hợp với `CQRS + DDD + Event Sourcing`
- đủ thực tế để hiểu bài toán microservices
- đủ gọn để implement từng phase trong đồ án học tập

Mục tiêu là để sau này khi bạn quay lại làm `inventory`, `payment`, `notification` hoặc `shipment`, bạn vẫn hiểu rõ:

- outbox sinh ra để giải quyết vấn đề gì
- outbox khác event store ở đâu
- khi nào ghi outbox
- worker publish cái gì
- callback từ downstream nên quay ngược về order thế nào

---

## 1. Outbox là gì trong bài toán này

Outbox là một cơ chế lưu lại các **integration event cần gửi ra ngoài service** sau khi write side của order đã commit thành công.

Trong `order-subgraph`, outbox không phải nơi lưu business truth gốc. Business truth gốc vẫn là:

- `event store` cho write history
- `read model` cho query side

Outbox chỉ là lớp trung gian để giải quyết việc:

- order đã commit thành công
- nhưng việc publish message ra RabbitMQ hoặc sang service khác có thể lỗi

Nói ngắn gọn:

- event store trả lời câu hỏi: "order đã trải qua những event gì?"
- outbox trả lời câu hỏi: "service còn nợ phải gửi những integration message nào ra ngoài?"

---

## 2. Vấn đề mà outbox giải quyết

Giả sử không có outbox, flow `submitOrder` có thể là:

```text
submitOrder
  -> append OrderSubmittedEvent vào event store
  -> gọi RabbitMQ để gửi inventory request
  -> gọi RabbitMQ để gửi payment request
```

Nếu ngay sau khi append event store xong mà service chết trước lúc publish RabbitMQ thì chuyện gì xảy ra:

- order đã là `SUBMITTED`
- read model có thể đã update
- nhưng inventory không nhận được yêu cầu giữ hàng
- payment không nhận được yêu cầu authorize

Kết quả:

- trạng thái hệ thống bị lệch
- order như đang chạy nhưng downstream không biết gì

Outbox được đưa vào để chặn đúng lỗ hổng này.

Flow đúng là:

```text
submitOrder
  -> append event store
  -> ghi integration intent vào order_outbox
  -> worker publish sau
```

Nếu publish lỗi:

- record vẫn còn trong `order_outbox`
- worker có thể retry lại

---

## 3. Outbox khác gì với event store

Đây là chỗ rất dễ nhầm.

### 3.1 Event store

Event store lưu:

- `OrderCreatedFromCart`
- `OrderRepriced`
- `OrderSubmitted`
- `OrderPaymentAuthorized`
- `OrderConfirmed`

Đây là **domain event nội bộ** của order.

Chúng phục vụ:

- rehydrate aggregate
- replay lịch sử
- audit business flow
- projector dựng read model

### 3.2 Outbox

Outbox lưu:

- `order.submitted`
- sau này có thể là `inventory.reservation.requested`
- `payment.authorization.requested`
- `order.confirmed`
- `order.cancelled`

Đây là **integration message** để giao tiếp giữa service với service.

Chúng phục vụ:

- worker publish RabbitMQ
- retry khi publish lỗi
- quan sát message nào còn pending

### 3.3 Cách nhớ ngắn

- event store = lịch sử nghiệp vụ của order
- outbox = hàng đợi message outbound chưa gửi hoặc đã gửi

---

## 4. Hai loại event trong order

Thiết kế order của bạn nên phân biệt rất rõ hai lớp:

### 4.1 Domain event

Ví dụ:

- `OrderCreatedDirectEvent`
- `OrderCreatedFromCartEvent`
- `OrderRepricedEvent`
- `OrderSubmittedEvent`
- `OrderInventoryReservedEvent`
- `OrderPaymentFailedEvent`

Đây là event chạy bên trong order-service.

Chúng dùng cho:

- aggregate
- projector
- event-sourced history
- outbox handler nội bộ

### 4.2 Integration event

Ví dụ:

- `order.submitted`
- `inventory.reservation.requested`
- `payment.authorization.requested`
- `order.confirmed`

Đây là message mà service khác sẽ tiêu thụ.

Chúng không cần phải là class domain event. Chúng có thể chỉ là:

- một record trong outbox
- rồi được worker map thành payload publish ra broker

---

## 5. Flow outbox tổng quát

Flow chuẩn cho order nên là:

```text
Command
  -> CommandHandler
  -> Aggregate sinh domain events
  -> append event store
  -> EventBus.publishAll(domain events)

Event handler kiểu outbox
  -> chuyển domain event thành outbox entry
  -> ghi vào bảng order_outbox

Outbox worker
  -> đọc pending entries
  -> publish sang RabbitMQ hoặc integration adapter
  -> thành công thì mark publishedAt
  -> lỗi thì increment retryCount
```

Điểm quan trọng:

- command handler không publish RabbitMQ trực tiếp
- command handler chỉ append event store + publish domain event nội bộ
- outbox handler mới là nơi tạo “ý định publish ra ngoài”

---

## 6. Thiết kế hiện tại trong code

Hiện tại code của bạn đang có:

### 6.1 `OrderOutboxRepo`

Chịu trách nhiệm:

- `enqueue(...)`
- `listPending(...)`
- `markPublished(...)`
- `incrementRetryCount(...)`

Đây là abstraction quản lý bảng `order_outbox`.

### 6.2 `OrderSubmittedOutboxHandler`

Nghe `OrderSubmittedEvent` và ghi ra outbox:

- `eventType = order.submitted`
- payload hiện tại tối thiểu là `orderId`

### 6.3 `OrderCreatedFromCartOutboxHandler`

Nghe `OrderCreatedFromCartEvent` và ghi ra outbox:

- `eventType = order.created-from-cart`
- payload có `orderId`, `buyerId`, `items`, `sellerIds`, `totalAmount`, `currency`, `cartId`, `selectedItemIds`

### 6.4 `OrderOutboxWorker`

Đang làm:

- đọc pending rows
- nếu `eventType === order.submitted`
  - gọi `InventoryPublisherService.publishReservationRequested(orderId)`
  - gọi `PaymentPublisherService.publishPaymentRequested(orderId)`
- nếu thành công:
  - `markPublished`
- nếu lỗi:
  - `incrementRetryCount`

### 6.5 Điều này nghĩa là gì

Nghĩa là hiện tại bạn đang dùng:

- `order.submitted` như một integration intent cấp cao
- worker sẽ fan-out sang inventory và payment

Đây là một lựa chọn hoàn toàn ổn cho phase đầu.

---

## 7. Hướng thiết kế message contract

Để code dễ hiểu hơn, nên chốt message contract theo 2 tầng.

### 7.1 Tầng 1: outbox event nội bộ cấp service

Ví dụ:

- `order.submitted`
- `order.confirmed`
- `order.cancelled`

Đây là thứ được lưu trong bảng `order_outbox`.

### 7.2 Tầng 2: downstream integration message thực tế

Từ `order.submitted`, worker có thể phát tiếp:

- `inventory.reservation.requested`
- `payment.authorization.requested`

Nói cách khác:

- outbox event là “service-level intent”
- broker message là “message gửi cho bounded context khác”

Thiết kế này hợp lý vì:

- order-service không bị lộ quá nhiều chi tiết tích hợp ra command handler
- worker có quyền orchestration outbound

---

## 8. Payload tối thiểu nên có

Tôi khuyên bạn chuẩn hóa payload như sau.

### 8.1 `order.submitted`

Nên có:

- `orderId`
- `buyerId`
- `sellerIds`
- `items`
- `totalAmount`
- `currency`
- `submittedAt`

Lý do:

- worker hoặc downstream có thể đủ dữ liệu tối thiểu để quyết định publish
- debug/audit dễ hơn nhiều so với chỉ có `orderId`

### 8.2 `inventory.reservation.requested`

Nên có:

- `messageId`
- `correlationId`
- `orderId`
- `items`
- `requestedAt`

Trong đó mỗi item nên có:

- `productId`
- `sellerId`
- `quantity`

### 8.3 `payment.authorization.requested`

Nên có:

- `messageId`
- `correlationId`
- `orderId`
- `buyerId`
- `totalAmount`
- `currency`
- `requestedAt`

### 8.4 `order.confirmed`

Nên có:

- `messageId`
- `correlationId`
- `orderId`
- `buyerId`
- `sellerIds`
- `totalAmount`
- `currency`
- `confirmedAt`

---

## 9. Metadata và headers nên có

Outbox entry nên giữ cả `payload` lẫn `headers`.

Headers nên chuẩn hóa dần theo hướng sau:

- `messageId`
- `correlationId`
- `causationId`
- `aggregateId`
- `aggregateType`
- `eventType`
- `occurredAt`

### 9.1 Ý nghĩa từng field

- `messageId`: id riêng của message để consumer idempotent
- `correlationId`: nối toàn bộ flow của cùng một order
- `causationId`: biết message này sinh ra từ event nào
- `aggregateId`: thường là `orderId`
- `aggregateType`: ở đây là `order`
- `eventType`: loại integration event
- `occurredAt`: thời điểm message được tạo

### 9.2 Vì sao cần metadata

Vì về sau khi debug event-driven system, bạn sẽ rất cần trả lời:

- message này từ đâu ra
- nó liên quan đến command nào
- nó thuộc order nào
- vì sao inventory nhận được message này

---

## 10. Worker nên hoạt động thế nào

`OrderOutboxWorker` nên là một thành phần rất đơn giản nhưng đáng tin.

### 10.1 Trách nhiệm chính

- lấy các row `publishedAt = null`
- xử lý theo thứ tự `createdAt asc`
- publish từng row
- đánh dấu thành công/thất bại

### 10.2 Không nên làm gì

Worker không nên:

- tự sửa aggregate state
- tự ghi event store
- tự quyết định business rule phức tạp

Worker chỉ nên:

- chuyển outbox entry thành outbound message
- đẩy ra integration adapter

### 10.3 Hành vi khi publish lỗi

Nếu publish lỗi:

- giữ nguyên `publishedAt = null`
- tăng `retryCount`
- log chi tiết lỗi

Về sau có thể thêm:

- `lastError`
- `nextRetryAt`
- `deadLetteredAt`

Nhưng phase này chưa cần làm hết.

---

## 11. Tại sao worker không publish trực tiếp trong command handler

Vì nếu làm vậy, bạn quay lại đúng vấn đề cũ:

- event store append xong
- publish lỗi
- state trong DB và state ngoài broker lệch nhau

Command handler nên kết thúc ở mức:

- state nội bộ đã commit
- integration intent đã được ghi lại bền vững

Từ đó worker mới làm phần outbound.

Đây chính là chỗ outbox tạo ra ranh giới rất đẹp:

- write side commit trước
- side effect ra ngoài gửi sau

---

## 12. Callback từ downstream quay về order

Sau khi worker gửi đi:

- inventory reservation requested
- payment authorization requested

thì downstream sẽ phản hồi lại.

Thiết kế đúng nên là:

```text
inventory/payment consumer
  -> nhận message từ broker
  -> map sang command nội bộ của order
  -> commandBus.execute(...)
```

Ví dụ:

- `inventory.reserved`
  -> `MarkInventoryReservedCommand`

- `inventory.rejected`
  -> `MarkInventoryRejectedCommand`

- `payment.authorized`
  -> `MarkPaymentAuthorizedCommand`

- `payment.failed`
  -> `MarkPaymentFailedCommand`

Điểm quan trọng:

- callback không được update read model trực tiếp
- callback không được sửa database order trực tiếp
- callback phải quay lại write side chuẩn của order

---

## 13. Idempotency trong outbox

Outbox gần như luôn chạy theo mô hình `at-least-once`.

Điều đó nghĩa là:

- cùng một message có thể bị publish hơn một lần
- cùng một callback có thể bị tiêu thụ hơn một lần

Vì vậy cần 2 lớp idempotency:

### 13.1 Publisher side

Worker nên đảm bảo:

- cùng một outbox row không bị mark published trước khi publish thành công

### 13.2 Consumer side

Inventory/payment hoặc consumer callback nên đảm bảo:

- nếu cùng `messageId` đến hai lần
- hệ thống không xử lý hai lần

Nói ngắn gọn:

- outbox giúp không mất message
- idempotency giúp không xử lý trùng hậu quả

---

## 14. Chiến lược thiết kế phù hợp cho project này

Với đồ án học tập của bạn, tôi khuyên đi theo chiến lược 2 phase.

### Phase 1

Làm đủ để hiểu kiến trúc:

- lưu `order.submitted` vào outbox
- worker đọc và gọi `InventoryPublisherService` + `PaymentPublisherService`
- publisher service tạm thời có thể là stub/mock
- callback có thể giả lập bằng command tay

### Phase 2

Nâng lên event-driven rõ hơn:

- RabbitMQ exchange/routing key rõ ràng
- consumer thật cho inventory/payment
- callback thật quay ngược về order
- retry strategy rõ hơn

Đi hướng này sẽ giúp bạn:

- không bị ngợp
- nhưng vẫn học đúng pattern

---

## 15. Đề xuất contract cụ thể cho phase hiện tại

Để đơn giản mà vẫn đúng hướng, tôi đề xuất chốt như sau:

### 15.1 Outbox event lưu trong `order_outbox`

- `order.submitted`
- `order.confirmed`
- `order.cancelled`

### 15.2 Worker fan-out

Từ `order.submitted`, worker phát:

- `inventory.reservation.requested`
- `payment.authorization.requested`

### 15.3 Callback ngược

Các phản hồi cần có:

- `inventory.reserved`
- `inventory.rejected`
- `payment.authorized`
- `payment.failed`

### 15.4 Mapping về write side

- `inventory.reserved` -> `MarkInventoryReservedCommand`
- `inventory.rejected` -> `MarkInventoryRejectedCommand`
- `payment.authorized` -> `MarkPaymentAuthorizedCommand`
- `payment.failed` -> `MarkPaymentFailedCommand`

---

## 16. Những gì chưa cần làm ngay

Ở phase hiện tại, chưa nhất thiết phải làm ngay:

- dead-letter queue thật
- retry backoff phức tạp
- distributed tracing đầy đủ
- exactly-once delivery
- saga orchestration phức tạp

Bạn chỉ cần nắm thật chắc:

- event store khác outbox
- outbox khác projector
- callback luôn quay về command side

Chỉ riêng 3 ý này đã là nền rất mạnh để học tiếp rồi.

---

## 17. Checklist triển khai outbox tiếp theo

Sau tài liệu này, thứ tự hợp lý nên là:

1. Chuẩn hóa payload của `order.submitted` trong outbox.
2. Bổ sung headers như `messageId`, `correlationId`, `aggregateId`.
3. Hoàn thiện `OrderOutboxWorker` theo contract đã chốt.
4. Viết test cho worker:
   - publish thành công
   - publish lỗi
   - tăng retryCount
5. Thiết kế command callback cho inventory/payment.
6. Chỉ sau đó mới làm RabbitMQ thật hoặc service mock.

---

## 18. Chốt ngắn gọn

Bạn có thể nhớ outbox của order bằng một câu:

```text
Order commit xong chưa có nghĩa là downstream đã biết.
Outbox là nơi giữ lời hứa rằng downstream sẽ được báo sau, kể cả khi publish lỗi tạm thời.
```

Nếu event store là "lịch sử của order", thì outbox là "danh sách các việc order-service còn nợ phải báo cho thế giới bên ngoài".
