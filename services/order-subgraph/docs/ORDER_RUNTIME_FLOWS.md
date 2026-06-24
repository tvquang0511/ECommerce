# Luồng chạy thực tế của `order-subgraph`

Tài liệu này giải thích theo kiểu "runtime flow":

- command đi như thế nào
- aggregate sinh event ra sao
- event store, projector, outbox tham gia ở bước nào
- query side đọc từ đâu
- external event quay ngược về order thế nào

Mục tiêu của tài liệu này là để sau này bạn quay lại repo vẫn đọc được flow mà không cần phải lần từng file từ đầu.

---

## 1. Bức tranh lớn

`order-subgraph` theo hướng:

- `CQRS`
- `DDD`
- `Event Sourcing`
- `Event-Driven`

Flow tổng quát:

```text
Mutation
  -> CommandBus
  -> CommandHandler
  -> Aggregate
  -> Domain Events
  -> Event Store append
  -> EventBus nội bộ
     -> Projector cập nhật read model
     -> Outbox ghi integration events
  -> Outbox Worker
  -> RabbitMQ
  -> Service ngoài phản hồi
  -> Consumer nhận event ngoài
  -> map thành command nội bộ
  -> Aggregate append event mới

Query
  -> QueryBus
  -> QueryHandler
  -> Read Model
```

---

## 2. Vai trò từng thành phần

### 2.1 `CommandBus`

Dùng để dispatch command.

Ví dụ:

- `CreateOrderFromCartCommand`
- `SubmitOrderCommand`
- `CancelOrderCommand`

Nó chỉ có trách nhiệm:

- tìm đúng command handler đã đăng ký
- gọi `execute(command)`

### 2.2 `CommandHandler`

Đây là lớp orchestration use case.

Nó thường làm:

1. nhận command
2. lấy dữ liệu cần thiết từ integration service hoặc event store
3. rehydrate aggregate nếu aggregate đã tồn tại
4. gọi method của aggregate
5. append event vào event store
6. publish event nội bộ qua `EventBus`
7. trả `OrderCommandResult`

### 2.3 `OrderAggregate`

Đây là nơi giữ business truth của order.

Aggregate không nên:

- gọi DB trực tiếp
- gọi RabbitMQ trực tiếp
- gọi GraphQL trực tiếp

Aggregate chỉ nên:

- kiểm tra invariant
- sinh domain events
- apply event để cập nhật state trong memory

### 2.4 `Event Store`

Đây là source of truth.

Nó lưu:

- chuỗi event theo `aggregate_id`
- ví dụ:
  - `OrderCreatedFromCart`
  - `OrderSubmitted`
  - `OrderPaymentAuthorized`
  - `OrderConfirmed`

### 2.5 `EventBus`

Sau khi append event store thành công, command handler publish event nội bộ.

Mục đích:

- chạy projector
- chạy outbox writer
- chạy audit handler nếu cần

### 2.6 `Projector`

Projector không lưu event store.

Projector chỉ:

- nghe domain event
- cập nhật read model

### 2.7 `Outbox`

Outbox không phải event store.

Outbox chỉ là nơi ghi lại:

- integration events cần publish ra broker

Sau đó worker sẽ lấy record trong outbox để publish RabbitMQ.

### 2.8 `QueryHandler`

Query side không rehydrate aggregate.

Nó chỉ đọc:

- `orders_read`
- `order_items_read`
- `order_timeline_read`

---

## 3. Luồng command đầy đủ

### 3.1 Flow chuẩn

```text
Resolver
  -> commandBus.execute(command)

CommandBus
  -> tìm đúng CommandHandler
  -> gọi execute(command)

CommandHandler
  -> load stream cũ nếu cần
  -> rehydrate aggregate nếu cần
  -> gọi aggregate method

Aggregate
  -> kiểm tra invariant
  -> sinh event
  -> push event vào uncommittedEvents
  -> apply event để đổi state trong memory
  -> trả aggregate về handler

CommandHandler
  -> append event vào event store
  -> eventBus.publishAll(uncommittedEvents)
  -> trả result

EventBus
  -> projector handler
  -> outbox handler
```

Điểm rất quan trọng:

- aggregate không tự ghi DB
- aggregate không tự publish EventBus
- projector không lưu event store
- command handler là nơi phối hợp các bước đó

---

## 4. Luồng `createOrderFromCart`

### 4.1 Ý nghĩa nghiệp vụ

`createOrderFromCart` nghĩa là:

- buyer đã tạo một order mới từ cart
- order này bắt đầu vòng đời ở trạng thái `DRAFT`

`DRAFT` nghĩa là:

- order đã tồn tại về mặt nghiệp vụ
- nhưng chưa submit để đi vào flow inventory/payment

### 4.2 Runtime flow

```text
GraphQL mutation createOrderFromCart
  -> resolver
  -> commandBus.execute(CreateOrderFromCartCommand)

CreateOrderFromCartHandler.execute()
  -> checkoutPricingService.previewFromCart(...)
  -> OrderAggregate.createDraft(...)

OrderAggregate.createDraft()
  -> new OrderCreatedFromCartEvent(...)
  -> raise(event)
     -> version += 1
     -> push vào uncommittedEvents
     -> apply(event)
  -> aggregate state trở thành:
     - status = DRAFT
     - inventoryStatus = NOT_REQUESTED
     - paymentStatus = NOT_REQUESTED
  -> return aggregate

CreateOrderFromCartHandler
  -> eventStoreRepo.append(...)
  -> eventBus.publishAll(aggregate.uncommittedEvents)
  -> return OrderCommandResult

EventBus
  -> OrderCreatedFromCartProjectorHandler.handle(event)
  -> OrderCreatedFromCartOutboxHandler.handle(event)
```

### 4.3 Sau đó điều gì diễn ra

Projector:

- tạo dữ liệu read model ban đầu trong `orders_read`

Outbox handler:

- ghi integration event vào outbox nếu use case này cần publish ra ngoài

Kết quả:

- query side có thể đọc order mới tạo
- event store đã có event khai sinh order

---

## 5. Luồng `submitOrder`

### 5.1 Ý nghĩa nghiệp vụ

`submitOrder` nghĩa là:

- buyer xác nhận order nháp
- order chuyển sang bước xử lý inventory/payment

### 5.2 Runtime flow

```text
GraphQL mutation submitOrder
  -> resolver
  -> commandBus.execute(SubmitOrderCommand)

SubmitOrderHandler.execute()
  -> eventStoreRepo.loadStream(orderId)
  -> OrderAggregate.rehydrate(history)
  -> aggregate.submit()

aggregate.submit()
  -> kiểm tra invariant:
     - chỉ order DRAFT mới được submit
  -> raise(new OrderSubmittedEvent(orderId))
  -> apply(event)
  -> state trở thành:
     - status = SUBMITTED
     - inventoryStatus = PENDING
     - paymentStatus = PENDING

SubmitOrderHandler
  -> append event mới vào event store
  -> publish event nội bộ qua EventBus
  -> return result

EventBus
  -> projector update orders_read
  -> outbox ghi:
     - order.inventory.reservation.requested
     - order.payment.requested
```

### 5.3 Ý nghĩa kiến trúc

`submitOrder` không nên làm kiểu:

```text
update status = SUBMITTED trực tiếp trong bảng orders_read
```

Mà phải là:

```text
sinh OrderSubmittedEvent
-> append event store
-> projector cập nhật read model
```

---

## 6. Luồng `cancelOrder`

Flow mục tiêu nên là:

```text
CancelOrderCommand
  -> load stream
  -> rehydrate aggregate
  -> aggregate.cancel(reason)
  -> aggregate sinh OrderCancelledEvent
  -> append event store
  -> publish EventBus
  -> projector update read model
  -> outbox ghi order.cancelled nếu cần
```

Ý nghĩa:

- cancel là nghiệp vụ
- không phải chỉ là update một cột status

---

## 7. Luồng query

### 7.1 Flow chuẩn

```text
GraphQL Query
  -> resolver
  -> queryBus.execute(query)

QueryBus
  -> tìm đúng QueryHandler

QueryHandler
  -> gọi read model repo
  -> trả dữ liệu
```

### 7.2 Điểm quan trọng

Query side:

- không load event stream
- không rehydrate aggregate
- không kiểm tra business rule write side

Query side chỉ đọc projection.

Ví dụ:

- `order(id)`
- `myOrders()`
- `sellerOrders()`
- `adminOrders()`

đều nên đọc từ:

- `orders_read`
- `order_items_read`
- `order_timeline_read`

---

## 8. Luồng projector

Projector luôn chạy sau khi event store append thành công và event được publish qua `EventBus`.

Flow:

```text
event store append xong
  -> EventBus.publish(event)
  -> ProjectorHandler.handle(event)
  -> update read model
```

Ví dụ:

`OrderCreatedFromCartEvent`

- insert row vào `orders_read`

`OrderSubmittedEvent`

- update `orders_read.status = SUBMITTED`
- update `inventory_status = PENDING`
- update `payment_status = PENDING`

### 8.1 Projection idempotency

Projector phải idempotent.

Nghĩa là:

- nếu cùng một event bị handle lại nhiều lần
- read model vẫn phải đúng

Vì event có thể bị:

- retry
- replay
- publish lại

Nên projector không được viết theo kiểu dễ cộng dồn sai.

---

## 9. Luồng outbox

### 9.1 Vì sao cần outbox

Nếu append event store xong mà publish RabbitMQ lỗi thì hệ thống bị lệch.

Nên flow đúng là:

```text
append event store
  -> ghi outbox record
  -> worker publish RabbitMQ sau
```

### 9.2 Runtime flow

```text
domain event được publish nội bộ
  -> OutboxHandler.handle(event)
  -> outboxRepo.enqueue(...)

worker
  -> đọc outbox record chưa publish
  -> publish RabbitMQ
  -> đánh dấu published_at
```

### 9.3 Ý nghĩa

Outbox giúp:

- không mất integration event
- chấp nhận retry
- phù hợp eventual consistency

---

## 10. Luồng external event quay về order

Sau này khi inventory/payment phản hồi, flow nên là:

```text
RabbitMQ consumer nhận event ngoài
  -> ví dụ payment.authorized
  -> map thành MarkPaymentAuthorizedCommand
  -> commandBus.execute(command)

CommandHandler
  -> load stream
  -> rehydrate aggregate
  -> aggregate.markPaymentAuthorized()
  -> append event store
  -> EventBus.publish(...)

Projector
  -> update payment_status

Aggregate
  -> nếu inventory đã RESERVED
  -> tự sinh OrderConfirmedEvent
```

Điểm quan trọng:

- event ngoài không sửa aggregate state trực tiếp
- luôn map thành command nội bộ

---

## 11. Read model là gì trong repo này

`Read model` không phải dữ liệu tạm.

Nó là:

- dữ liệu chính thức dành cho query side

Ví dụ:

- `orders_read`
- `order_items_read`
- `order_timeline_read`

Nó khác với `event store`:

- `event store` là lịch sử gốc
- `read model` là dữ liệu đã được chiếu ra để đọc nhanh

---

## 12. Trạng thái hiện tại của code

Hiện tại code của `order-subgraph` mới đang ở giai đoạn skeleton + in-memory.

### 12.1 Đã có

- aggregate có các method cốt lõi
- command/query handlers đã tách
- event store repo có flow append/loadStream
- projector handlers và outbox handlers đã có structure

### 12.2 Trạng thái persistence hiện tại

`OrderEventStoreRepo`

- đã lưu vào Postgres thật qua Prisma model `OrderEvent`
- map xuống bảng `order_events`

`OrderProjectionRepo`

- đã lưu vào Postgres thật qua Prisma models read model:
  - `OrderRead`
  - `OrderItemRead`
- map xuống các bảng:
  - `orders_read`
  - `order_items_read`

`OrderOutboxRepo`

- hiện vẫn chỉ là stub `enqueue(...)`
- chưa lưu DB thật

### 12.3 Kết luận trạng thái hiện tại

Hiện tại trạng thái đã là:

- event store: Postgres thật
- projection/read model: Postgres thật
- outbox: chưa implement persistence thật

Tức là `order-subgraph` đã bước qua giai đoạn in-memory cho phần cốt lõi của CQRS + Event Sourcing, nhưng integration side vẫn chưa hoàn thiện.

---

## 13. Bạn nên review code theo thứ tự nào

Nếu sau này quay lại repo, thứ tự nên đọc là:

1. `graphql/order.resolver.ts`
2. `application/commands/...`
3. `domain/aggregate/order.aggregate.ts`
4. `domain/events/...`
5. `infrastructure/event-store/...`
6. `application/events/...`
7. `infrastructure/projections/...`
8. `infrastructure/outbox/...`
9. `application/queries/...`

Thứ tự này sẽ bám đúng flow runtime nên dễ hiểu hơn rất nhiều.

---

## 14. Công việc tiếp theo nên làm

Sau trạng thái hiện tại, mình đề xuất thứ tự như sau:

### Bước 1: Hoàn thiện event mapper

Cần map đầy đủ các event hiện có:

- `OrderCreatedFromCartEvent`
- `OrderSubmittedEvent`
- `OrderCancelledEvent`
- `OrderInventoryReservedEvent`
- `OrderInventoryRejectedEvent`
- `OrderPaymentAuthorizedEvent`
- `OrderPaymentFailedEvent`
- `OrderConfirmedEvent`

### Bước 2: Hoàn thiện write side

- nâng `CancelOrderHandler` lên đúng flow event-sourced
- thêm command/handler cho inventory/payment callbacks
- làm rõ optimistic concurrency với `expectedVersion`

### Bước 3: Hoàn thiện read side

- projection schema thật
- projector idempotency
- query `order`, `myOrders`

### Bước 4: Hoàn thiện outbox

- bảng `order_outbox`
- worker publish
- retry / published_at

### Bước 5: Viết test

- aggregate tests theo kiểu given/when/then
- command handler tests
- projector tests

---

## 15. Chốt ngắn gọn

Flow đúng cần nhớ là:

```text
CommandBus
  -> CommandHandler
  -> Aggregate
  -> Event Store append
  -> EventBus
  -> Projector / Outbox
  -> Query side / RabbitMQ
```

Và ở thời điểm hiện tại:

```text
event store = Postgres
read model = Postgres
outbox = chưa persistence thật
```

Nên bước tiếp theo hợp lý nhất là:

- hoàn thiện `event mapper`
- hoàn thiện `outbox`
- viết test aggregate / projector / command handler
