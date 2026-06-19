# Thiết kế chuẩn `order-subgraph`

Tài liệu này chốt hướng xây dựng `order-subgraph` theo đúng mục tiêu học tập của bạn:

- `CQRS`
- `DDD`
- `Event Sourcing`
- `Event-Driven` với `RabbitMQ`
- phù hợp với `NestJS`
- phù hợp với hệ thống hiện có: `user-service`, `product-subgraph`, `cart-subgraph`, `graphql-gateway`

Đây không phải hướng “làm nhanh để có feature”, mà là hướng làm để học sâu và vẫn giữ được tính thực tế của một bài toán e-commerce.

---

## 1. Mục tiêu của `order-subgraph`

`order-subgraph` nên là service trung tâm của giao dịch mua bán.

Vai trò của nó:

- nhận yêu cầu checkout từ buyer
- chốt snapshot sản phẩm tại thời điểm đặt hàng
- quản lý vòng đời của order
- phát sinh domain event
- lưu lịch sử thay đổi bằng event store
- cập nhật read model để query
- phát integration event sang inventory, payment, notification

Nói ngắn gọn:

```text
cart là nơi gom hàng
product là nơi quản lý catalog
order là nơi chốt giao dịch nghiệp vụ
payment và inventory là các service phối hợp với order
```

---

## 2. Vì sao `order` là chỗ nên áp dụng CQRS + DDD + Event Sourcing

`Order` không phải entity CRUD đơn giản.

Nó có:

- nhiều trạng thái
- nhiều business rule
- nhiều side effect
- nhiều bước bất đồng bộ
- nhu cầu audit rất rõ

Ví dụ luồng thực tế:

```text
buyer checkout
  -> tạo draft order
  -> submit order
  -> yêu cầu giữ hàng
  -> yêu cầu thanh toán
  -> inventory phản hồi
  -> payment phản hồi
  -> confirm hoặc cancel
```

Đây chính là loại bài toán rất hợp để học:

- aggregate
- invariant
- command side / query side
- event store
- projection
- outbox
- eventual consistency

`Product` chưa cần phức tạp đến mức này, nhưng `order` thì rất đáng để làm.

---

## 3. Bounded context và ranh giới trách nhiệm

### 3.1 `order-subgraph` sở hữu

- `Order` aggregate
- order item snapshot
- trạng thái nghiệp vụ của order
- event store của order
- read model phục vụ query order
- outbox để phát integration events

### 3.2 `order-subgraph` không sở hữu

- product catalog gốc
- cart gốc
- user profile gốc
- tồn kho gốc
- payment record gốc

`order` chỉ lấy dữ liệu từ ngoài vào để:

- validate
- snapshot
- ra quyết định nghiệp vụ

Nó không được sửa trực tiếp database của service khác.

---

## 4. Tư duy kiến trúc tổng quát

Luồng chuẩn nên là:

```text
GraphQL mutation
  -> Command
  -> CommandHandler
  -> load aggregate từ event store
  -> aggregate xử lý business rule
  -> sinh domain events
  -> append events vào event store
  -> publish events qua EventBus nội bộ
  -> projector cập nhật read model
  -> outbox ghi integration event
  -> worker đẩy ra RabbitMQ
```

Với query:

```text
GraphQL query
  -> Query
  -> QueryHandler
  -> đọc projection
  -> trả dữ liệu cho client
```

Điểm quan trọng:

- write side không update bảng read trực tiếp
- query side không rebuild aggregate mỗi lần đọc
- source of truth là event store, không phải row order cuối cùng

---

## 5. Mô hình domain nên có

### 5.1 Aggregate root

- `OrderAggregate`

### 5.2 Value objects

- `Money`
- `OrderItem`
- `OrderBuyerSnapshot`
- `OrderAddressSnapshot` nếu sau này có shipping

### 5.3 Domain policy

- `OrderPolicy`

Policy sẽ giữ các rule như:

- có được submit không
- có được cancel không
- có được confirm không
- inventory/payment đã đủ điều kiện chưa

### 5.4 Trạng thái order đề xuất

Mình khuyên dùng bộ trạng thái này:

- `DRAFT`
- `SUBMITTED`
- `AWAITING_INVENTORY`
- `AWAITING_PAYMENT`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Nếu muốn gọn hơn ở phase đầu:

- `DRAFT`
- `SUBMITTED`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Nhưng để học event-driven tốt hơn thì nên giữ cả `AWAITING_INVENTORY` và `AWAITING_PAYMENT`.

---

## 6. Invariants quan trọng của aggregate

Đây là phần cốt lõi của DDD.

`OrderAggregate` phải tự bảo vệ các invariant như:

- order phải có ít nhất một item
- quantity của mỗi item phải lớn hơn `0`
- không được submit khi order không ở trạng thái `DRAFT`
- không được confirm nếu chưa có đủ điều kiện từ inventory và payment
- không được cancel order đã `CONFIRMED` nếu chưa có compensation flow
- currency trong cùng một order phải nhất quán

Nếu logic này nằm rải rác ở resolver hoặc service integration thì thiết kế sẽ nhanh rối.

---

## 7. Bộ domain events nên chốt từ sớm

Ngày đầu không cần implement hết, nhưng nên chốt tên ngay từ đầu.

Bộ event nên có:

- `OrderCreatedFromCart`
- `OrderSubmitted`
- `OrderInventoryReservationRequested`
- `OrderInventoryReserved`
- `OrderInventoryRejected`
- `OrderPaymentRequested`
- `OrderPaymentAuthorized`
- `OrderPaymentFailed`
- `OrderConfirmed`
- `OrderCancelled`
- `OrderFailed`

Ý nghĩa:

- domain event ghi nhận một sự kiện nghiệp vụ đã thật sự xảy ra
- event phải dùng ngôn ngữ domain, không dùng tên kiểu kỹ thuật

Ví dụ tốt:

- `OrderSubmitted`

Ví dụ không tốt:

- `OrderUpdatedStatusToSubmitted`

---

## 8. Event Sourcing trong order nên hiểu thế nào

Trong `order-subgraph`, source of truth nên là chuỗi events.

Ví dụ một order hoàn tất có thể được rebuild từ:

```text
OrderCreatedFromCart
OrderSubmitted
OrderInventoryReservationRequested
OrderInventoryReserved
OrderPaymentRequested
OrderPaymentAuthorized
OrderConfirmed
```

Trạng thái hiện tại chỉ là kết quả của việc replay chuỗi event đó.

### 8.1 Lợi ích

- audit rõ ràng
- debug dễ
- replay được
- phù hợp với saga / eventual consistency
- học đúng tinh thần event-driven

### 8.2 Cái giá phải trả

- phức tạp hơn CRUD
- phải có projection
- phải chú ý versioning event
- phải test kỹ aggregate

---

## 9. Thiết kế event store

Mình khuyên dùng `Postgres` cho:

- event store
- projection store
- outbox

### 9.1 Bảng `order_events`

- `id` uuid primary key
- `aggregate_id` text
- `aggregate_type` text
- `sequence` int
- `event_type` text
- `event_data` jsonb
- `metadata` jsonb
- `occurred_at` timestamptz

### 9.2 Metadata nên lưu

- `requestId`
- `actorId`
- `actorRoles`
- `correlationId`
- `causationId`
- `idempotencyKey`
- `source`

### 9.3 Index nên có

- unique `(aggregate_id, sequence)`
- index `(aggregate_id)`
- index `(event_type)`
- index `(occurred_at)`

### 9.4 Optimistic concurrency

Khi append event:

- command gửi kèm `expectedVersion`
- repo kiểm tra version hiện tại
- nếu lệch thì fail conflict

Đây là phần rất quan trọng để học đúng Event Sourcing.

---

## 10. Thiết kế read model

Query side không nên đọc event store trực tiếp.

Nó nên đọc projection.

### 10.1 Bảng `orders_read`

- `order_id`
- `buyer_id`
- `status`
- `total_amount`
- `currency`
- `inventory_status`
- `payment_status`
- `created_at`
- `updated_at`
- `version`

### 10.2 Bảng `order_items_read`

- `order_id`
- `line_id`
- `product_id`
- `seller_id`
- `title_snapshot`
- `quantity`
- `unit_price_amount`
- `currency`

### 10.3 Bảng mở rộng nên có sau

`seller_orders_read`

- để seller lọc order liên quan đến shop của họ

`order_timeline_read`

- để hiển thị timeline theo event

### 10.4 Query GraphQL gợi ý

- `order(id: ID!): Order`
- `myOrders(input: MyOrdersInput): OrderConnection!`
- `sellerOrders(input: SellerOrdersInput): OrderConnection!`
- `adminOrders(input: AdminOrdersInput): OrderConnection!`
- `orderTimeline(orderId: ID!): [OrderTimelineEntry!]!`

---

## 11. Tích hợp với các service khác

### 11.1 Với `cart-subgraph`

`order` sẽ lấy cart hiện tại của buyer để checkout.

Vai trò của cart:

- là nguồn input
- không phải source of truth của giao dịch

Luồng:

- lấy cart
- validate cart không rỗng
- snapshot item sang order
- tính lại tổng tiền

### 11.2 Với `product-subgraph`

`order` không nên tin cart tuyệt đối.

Phải re-check:

- product có tồn tại không
- product có `APPROVED` không
- seller có hợp lệ không nếu muốn chặt hơn
- giá hiện tại là bao nhiêu
- currency là gì

Cho phase đầu, nếu giá lệch giữa cart và product hiện tại thì nên fail checkout, buộc buyer làm mới lại.

### 11.3 Với `user-service`

`order` không cần quản lý user profile đầy đủ.

Nó chỉ cần:

- xác định actor từ JWT
- biết user là buyer / seller / admin
- biết seller nào thuộc user nào nếu có seller queries

---

## 12. EventBus nội bộ, projector và outbox

### 12.1 EventBus nội bộ dùng để làm gì

Sau khi append event store thành công:

- publish domain events qua `EventBus`
- các event handler nội bộ sẽ:
  - cập nhật projection
  - ghi outbox
  - ghi audit nếu cần

### 12.2 Projector dùng để làm gì

Projector lắng nghe domain events và cập nhật read model.

Ví dụ:

- `OrderCreatedFromCart` -> insert `orders_read` + `order_items_read`
- `OrderSubmitted` -> update trạng thái
- `OrderPaymentAuthorized` -> update payment status
- `OrderConfirmed` -> update trạng thái cuối cùng

### 12.3 Outbox dùng để làm gì

Không nên publish RabbitMQ trực tiếp ngay trong command handler.

Lý do:

- DB append event có thể thành công
- nhưng publish broker có thể fail

Khi đó hệ thống bị lệch trạng thái.

Giải pháp đúng:

- append event store
- ghi outbox record
- worker publish outbox ra RabbitMQ

---

## 13. Tích hợp RabbitMQ theo đúng tinh thần event-driven

### 13.1 Integration events nên có

- `order.submitted`
- `order.inventory.reservation.requested`
- `order.payment.requested`
- `order.confirmed`
- `order.cancelled`
- `order.failed`

### 13.2 Service ngoài sẽ làm gì

`inventory-service`

- consume `order.inventory.reservation.requested`
- trả về `inventory.reserved` hoặc `inventory.rejected`

`payment-service`

- consume `order.payment.requested`
- trả về `payment.authorized` hoặc `payment.failed`

### 13.3 Order xử lý event ngoài như thế nào

Event ngoài đi vào `order-subgraph` không nên sửa aggregate trực tiếp.

Nó nên được map thành command nội bộ:

- `MarkInventoryReservedCommand`
- `MarkInventoryRejectedCommand`
- `MarkPaymentAuthorizedCommand`
- `MarkPaymentFailedCommand`

Đây là điểm rất quan trọng.

```text
external event -> consumer -> command nội bộ -> aggregate -> event store
```

---

## 14. Cấu trúc thư mục nên giữ

Với hướng `module-first`, cấu trúc này là hợp lý:

```text
services/order-subgraph/
  src/
    modules/
      auth/
      order/
        application/
          commands/
            create-order-from-cart/
            submit-order/
            cancel-order/
            mark-inventory-reserved/
            mark-inventory-rejected/
            mark-payment-authorized/
            mark-payment-failed/
          queries/
            get-order/
            list-my-orders/
            seller-orders/
            admin-orders/
          events/
            order-created-from-cart/
            order-submitted/
            order-payment-authorized/
            order-confirmed/
          services/
            checkout-pricing.service.ts
        domain/
          aggregate/
          enums/
          events/
          policies/
          value-objects/
        graphql/
          order.resolver.ts
          order.gql.type.ts
          order.input.ts
        infrastructure/
          event-store/
          projections/
          outbox/
          integrations/
          consumers/
        tests/
```

Điểm đáng chú ý:

- `application` là nơi orchestration use case
- `domain` là nơi giữ business truth
- `infrastructure` là nơi nói chuyện với DB, RabbitMQ, service ngoài

---

## 15. Luồng triển khai MVP chuẩn

### 15.1 `createOrderFromCart`

```text
mutation createOrderFromCart
  -> CommandBus.execute(CreateOrderFromCartCommand)
  -> handler gọi cart reader
  -> handler gọi product reader để re-check
  -> aggregate tạo draft / created event
  -> append event store
  -> EventBus.publishAll
  -> projector tạo read model
  -> outbox ghi event nếu cần
```

### 15.2 `submitOrder`

```text
mutation submitOrder
  -> load aggregate từ event store
  -> aggregate.submit()
  -> sinh OrderSubmitted
  -> append event store
  -> publish event nội bộ
  -> projector update trạng thái
  -> outbox ghi:
       - order.inventory.reservation.requested
       - order.payment.requested
```

### 15.3 `payment.authorized`

```text
RabbitMQ consumer nhận payment.authorized
  -> map thành MarkPaymentAuthorizedCommand
  -> load aggregate
  -> aggregate.markPaymentAuthorized()
  -> append event store
  -> publish event nội bộ
  -> projector update payment_status
  -> nếu inventory đã ok thì confirm order
```

---

## 16. Thiết kế payment để học blockchain

Với project học tập, payment không cần là blockchain thật ngay từ đầu.

Hướng phù hợp là:

- xây `payment-service` theo kiểu `blockchain-inspired`
- thanh toán là bất đồng bộ
- có transaction reference
- có bước chờ xác nhận
- có callback/event phản hồi về `order`

Trạng thái payment gợi ý:

- `PENDING`
- `AWAITING_CONFIRMATION`
- `AUTHORIZED`
- `FAILED`
- `EXPIRED`

Luồng học tập rất đẹp sẽ là:

```text
order.payment.requested
  -> payment-service tạo payment intent
  -> mô phỏng blockchain confirmation
  -> publish payment.authorized hoặc payment.failed
  -> order cập nhật aggregate từ event ngoài
```

Như vậy bạn học được:

- asynchronous payment
- eventual consistency
- message-driven workflow
- cách map external event vào domain command

---

## 17. Những việc cần làm tiếp theo

Mình đề xuất đi theo đúng thứ tự này để vừa chắc vừa không bị ngợp.

### Phase 1: Chốt skeleton và naming

- đã chốt tên event mở đầu là `OrderCreatedFromCartEvent`
- bỏ các thư mục/domain file thừa nếu còn sót sau refactor
- chốt enum trạng thái order, payment, inventory
- chốt command/query/event naming

### Phase 2: Hoàn thiện write side

- hoàn thiện `OrderAggregate`
- thêm `replay()` hoặc `rehydrate()` từ event history
- thêm `apply...()` cho từng domain event
- hoàn thiện `OrderPolicy`
- thêm optimistic concurrency cho `OrderEventStoreRepo`

### Phase 3: Hoàn thiện read side

- thiết kế projection schema thật
- implement `OrderProjectionRepo` theo read model
- làm projector cho:
  - `OrderCreatedFromCart`
  - `OrderSubmitted`
  - `OrderPaymentAuthorized`
  - `OrderCancelled`
- hoàn thiện query `order` và `myOrders`

### Phase 4: Hoàn thiện integration

- thiết kế bảng `order_outbox`
- implement outbox writer
- implement outbox worker
- thêm publisher RabbitMQ
- thêm consumer cho:
  - `inventory.reserved`
  - `inventory.rejected`
  - `payment.authorized`
  - `payment.failed`

### Phase 5: Hoàn thiện GraphQL API

- chuẩn hóa `OrderCommandResult`
- thêm `sellerOrders`
- thêm `adminOrders`
- thêm `orderTimeline`
- chuẩn hóa error mapping cho conflict / invalid state / not found

### Phase 6: Test và tài liệu

- test aggregate theo kiểu given/when/then
- test command handlers bằng mock readers/repos
- test projector idempotency
- viết guide test end-to-end:
  - buyer login
  - cart
  - create order
  - submit order
  - giả lập payment/inventory event
  - query read model

---

## 18. Kết luận

Nếu mục tiêu của bạn là học sâu, thì `order-subgraph` nên là service được làm bài bản nhất trong repo.

Chốt hướng cuối cùng:

- `product` giữ tương đối thực dụng
- `cart` giữ gọn để hỗ trợ buyer flow
- `order` là nơi học `CQRS + DDD + Event Sourcing + Event-Driven`
- `payment` là nơi học thêm mô hình blockchain-inspired

Flow mục tiêu cuối cùng nên là:

```text
buyer login
  -> cart
  -> create order
  -> append event store
  -> update projection
  -> outbox publish
  -> inventory/payment xử lý
  -> external event quay về order
  -> order append event mới
  -> projection cập nhật
  -> buyer/seller/admin query read model
```

Đây là hướng rất đẹp để vừa làm đồ án, vừa học microservices nâng cao một cách có hệ thống.
