# order-subgraph - Thiết kế học CQRS, Event Sourcing và Event-Driven

Tài liệu này mô tả hướng thiết kế `order-subgraph` cho đồ án của bạn theo mục tiêu học tập:

- thực hành DDD, CQRS, Event Sourcing
- thực hành Event-Driven với RabbitMQ
- nối hợp lý với `user-service`, `product-subgraph`, `cart-subgraph`
- mở đường để biến `payment-service` thành service học về blockchain
- để sau này còn tích hợp AI mà không phải đập lại kiến trúc

`order-subgraph` không nên chỉ là một service CRUD đơn giản. Đây nên là service trung tâm để bạn học đúng bài toán microservices nâng cao: command side, query side, event store, projection, outbox, integration events, saga từng bước.

---

## 1. Mục tiêu học tập

`order-subgraph` nên giúp bạn học được 5 lớp kiến thức:

1. Nghiệp vụ e-commerce thực tế ở mức vừa đủ
2. DDD: aggregate, value object, invariant, bounded context
3. CQRS: tách command model và query model
4. Event Sourcing: lưu sự kiện thay vì chỉ lưu trạng thái cuối
5. Event-Driven: phát sự kiện sang các service khác bằng RabbitMQ

Nếu làm tốt phần này, sau đó bạn có thể dùng cùng nền tảng để học:

- Saga orchestration/choreography
- payment bằng blockchain
- inventory reservation
- notification workflow
- AI recommendation, fraud detection, support assistant

---

## 2. Vai trò của order trong toàn hệ thống

Trong hệ thống marketplace của bạn, `order-subgraph` là nơi chuyển trạng thái từ:

`buyer đang chọn hàng` -> `buyer chốt mua` -> `hệ thống tạo giao dịch nghiệp vụ`

Nói đơn giản:

- `cart-subgraph` lo trải nghiệm gom hàng
- `product-subgraph` lo catalog và quyền bán
- `user-service` lo danh tính, role, seller, admin
- `order-subgraph` lo giao dịch mua bán
- `payment-service` lo thanh toán
- `inventory-service` lo giữ hàng và trừ tồn

Vì vậy `order-subgraph` là nơi phù hợp nhất để bạn thực hành CQRS + Event Sourcing.

---

## 3. Phạm vi nên làm cho đồ án

### 3.1 In-scope cho phase học CQRS + ES

- tạo đơn hàng từ cart
- tạo đơn hàng từ payload items nếu cần
- snapshot giá, tên, sellerId, productId tại thời điểm đặt hàng
- submit order
- reserve inventory thông qua event
- khởi tạo payment thông qua event
- cập nhật trạng thái order khi inventory/payment phản hồi
- hủy order theo rule
- query order theo buyer
- query order theo seller
- query order theo admin

### 3.2 Out-of-scope ở giai đoạn đầu

- refund phức tạp
- shipment thật
- split shipment
- partial return
- dispute workflow
- commission/payout thật cho seller

Mình khuyên giai đoạn đầu đừng ôm quá nhiều. Hãy làm chắc một luồng:

`checkout từ cart -> tạo order -> reserve stock -> tạo payment -> payment thành công/thất bại -> order đổi trạng thái`

---

## 4. Thiết kế nghiệp vụ thực tế cho order

### 4.1 Actor liên quan

- `BUYER`: tạo và theo dõi order của chính mình
- `SELLER`: xem các order chứa sản phẩm của shop mình
- `ADMIN_OPERATIONS`: xem và xử lý order ở góc vận hành
- `SUPER_ADMIN`: xem toàn bộ

### 4.2 Nguyên tắc nghiệp vụ quan trọng

- buyer chỉ được tạo order từ sản phẩm đang bán hợp lệ
- order phải lưu snapshot, không phụ thuộc hoàn toàn vào product hiện tại
- giá trong cart chỉ là tham khảo UX, giá lúc tạo order phải được chốt lại
- order là giao dịch nghiệp vụ nên mọi thay đổi quan trọng phải có event
- payment và inventory không nên update order trực tiếp qua DB
- payment và inventory nên giao tiếp với order qua integration events

### 4.3 Luồng nghiệp vụ chính đề xuất

```text
Buyer đăng nhập
  -> thêm hàng vào cart
  -> checkout
  -> order-service lấy cart snapshot
  -> validate lại product / giá / seller / trạng thái bán
  -> tạo OrderSubmitted
  -> phát event reserve inventory
  -> phát event create payment
  -> chờ inventory + payment phản hồi
  -> nếu đủ điều kiện -> confirm order
  -> nếu lỗi -> cancel order
```

---

## 5. Vì sao order là chỗ rất hợp để học CQRS

Order là domain có nhiều rule, nhiều trạng thái, nhiều side effect. Nếu bạn chỉ dùng CRUD thì rất nhanh rối:

- ai được sửa khi nào
- lúc nào được hủy
- payment fail thì sao
- inventory fail thì sao
- event nào xảy ra trước
- retry có bị nhân đôi không

CQRS giúp tách rõ:

- command side: quyết định nghiệp vụ
- query side: tối ưu để đọc

Event Sourcing giúp bạn:

- nhìn được toàn bộ lịch sử thay đổi
- replay để rebuild aggregate
- kiểm soát concurrency rõ ràng
- dễ học event-driven bài bản hơn

---

## 6. Bounded Context và ranh giới service

### 6.1 Order context nên sở hữu

- order aggregate
- order item snapshot
- trạng thái giao dịch nghiệp vụ của order
- lịch sử event nội bộ của order
- projection để đọc order

### 6.2 Order context không nên sở hữu

- user profile gốc
- product catalog gốc
- cart gốc
- số lượng tồn kho gốc
- blockchain transaction thật

Order chỉ nên giữ snapshot của dữ liệu cần cho giao dịch, ví dụ:

- buyerId
- productId
- sellerId
- titleSnapshot
- unitPriceSnapshot
- currency

---

## 7. Aggregate và mô hình domain

### 7.1 Aggregate chính

- `Order`

### 7.2 Value Objects nên có

- `Money`
- `OrderItemSnapshot`
- `BuyerInfoSnapshot`
- `SellerInfoSnapshot` nếu bạn muốn mở rộng
- `AddressSnapshot` nếu sau này có shipping

### 7.3 Entity bên trong aggregate

- `OrderItem`

### 7.4 Trạng thái order nên dùng

MVP nhưng vẫn đủ đẹp để học:

- `DRAFT`
- `SUBMITTED`
- `AWAITING_INVENTORY`
- `AWAITING_PAYMENT`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Nếu muốn đơn giản hơn giai đoạn đầu:

- `DRAFT`
- `SUBMITTED`
- `CONFIRMED`
- `CANCELLED`
- `FAILED`

Mình nghiêng về phương án đầu, vì nó giúp bạn học event-driven rõ hơn.

---

## 8. Event Sourcing: thiết kế event store

Mình khuyên dùng Postgres cho event store vì repo của bạn đã có sẵn Postgres trong môi trường dev.

### 8.1 Bảng event store đề xuất

`order_events`

- `id` uuid primary key
- `aggregate_id` text
- `aggregate_type` text
- `sequence` int
- `event_type` text
- `event_data` jsonb
- `metadata` jsonb
- `occurred_at` timestamptz

### 8.2 Metadata nên có

- `requestId`
- `actorId`
- `actorRoles`
- `idempotencyKey`
- `causationId`
- `correlationId`
- `source`

### 8.3 Index nên có

- unique `(aggregate_id, sequence)`
- index `(aggregate_id)`
- index `(occurred_at)`
- index `(event_type)`

### 8.4 Optimistic concurrency

Mỗi command nên mang `expectedVersion`.

Khi append event:

- load version hiện tại
- nếu `expectedVersion` không khớp thì fail
- trả lỗi kiểu conflict

Đây là phần rất quan trọng để học đúng tinh thần Event Sourcing.

---

## 9. Events nội bộ của order aggregate

Các domain event nên bắt đầu đơn giản nhưng đủ ý:

- `OrderDraftCreated`
- `OrderCreatedFromCart`
- `OrderItemAdded`
- `OrderItemQuantityUpdated`
- `OrderItemRemoved`
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

Không nhất thiết implement hết ngay từ đầu, nhưng nên chốt danh sách tư duy trước để không vẽ sai kiến trúc.

---

## 10. CQRS: command side

Command side chỉ lo:

- nhận mutation
- load aggregate từ event store
- validate business rule
- quyết định event mới
- append event
- đưa event vào outbox để publish ra RabbitMQ

### 10.1 Các command đề xuất

- `CreateOrderFromCartCommand`
- `CreateOrderCommand`
- `SubmitOrderCommand`
- `ConfirmOrderCommand`
- `CancelOrderCommand`
- `MarkInventoryReservedCommand`
- `MarkInventoryRejectedCommand`
- `MarkPaymentAuthorizedCommand`
- `MarkPaymentFailedCommand`

### 10.2 Các business rule quan trọng

- không tạo order nếu cart rỗng
- không submit order nếu thiếu item hợp lệ
- không confirm order nếu chưa qua inventory và payment
- không hủy order đã confirmed nếu phase đầu chưa có rule hoàn tiền
- command phải idempotent nếu client retry

---

## 11. CQRS: query side

Query side không replay event mỗi lần đọc. Thay vào đó, nó đọc projection.

### 11.1 Projection tối thiểu

`orders_read`

- orderId
- buyerId
- status
- totalAmount
- currency
- createdAt
- updatedAt
- version

`order_items_read`

- orderId
- lineId
- productId
- sellerId
- titleSnapshot
- quantity
- unitPriceAmount
- currency

### 11.2 Projection mở rộng

`seller_orders_read`

- sellerId
- orderId
- buyerId
- status
- subtotalBySeller

`order_timeline_read`

- orderId
- eventType
- occurredAt
- summary

### 11.3 Query GraphQL đề xuất

- `order(id: ID!): Order`
- `myOrders(input: MyOrdersFilterInput): OrderConnection!`
- `sellerOrders(input: SellerOrdersFilterInput): OrderConnection!`
- `adminOrders(input: AdminOrdersFilterInput): OrderConnection!`
- `orderTimeline(orderId: ID!): [OrderTimelineEntry!]!`

---

## 12. Tích hợp với cart-subgraph

Đây là điểm rất quan trọng để flow toàn hệ thống mượt.

### 12.1 Hướng đề xuất

`order-subgraph` khi checkout sẽ gọi `cart-subgraph` để lấy cart hiện tại của buyer.

Sau đó:

- validate cart không rỗng
- validate lại product availability
- snapshot item sang order
- tính lại tổng tiền

### 12.2 Không nên làm

- không nên để client gửi toàn bộ giá từ frontend rồi tin luôn
- không nên để order phụ thuộc hoàn toàn vào read model của cart

### 12.3 Nên làm

- cart là nguồn dữ liệu đầu vào
- order là nơi chốt snapshot nghiệp vụ cuối cùng

---

## 13. Tích hợp với product-subgraph

Order không nên tin cart 100% ở bước checkout. Nó nên re-check thông tin cần thiết từ product.

### 13.1 Thông tin cần check

- product có tồn tại không
- product có `APPROVED` không
- seller có đang active không nếu bạn muốn chặt hơn
- giá hiện tại là bao nhiêu
- currency là gì

### 13.2 Quyết định nghiệp vụ

Nếu giá hiện tại lệch so với cart snapshot:

- hoặc fail checkout và yêu cầu buyer xác nhận lại
- hoặc tự cập nhật snapshot mới rồi trả về preview

Cho đồ án học tập, mình khuyên:

- phase đầu: fail checkout nếu giá lệch
- phase sau: thêm `previewCheckout`

---

## 14. RabbitMQ và Event-Driven

Đây là chỗ rất hợp để bạn học đúng bài về integration events.

### 14.1 Vì sao cần outbox

Nếu append event vào DB xong mà publish RabbitMQ lỗi thì hệ thống lệch trạng thái.

Do đó nên có:

- event store cho domain events
- outbox table cho integration events

### 14.2 Bảng outbox đề xuất

`order_outbox`

- `id` uuid
- `aggregate_id`
- `event_type`
- `payload` jsonb
- `headers` jsonb
- `published_at` timestamptz null
- `created_at` timestamptz
- `retry_count` int

### 14.3 Worker publish outbox

Bạn có thể làm worker nhỏ riêng hoặc làm process nền trong `order-subgraph` phase đầu.

Worker sẽ:

- poll `order_outbox`
- publish sang RabbitMQ
- đánh dấu `published_at`

### 14.4 Integration events nên có

- `order.submitted`
- `order.inventory.reservation.requested`
- `order.payment.requested`
- `order.confirmed`
- `order.cancelled`
- `order.failed`

---

## 15. Thiết kế học RabbitMQ phù hợp

Mục tiêu không chỉ là “gửi message cho có”, mà là học đúng pattern.

### 15.1 Exchange và queue gợi ý

Exchange:

- `order.events`
- `inventory.events`
- `payment.events`
- `notification.events`

Queue:

- `inventory.reserve.request`
- `payment.create.request`
- `order.inventory.result`
- `order.payment.result`
- `notification.order.created`

### 15.2 Routing key gợi ý

- `order.submitted`
- `order.inventory.requested`
- `order.payment.requested`
- `inventory.reserved`
- `inventory.rejected`
- `payment.authorized`
- `payment.failed`

### 15.3 Semantics nên học

- at-least-once delivery
- idempotent consumer
- retry và dead-letter queue
- correlationId để nối chuỗi workflow

---

## 16. Saga: nên học như thế nào trong đồ án này

Order là chỗ rất hợp để học saga.

### 16.1 Giai đoạn đầu

Chưa cần làm saga framework phức tạp. Chỉ cần workflow event-driven đơn giản:

```text
OrderSubmitted
  -> publish inventory request
  -> publish payment request
  -> chờ kết quả
  -> nếu cả hai ok -> confirm
  -> nếu một trong hai fail -> cancel/fail
```

### 16.2 Giai đoạn sau

Bạn có thể học 2 hướng:

- choreography: service tự phản ứng bằng event
- orchestration: order service cầm luồng điều phối

Cho đồ án học tập, mình khuyên:

- phase 1 dùng choreography nhẹ
- phase 2 nếu muốn học sâu hơn thì thêm `order-process-manager`

---

## 17. Payment service theo hướng blockchain

Đây là ý tưởng rất hay cho project học tập.

Bạn không cần biến payment thành blockchain thật 100%, mà nên thiết kế nó như một `blockchain-inspired payment service`.

### 17.1 Mục tiêu học tập của payment-service

- học transaction lifecycle
- học wallet/address
- học xác nhận thanh toán bất đồng bộ
- học event-driven callback
- học cách map trạng thái on-chain/off-chain vào domain order

### 17.2 Thiết kế mức MVP

`payment-service` có thể mô phỏng:

- tạo payment intent
- sinh địa chỉ ví hoặc payment reference
- chờ “blockchain confirmation”
- publish `payment.authorized` hoặc `payment.failed`

### 17.3 Trạng thái payment gợi ý

- `PENDING`
- `AWAITING_CONFIRMATION`
- `CONFIRMED`
- `FAILED`
- `EXPIRED`

### 17.4 Cách nối với order

`order-subgraph` phát `order.payment.requested`

`payment-service`:

- consume event
- tạo payment record
- mô phỏng blockchain tx
- sau một khoảng thời gian hoặc trigger thủ công:
  - publish `payment.authorized`
  - hoặc `payment.failed`

### 17.5 Blockchain học theo hướng nào

Bạn có thể chọn một trong 3 mức:

1. Mô phỏng blockchain hoàn toàn trong code
2. Tích hợp testnet hoặc local blockchain sau này
3. Học event flow như blockchain mà chưa cần chain thật

Mình khuyên đi theo:

- phase đầu: mô phỏng
- phase sau: local testnet hoặc testnet public

Như vậy bạn vẫn học được domain flow mà không bị sa quá sâu vào hạ tầng từ sớm.

---

## 18. AI nên gắn vào đâu sau này

Bạn nói rất đúng: nếu đã là project học tập thì nên chừa chỗ cho AI.

### 18.1 AI không nên nằm trong core transaction trước

AI không nên quyết định trực tiếp việc append event cốt lõi của order. Core order cần deterministic.

### 18.2 AI nên gắn vào các use case phụ trợ

- gợi ý sản phẩm khi checkout
- phát hiện hành vi gian lận đơn hàng
- tóm tắt timeline order cho admin
- chatbot hỗ trợ buyer/seller
- phân loại nguyên nhân hủy đơn
- dự đoán rủi ro fail payment

### 18.3 Thiết kế để sau này dễ thêm AI

Bạn nên chừa:

- event stream rõ ràng
- read model sạch
- audit log tốt
- notification/event bus ổn định

Khi đó AI chỉ cần đọc projection hoặc event stream, không phải chọc vào core aggregate.

---

## 19. GraphQL API đề xuất cho order-subgraph

### 19.1 Mutations

- `createOrderFromCart(input: CreateOrderFromCartInput!): OrderCommandResult!`
- `submitOrder(input: SubmitOrderInput!): OrderCommandResult!`
- `cancelOrder(input: CancelOrderInput!): OrderCommandResult!`

Phase sau nếu muốn học sâu hơn:

- `retryPayment`
- `adminForceCancelOrder`
- `sellerAcknowledgeOrder`

### 19.2 Queries

- `order(id: ID!): Order`
- `myOrders(input: MyOrdersInput): OrderConnection!`
- `sellerOrders(input: SellerOrdersInput): OrderConnection!`
- `adminOrders(input: AdminOrdersInput): OrderConnection!`
- `orderTimeline(orderId: ID!): [OrderTimelineEntry!]!`

### 19.3 Payload mutation nên trả gì

Mình khuyên mutation không trả object quá béo. Nên trả:

- `orderId`
- `version`
- `status`
- `correlationId`

UI muốn view chi tiết thì query tiếp read model.

Đó là phong cách CQRS sạch hơn.

---

## 20. Cấu trúc thư mục đề xuất

Mình khuyên tách theo module-first giống product/cart đã refactor:

```text
services/order-subgraph/
  src/
    app.module.ts
    main.ts
    modules/
      auth/
        ...
      order/
        order.module.ts
        application/
          commands/
            create-order-from-cart.command.ts
            submit-order.command.ts
            cancel-order.command.ts
          handlers/
            create-order-from-cart.handler.ts
            submit-order.handler.ts
            cancel-order.handler.ts
          queries/
            get-order.query.ts
            list-my-orders.query.ts
          query-handlers/
            get-order.handler.ts
            list-my-orders.handler.ts
          services/
            checkout-pricing.service.ts
        domain/
          aggregate/
            order.aggregate.ts
          events/
            order-created.event.ts
            order-submitted.event.ts
            order-confirmed.event.ts
            order-cancelled.event.ts
          value-objects/
            money.vo.ts
            order-item.vo.ts
          enums/
            order-status.enum.ts
          policies/
            order-policy.ts
        graphql/
          order.resolver.ts
          order.gql.type.ts
          order.input.ts
        infrastructure/
          event-store/
            order-event-store.repo.ts
            order-event.mapper.ts
          projections/
            order-projection.repo.ts
            order-projector.service.ts
          integrations/
            cart-reader.service.ts
            product-reader.service.ts
            inventory-publisher.service.ts
            payment-publisher.service.ts
          outbox/
            order-outbox.repo.ts
            order-outbox.worker.ts
        tests/
          order.aggregate.spec.ts
          create-order-from-cart.handler.spec.ts
          submit-order.handler.spec.ts
```

Nếu sau này saga lớn hơn, có thể tách thêm:

```text
      process-manager/
        order-process-manager.ts
```

---

## 21. Lộ trình implement phù hợp với khóa học Coursera

### Phase 0 - Khởi tạo service

- tạo NestJS order-subgraph
- nối Apollo Federation vào gateway
- dựng auth context giống product/cart

### Phase 1 - Command side tối thiểu

- event store schema
- `Order` aggregate
- `createOrderFromCart`
- `submitOrder`
- optimistic concurrency
- idempotency key

### Phase 2 - Query side

- projection tables
- projector nội bộ
- query `order`, `myOrders`

### Phase 3 - Event-driven với RabbitMQ

- outbox
- publisher worker
- integration events
- consumer kết quả từ inventory/payment

### Phase 4 - Payment blockchain mô phỏng

- `payment-service` consume `order.payment.requested`
- tạo payment intent
- mô phỏng xác nhận blockchain
- publish kết quả về order

### Phase 5 - Inventory flow

- reserve stock
- reject nếu thiếu hàng
- publish `inventory.reserved` hoặc `inventory.rejected`

### Phase 6 - AI extensions

- fraud signal
- smart admin summary
- recommendation around checkout

---

## 22. Thứ tự công việc mình khuyên bạn làm

Nếu muốn vừa học chắc vừa không bị ngợp, thứ tự nên là:

1. dựng skeleton `order-subgraph`
2. viết event store và aggregate trước
3. làm `createOrderFromCart`
4. làm projection và query read model
5. nối gateway
6. test end-to-end từ web/cart sang order
7. thêm outbox + RabbitMQ
8. làm payment-service mô phỏng blockchain
9. làm inventory callback
10. sau cùng mới thêm AI use case

---

## 23. Quyết định kiến trúc mình đề xuất chốt

Để bạn dễ nhớ, đây là bộ quyết định ngắn gọn:

- `order-subgraph` là service trung tâm để học CQRS + Event Sourcing
- dùng Postgres làm event store và projection store
- dùng RabbitMQ cho integration events
- `cart-subgraph` là đầu vào checkout, không phải nơi chốt giao dịch
- `product-subgraph` là nguồn re-check giá/trạng thái bán
- `payment-service` sẽ đi theo hướng blockchain-inspired asynchronous payment
- AI chỉ đọc event/projection, không can thiệp trực tiếp vào core aggregate

---

## 24. Kết luận

Nếu làm theo hướng này, đồ án của bạn sẽ không chỉ là một marketplace demo nữa, mà sẽ trở thành một sandbox rất tốt để học:

- federation
- RBAC thực tế
- CQRS
- Event Sourcing
- RabbitMQ
- saga
- blockchain-inspired payment
- AI integration

Tóm gọn toàn bộ flow mục tiêu:

`buyer login -> cart -> create order -> event store append -> outbox publish -> inventory/payment xử lý -> order cập nhật projection -> buyer/admin/seller query read model`

Đó là một hướng rất đẹp cho đồ án học tập và cũng rất đúng tinh thần khóa `Advanced Microservices with DDD, CQRS, and Event-Driven`.
