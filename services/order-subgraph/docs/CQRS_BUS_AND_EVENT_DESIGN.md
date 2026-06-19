# CQRS, Bus và Event trong `order-subgraph`

Tài liệu này giải thích kỹ hơn thiết kế `CommandBus / QueryBus / EventBus` cho `order-subgraph`, theo đúng bối cảnh:

- bạn đang dùng `NestJS`, không phải .NET
- bạn muốn học tư duy giống MediatR nhưng không over-engineer
- bạn muốn phân biệt rõ:
  - CQRS tối giản
  - CQRS có mediator
  - CQRS + domain event
  - CQRS + Event Sourcing
  - CQRS + Event-Driven integration

Tài liệu này cũng trả lời câu hỏi quan trọng:

`Nếu chỉ tách command và query mà không có event thì có còn đúng CQRS không?`

Câu trả lời ngắn là:

- `Có`, đó vẫn là CQRS
- nhưng đó là `CQRS mức cơ bản`
- để đi đúng hướng khóa học của bạn thì `order-subgraph` nên tiến thêm sang `event-driven CQRS`

---

## 1. CQRS thật ra là gì

CQRS là viết tắt của:

- `Command Query Responsibility Segregation`

Ý tưởng gốc rất đơn giản:

- `Command` là hành động làm thay đổi trạng thái
- `Query` là hành động chỉ để đọc dữ liệu

Điểm cốt lõi của CQRS là:

- không dùng cùng một mô hình cho cả đọc và ghi
- luồng ghi và luồng đọc được tách tư duy ra

Ví dụ với order:

- `createOrderFromCart` là command
- `submitOrder` là command
- `cancelOrder` là command
- `getOrder` là query
- `listMyOrders` là query

Chỉ cần tách được như vậy là bạn đã bước vào CQRS rồi.

---

## 2. Vậy tách command và query thôi có đủ chưa

### 2.1 Đủ để gọi là CQRS

Nếu bạn có:

- command riêng
- query riêng
- command handler riêng
- query handler riêng

thì đó vẫn là CQRS.

Nó hoàn toàn đúng về mặt khái niệm.

### 2.2 Nhưng chưa phải phiên bản sâu mà khóa học muốn nhấn mạnh

Trong các khóa học advanced, người ta thường đi xa hơn:

- command tạo ra domain events
- query đọc từ projection
- event được phát để update read model
- integration events được phát ra RabbitMQ

Cho nên có thể hiểu:

- `CQRS cơ bản`: tách command và query
- `CQRS nâng cao`: tách command/query + dùng event như xương sống của luồng xử lý

---

## 3. MediatR trong .NET là gì

Trong .NET, nhiều người dùng `MediatR` để tổ chức CQRS.

Tư duy của MediatR là:

- controller không gọi handler trực tiếp
- controller gửi một message tới mediator
- mediator tìm handler tương ứng
- handler xử lý

Ví dụ:

```text
Controller
  -> mediator.send(CreateOrderCommand)
  -> CreateOrderHandler
```

Ngoài ra còn có:

```text
domain event
  -> mediator.publish(OrderSubmittedEvent)
  -> nhiều event handler cùng phản ứng
```

Đó là lý do trong các khóa học .NET, bạn thường thấy:

- request
- handler
- notification/event
- notification handler

---

## 4. Với NestJS thì có cần làm y như vậy không

Không cần làm giống hệt framework .NET.

Điều quan trọng là giữ được tư duy:

- resolver/controller không ôm business logic
- command đi qua một entry point rõ ràng
- query đi qua một entry point rõ ràng
- event có đường đi riêng của nó

Với NestJS, bạn có 3 mức tổ chức:

### Mức 1: gọi handler trực tiếp

```text
Resolver -> CreateOrderFromCartHandler
```

Mức này đơn giản, nhưng chưa có mediator thật sự.

### Mức 2: dùng bus nhẹ tự viết

```text
Resolver -> CommandBus -> Handler
Resolver -> QueryBus -> Handler
Handler -> EventBus -> EventHandlers
```

Đây là mức rất hợp với đồ án của bạn.

### Mức 3: dùng `@nestjs/cqrs`

Đây là mức framework hóa hơn, tiện khi hệ thống lớn, nhưng cũng thêm ceremony.

Với project hiện tại, mình đề xuất:

- đi theo tư duy của MediatR
- nhưng dùng `bus` nhẹ do mình kiểm soát

---

## 5. Thiết kế bus đề xuất cho `order-subgraph`

Trong `order-subgraph`, mình đề xuất có 3 bus:

- `CommandBus`
- `QueryBus`
- `EventBus`

### 5.1 CommandBus

Vai trò:

- nhận một command
- tìm handler tương ứng
- gọi `execute`

Ví dụ:

```text
Resolver
  -> CommandBus.execute(CreateOrderFromCartCommand)
  -> CreateOrderFromCartHandler.execute()
```

### 5.2 QueryBus

Vai trò:

- nhận một query
- tìm handler tương ứng
- gọi `execute`

Ví dụ:

```text
Resolver
  -> QueryBus.execute(GetOrderQuery)
  -> GetOrderHandler.execute()
```

### 5.3 EventBus

Vai trò:

- nhận event đã xảy ra
- publish tới một hoặc nhiều event handler

Ví dụ:

```text
CreateOrderFromCartHandler
  -> append OrderCreatedFromCartEvent vào event store
  -> EventBus.publish(OrderCreatedFromCartEvent)

Event handlers:
  -> OrderProjectorHandler
  -> OrderOutboxHandler
```

Điểm này mới là phần làm CQRS của bạn “có chiều sâu”.

---

## 6. Phân biệt command handler và event handler

Đây là chỗ nhiều người mới học hay lẫn nhất.

### 6.1 Command handler

Command handler trả lời câu hỏi:

`User đang yêu cầu hệ thống làm gì?`

Ví dụ:

- tạo order
- submit order
- cancel order

Command handler thường:

- validate input
- load aggregate
- check business rule
- sinh event mới
- append event store

### 6.2 Event handler

Event handler trả lời câu hỏi:

`Sau khi sự kiện đã xảy ra, hệ thống cần phản ứng gì tiếp theo?`

Ví dụ:

- update projection
- ghi outbox
- publish RabbitMQ
- audit log
- trigger notification

### 6.3 Công thức rất dễ nhớ

- command handler = quyết định
- event handler = phản ứng

---

## 7. Trong `order-subgraph` event nên xuất hiện ở đâu

Nếu muốn đi đúng tinh thần khóa học của bạn, event nên xuất hiện ở 3 lớp:

### 7.1 Domain event

Đây là event nội bộ của domain:

- `OrderCreated`
- `OrderSubmitted`
- `OrderCancelled`
- `OrderConfirmed`

Chúng sống gần aggregate.

### 7.2 Projection event handling

Sau khi domain event được ghi thành công:

- projector dùng event đó để update read model

Ví dụ:

- `OrderCreated` -> thêm record vào `orders_read`
- `OrderSubmitted` -> đổi trạng thái projection

### 7.3 Integration event

Khi cần nói chuyện với service khác:

- inventory
- payment
- notification

thì domain event sẽ được map hoặc chuyển thành integration event:

- `order.submitted`
- `order.payment.requested`
- `order.inventory.requested`

---

## 8. Nếu không có event thì chuyện gì xảy ra

Nếu bạn chỉ có:

- command
- query
- handler

thì bạn vẫn có CQRS, nhưng:

- projection sẽ khó sạch hơn
- integration với RabbitMQ sẽ rối hơn
- event sourcing sẽ không tự nhiên
- khó giải thích câu chuyện nghiệp vụ theo timeline

Đó là lý do mình nói:

- tách command/query là đúng
- nhưng với `order`, chỉ dừng ở đó thì hơi thiếu

---

## 9. Quan hệ giữa CQRS và Event Sourcing

Nhiều người cũng hay nhầm chỗ này.

### 9.1 CQRS không bắt buộc phải có Event Sourcing

Bạn có thể làm CQRS kiểu:

- command ghi state vào DB thường
- query đọc từ bảng read model

vẫn là CQRS.

### 9.2 Event Sourcing không phải là CQRS, nhưng đi với CQRS rất hợp

Trong Event Sourcing:

- trạng thái aggregate không lưu trực tiếp
- thay vào đó lưu chuỗi event

Ví dụ order:

```text
OrderCreated
OrderSubmitted
OrderInventoryReserved
OrderPaymentAuthorized
OrderConfirmed
```

Khi cần rebuild aggregate:

- replay chuỗi event này

Với `order-subgraph`, đây là hướng cực kỳ hợp lý.

---

## 10. Quan hệ giữa CQRS và Event-Driven

CQRS không bắt buộc phải có RabbitMQ.

Nhưng khi system bắt đầu có nhiều service:

- order
- payment
- inventory
- notification

thì event-driven giúp tách boundary tốt hơn.

Ví dụ:

```text
OrderSubmitted
  -> order-service ghi event store
  -> order-service ghi outbox
  -> worker publish RabbitMQ
  -> payment-service consume
  -> inventory-service consume
```

Lúc đó:

- command side quyết định
- event bus nội bộ phản ứng
- integration event đi sang service khác

Đó mới là bức tranh hoàn chỉnh của kiến trúc bạn đang hướng tới.

---

## 11. Thiết kế bus phù hợp với `order-subgraph`

Mình đề xuất tư duy thực dụng theo 3 phase:

### Phase 1: CommandBus + QueryBus

Mục tiêu:

- resolver không gọi handler trực tiếp
- command/query đi qua bus

Lúc này event bus có thể chưa cần implement đầy đủ.

### Phase 2: EventBus nội bộ

Mục tiêu:

- command handler append event store
- sau đó publish event nội bộ
- projector và outbox listener phản ứng

### Phase 3: Integration event qua RabbitMQ

Mục tiêu:

- outbox worker publish message
- payment/inventory consume
- phản hồi lại order bằng event khác

---

## 12. Luồng đúng cho `createOrderFromCart`

Đây là ví dụ tốt nhất để hình dung bus design.

### 12.1 Command flow

```text
GraphQL Resolver
  -> CommandBus.execute(CreateOrderFromCartCommand)
  -> CreateOrderFromCartHandler
  -> CartReaderService
  -> ProductReaderService
  -> OrderAggregate.createDraft()
  -> EventStore.append(OrderCreated)
  -> EventBus.publish(OrderCreated)
```

### 12.2 Event flow sau đó

```text
EventBus.publish(OrderCreated)
  -> OrderProjectorHandler
  -> OrderOutboxHandler
```

### 12.3 Query flow

```text
Resolver
  -> QueryBus.execute(GetOrderQuery)
  -> GetOrderHandler
  -> OrderProjectionRepo
```

Đây là mô hình rất sạch và rất gần với tư duy MediatR.

---

## 13. Tổ chức thư mục theo use case là hoàn toàn đúng

Bạn đã chọn hướng này:

```text
commands/
  create-order-from-cart/
    create-order-from-cart.command.ts
    create-order-from-cart.handler.ts
  submit-order/
    submit-order.command.ts
    submit-order.handler.ts
queries/
  get-order/
    get-order.query.ts
    get-order.handler.ts
```

Mình đánh giá hướng này rất đúng cho `order` vì:

- đọc cây thư mục là hiểu nghiệp vụ
- không bị tách file quá vụn theo layer thuần túy
- thêm use case mới rất tự nhiên
- hợp với style module-first bạn đang thích

Nếu sau này có event handler, bạn cũng có thể tổ chức tương tự:

```text
events/
  order-created-from-cart/
    order-created-from-cart.handler.ts
  order-submitted/
    order-submitted.handler.ts
```

---

## 14. Vậy thiết kế đúng nhất cho đồ án này là gì

Mình đề xuất chốt như sau:

### 14.1 Về mặt tư duy

- dùng mediator mindset
- nhưng không cần sao chép nguyên xi MediatR của .NET

### 14.2 Về mặt code

- command/query tách rõ
- dùng feature-first trong `application`
- thêm `CommandBus`, `QueryBus`, `EventBus` bản nhẹ

### 14.3 Về mặt tiến hóa kiến trúc

- phase đầu: CQRS cơ bản
- phase sau: domain events
- tiếp theo: event sourcing
- tiếp theo: outbox + RabbitMQ

Nói cách khác:

`CQRS không sai nếu chưa có event`

nhưng:

`Order của bạn nên tiến dần tới CQRS có event, vì đó mới đúng mục tiêu học tập của service này`

---

## 15. Các hiểu lầm thường gặp

### Hiểu lầm 1

`Không có event thì không phải CQRS`

Sai.

Không có event vẫn có thể là CQRS.

### Hiểu lầm 2

`Đã có command và query thì tự động là event sourcing`

Sai.

CQRS và Event Sourcing liên quan chặt, nhưng không phải một thứ.

### Hiểu lầm 3

`Phải dùng framework bus thật nặng mới đúng kiến trúc`

Sai.

Kiến trúc đúng nằm ở boundary và luồng xử lý, không nằm ở việc dùng nhiều abstraction.

### Hiểu lầm 4

`Service nào cũng nên dùng mediator`

Sai.

`order-subgraph` rất hợp.

`product-subgraph` và `cart-subgraph` hiện tại chưa chắc cần mạnh tay đến vậy.

---

## 16. Kết luận ngắn gọn

Bạn có thể nhớ bằng 4 câu:

1. CQRS bắt đầu từ việc tách command và query
2. Event không bắt buộc để có CQRS, nhưng rất quan trọng để CQRS của `order` đi đúng hướng nâng cao
3. MediatR trong .NET là một cách tổ chức mediator, không phải chân lý duy nhất
4. Với `NestJS`, cách hợp lý nhất cho đồ án này là bus nhẹ + feature-first + tiến hóa dần sang event-driven

Tư duy mục tiêu của `order-subgraph` nên là:

```text
Resolver
  -> CommandBus / QueryBus
  -> Handler
  -> Aggregate / Event Store
  -> EventBus
  -> Projection / Outbox
  -> RabbitMQ
```

Đó là phiên bản rất đẹp, rất thực dụng, và rất phù hợp để bạn học sâu mà không bị over-engineer quá sớm.
