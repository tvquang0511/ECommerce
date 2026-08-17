# Order Subgraph Backend Review

## 1. Mục tiêu tài liệu

Tài liệu này là bản review sâu cho `order-subgraph`, tập trung vào hai câu hỏi lớn:

1. `order-subgraph` đang mang lại những chức năng gì cho toàn hệ thống?
2. Vì sao nó lại được thiết kế phức tạp hơn rõ rệt so với `product-subgraph` hay `cart-subgraph`?

Mục tiêu không chỉ là mô tả API, mà là hiểu rõ:

- `order` đang là domain owner của điều gì
- các quyết định kiến trúc nào đang được áp dụng
- service này đang giải quyết bài toán consistency, orchestration và integration như thế nào
- những điểm nào đáng khen, điểm nào là trade-off, điểm nào là nợ kỹ thuật hoặc chỗ có thể bị hỏi sâu khi phỏng vấn

Nếu phải chọn một service để nói về kiến trúc “nâng cao” trong dự án này, thì `order-subgraph` là ứng viên số 1.

## 2. Bức tranh ngắn gọn: Order-subgraph thực sự làm gì?

Rất nhiều người mới nhìn vào `order-subgraph` sẽ nghĩ nó chỉ “tạo order”. Thực tế không phải vậy.

Service này đang làm đồng thời nhiều vai trò:

- Nhận purchase intent từ client
- Biến dữ liệu tạm thời từ `cart` hoặc `product` thành một draft order chính thức
- Chốt snapshot order item tại thời điểm tạo order
- Reprice lại trước khi submit để không tin dữ liệu cũ
- Chuyển order từ trạng thái nội bộ sang trạng thái hậu xử lý liên service
- Giao tiếp với inventory/payment theo kiểu bất đồng bộ
- Giữ lịch sử thay đổi dưới dạng event
- Duy trì read model để query nhanh
- Ghi outbox để tách việc lưu trạng thái khỏi việc publish integration event

Nói ngắn gọn:

- `product` là nơi biết sản phẩm là gì
- `cart` là nơi biết người dùng đang định mua gì
- `order` là nơi biến “ý định mua” thành “giao dịch nghiệp vụ chính thức”

Đây chính là lý do service này quan trọng và phức tạp.

## 3. Vì sao order là domain khó nhất trong e-commerce?

Order khó hơn product và cart vì nó nằm đúng ở điểm giao nhau của nhiều ràng buộc:

- dữ liệu phải đáng tin hơn cart
- giá có thể thay đổi theo thời gian
- inventory có thể bị hết hoặc reserve fail
- payment có thể thành công hoặc thất bại
- người dùng có thể hủy
- hệ thống cần biết chính xác chuyện gì đã xảy ra trước đó

Nếu `cart` thiên về UX state, thì `order` thiên về transaction state.

Điều này dẫn tới yêu cầu:

- phải có lifecycle rõ ràng
- phải có versioning/concurrency control
- phải có lịch sử sự kiện
- phải có chiến lược giao tiếp liên service an toàn

Đó là lý do `order-subgraph` không thể chỉ là “một bảng orders + vài mutation”.

## 4. Tổng quan kiến trúc

Các thành phần lõi:

- [app.module.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/app.module.ts)
- [order.module.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/order.module.ts)
- [order.resolver.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/interfaces/graphql/order.resolver.ts)
- [order.aggregate.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/domain/aggregate/order.aggregate.ts)
- [checkout-pricing.service.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/application/services/checkout-pricing.service.ts)
- [order-event-store.repo.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/infrastructure/event-store/order-event-store.repo.ts)
- [order-projection.repo.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/infrastructure/projections/order-projection.repo.ts)
- [order-outbox.repo.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/infrastructure/outbox/order-outbox.repo.ts)
- [order-outbox.worker.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/infrastructure/outbox/order-outbox.worker.ts)

Stack chính:

- NestJS
- GraphQL Federation
- `@nestjs/cqrs`
- PostgreSQL + Prisma
- RabbitMQ publisher
- Schedule worker

Điểm quan trọng nhất về mặt kiến trúc:

- `order-subgraph` không đi theo dạng `resolver -> service -> database`
- nó đang đi theo mô hình:
  - `resolver -> command/query bus -> handler -> aggregate/event store -> projector/outbox`

Đây là bước tiến rất lớn về độ phức tạp so với các subgraph còn lại.

## 5. Các chức năng business mà order-subgraph đang mang lại

Đây là phần rất đáng nhấn mạnh khi ôn phỏng vấn, vì nó giúp bạn không bị sa vào “nói framework”.

### 5.1 Tạo draft order từ cart

Mutation:

- `createOrderFromCart`

Service này cho phép:

- buyer chọn một phần item trong cart
- lấy cart hiện tại
- revalidate product hiện tại
- dựng draft order từ selection đó

Ý nghĩa nghiệp vụ:

- người dùng có thể checkout từ cart
- nhưng order không bị khóa cứng vào toàn bộ cart
- chỉ những item được chọn mới trở thành draft order

Đây là một chức năng rất thực tế của checkout flow.

### 5.2 Tạo draft order trực tiếp từ trang sản phẩm

Mutation:

- `createOrderDirect`

Service này cho phép:

- buy now trực tiếp từ product
- không cần đi qua cart

Ý nghĩa:

- hệ thống hỗ trợ hai purchase flow khác nhau
- `order` là entrypoint chung cho cả hai

Đây là lý do không thể bắt mọi flow đi từ `cart`.

### 5.3 Reprice order trước khi submit

Mutation:

- `submitOrder`

Nhưng trước khi submit thật, service còn:

- load lại draft
- revalidate sản phẩm
- tính lại giá hiện tại
- nếu có thay đổi thì sinh `OrderRepricedEvent`

Chức năng này mang lại giá trị rất lớn:

- tránh tin tuyệt đối vào cart snapshot
- tránh chuyện user giữ cart lâu rồi submit giá cũ
- làm cho order trở thành nguồn dữ liệu đáng tin hơn cart

### 5.4 Submit order và kích hoạt workflow hậu xử lý

Sau khi submit:

- order đổi trạng thái sang `SUBMITTED`
- inventory status -> `PENDING`
- payment status -> `PENDING`
- outbox được ghi để kích hoạt inventory/payment flow

Ý nghĩa:

- submit không có nghĩa là order hoàn tất
- submit chỉ là điểm bắt đầu của hậu xử lý liên service

Đây là một chức năng “điều phối” quan trọng, không đơn thuần là “update status”.

### 5.5 Nhận callback từ inventory và payment

Hai controller nội bộ:

- payment authorized / failed
- inventory reserved / rejected

Chức năng mà service mang lại:

- tiếp nhận kết quả bất đồng bộ từ external workflow
- append thêm event vào order stream
- cập nhật read model
- có thể tự confirm order khi đủ điều kiện

Tức là `order-subgraph` là nơi hội tụ kết quả của các side-effect bên ngoài.

### 5.6 Hủy order

Mutation:

- `cancelOrder`

Chức năng này không chỉ là đổi cờ.

Nó mang ý nghĩa:

- áp dụng rule domain “khi nào còn được hủy”
- ghi event hủy
- cập nhật toàn bộ read model đi kèm

Đây là hành vi business chứ không phải CRUD.

## 6. Vì sao chọn CQRS cho order?

`order-subgraph` dùng `CommandBus` và `QueryBus`.

Đây không phải để “cho vui kiến trúc”, mà vì domain order có hai nhu cầu rất khác nhau:

### Command side

Phía ghi dữ liệu cần:

- validate use case
- enforce lifecycle
- check concurrency
- tạo event
- trigger side-effect nội bộ

### Query side

Phía đọc dữ liệu cần:

- query nhanh
- không replay event store mỗi lần
- trả shape phù hợp cho UI

Nếu dùng chung một model cho cả read/write:

- command dễ bị trộn với query concern
- query sẽ hoặc chậm, hoặc phải chấp nhận model không phù hợp

CQRS ở đây là có lý do rất rõ.

## 7. Aggregate là gì và vì sao rất quan trọng ở service này?

Trong [order.aggregate.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/domain/aggregate/order.aggregate.ts), aggregate là trung tâm business state của order.

Nó giữ:

- buyer
- items
- sellerIds
- totalAmount
- currency
- overall status
- payment status
- inventory status
- version
- selected cart item ids

Điểm quan trọng:

- aggregate không phụ thuộc GraphQL
- aggregate không phụ thuộc Prisma
- aggregate là nơi giữ luật nghiệp vụ cốt lõi

Ví dụ:

- chỉ draft mới được submit
- chỉ draft mới được reprice
- confirmed hoặc cancelled thì không được cancel lại
- inventory reserved + payment authorized thì tự confirm

Đây là thiết kế rất tốt vì business rule không bị rải ra controller hay repo.

## 8. Trạng thái order đang được mô hình hóa như thế nào?

Điểm đáng khen lớn của service này là nó không nhồi tất cả vào một enum duy nhất.

Thay vào đó, nó tách thành 3 chiều:

### 8.1 Order status tổng

- `DRAFT`
- `SUBMITTED`
- `CONFIRMED`
- `FAILED`
- `CANCELLED`

Schema còn có:

- `AWAITING_INVENTORY`
- `AWAITING_PAYMENT`

Nhưng aggregate hiện tại chủ yếu đi qua `SUBMITTED` như một trạng thái chờ chung.

### 8.2 Inventory status

- `NOT_REQUESTED`
- `PENDING`
- `RESERVED`
- `REJECTED`

### 8.3 Payment status

- `NOT_REQUESTED`
- `PENDING`
- `AUTHORIZED`
- `FAILED`
- `EXPIRED`

Tại sao cách này tốt?

- vì payment và inventory là hai tiến trình độc lập
- nếu gộp vào một enum lớn sẽ rất khó quản
- tách ra giúp đọc flow dễ hơn và transition rõ hơn

## 9. Tạo order từ cart: phân tích kỹ

Trong [create-order-from-cart.handler.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/application/commands/create-order-from-cart/create-order-from-cart.handler.ts), flow là:

1. Gọi `CheckoutPricingService.previewFromCart(...)`
2. Service này đọc cart hiện tại
3. Chỉ lấy selected item
4. Revalidate product từ `product-subgraph`
5. Dựng `OrderItemSnapshot`
6. Tạo aggregate draft
7. Append event `OrderCreatedFromCartEvent`
8. Publish event nội bộ

Điểm rất hay:

- order không tin cart snapshot tuyệt đối
- cart chỉ cung cấp selection + quantity + context người dùng
- product service vẫn là nguồn sự thật cho price hiện tại

Đây là quyết định rất chín chắn về boundary:

- `cart` sở hữu selection state
- `product` sở hữu product pricing/catalog state
- `order` hợp nhất hai nguồn thành order snapshot

## 10. Tạo order trực tiếp từ product: phân tích kỹ

Trong [create-order-direct.handler.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/application/commands/create-order-direct/create-order-direct.handler.ts):

1. Gọi `CheckoutPricingService.previewDirect(...)`
2. Service này đọc `product-subgraph`
3. Validate quantity
4. Dựng snapshot trực tiếp
5. Tạo draft aggregate
6. Append `OrderCreatedDirectEvent`

Chức năng mà service mang lại ở đây là:

- hỗ trợ buy-now flow
- tách riêng purchase intent khỏi cart

Điều này rất quan trọng về mặt kiến trúc sản phẩm, không chỉ kiến trúc code.

## 11. Submit order: đây là chức năng quan trọng nhất

`submitOrder` là điểm mà order từ “draft nội bộ” trở thành “workflow chính thức”.

Trong [submit-order.handler.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/application/commands/submit-order/submit-order.handler.ts), flow là:

1. Load full event stream của order
2. Rehydrate aggregate
3. Reprice lại toàn bộ draft items
4. Nếu có thay đổi thì sinh `OrderRepricedEvent`
5. Sinh `OrderSubmittedEvent`
6. Append event vào event store với `expectedVersion`
7. Publish event nội bộ
8. Remove selected cart items

Điểm rất mạnh ở đây:

- submit không phải chỉ “set status = SUBMITTED”
- submit là một checkpoint business rất lớn

Nó đang làm ba việc lớn:

1. re-validate pricing
2. state transition
3. cleanup cart side-effect

## 12. Vì sao phải reprice trước submit?

Đây là một câu rất dễ bị hỏi.

Vì:

- user có thể tạo draft từ lâu
- cart snapshot có thể đã stale
- product có thể đổi giá, đổi salePrice, hoặc bị unapprove

Nếu không reprice:

- order có thể được submit với dữ liệu không còn hợp lệ

Nói cách khác:

- draft order là “working copy”
- submit order là “moment of truth”

Đây là một quyết định thiết kế rất đáng khen.

## 13. Tại sao xóa selected cart items sau submit lại quan trọng?

Nhiều người sẽ nghĩ xóa cart item là chi tiết nhỏ, nhưng thật ra đây là một hành vi business rất đáng chú ý.

Service chỉ xóa selected items sau khi:

- append event thành công
- publish event nội bộ thành công

Điều này mang lại:

- tránh làm mất cart item nếu submit order thất bại giữa chừng
- giữ cho cart và order không bị lệch theo kiểu “cart mất nhưng order chưa được ghi”

Tức là order-subgraph đang rất cẩn thận ở boundary với cart.

## 14. CheckoutPricingService: chức năng và ý nghĩa thiết kế

`CheckoutPricingService` không phải lớp phụ, mà gần như là “pricing gate” của order.

Nó mang lại các chức năng:

- preview order từ cart
- preview order direct
- reprice draft items
- kiểm tra mixed currency

Điểm rất quan trọng:

- pricing ở order không tin hoàn toàn vào cart
- pricing ở order không nên bị nhúng cứng trong resolver
- pricing được gom vào một service chuyên biệt để tái sử dụng và test riêng

Đây là dấu hiệu service đã bắt đầu tách rõ application concern.

## 15. Tích hợp với cart-subgraph: trust boundary đang được xử lý ra sao?

`CartReaderService`:

- gọi GraphQL `cart`
- xác minh cart trả về đúng buyer hiện tại
- trả snapshot item

`CartWriterService`:

- gọi `removeCartItem` từng item

Điểm rất đáng phân tích:

- order-subgraph không đọc trực tiếp Redis của cart
- nó gọi qua public subgraph boundary

Điều này tốt vì:

- giữ service boundary sạch
- tránh coupling vào storage internals của cart

Nhưng trade-off là:

- tốn thêm network hop
- chậm hơn so với gọi thẳng internal DB/Redis

Tức là team đang ưu tiên boundary rõ hơn là tối ưu sớm.

## 16. Tích hợp với product-subgraph: order đang lấy gì và không lấy gì?

`ProductReaderService` đọc:

- `id`
- `sellerId`
- `name`
- `price`
- `salePrice`
- `currency`
- `status`
- `coverImage.objectKey`

Và chỉ chấp nhận product `APPROVED`.

Nó cố ý không lấy:

- mọi chi tiết product không cần cho checkout

Điều này cho thấy:

- order không quan tâm toàn bộ product
- order chỉ cần checkout snapshot tối thiểu

Đây là integration boundary rất đẹp:

- lấy đúng đủ
- không overfetch domain khác

## 17. Event store: lợi ích thực tế mà nó mang lại

`OrderEventStoreRepo` đang làm hai việc rất quan trọng:

1. append event với optimistic concurrency
2. load stream để rehydrate aggregate

Lợi ích thực tế:

- biết được order đã thay đổi như thế nào theo thời gian
- có khả năng replay nếu cần rebuild read model
- dễ debug workflow hơn so với chỉ nhìn một row cuối cùng
- concurrency được kiểm soát bằng `expectedVersion`

Đây là chỗ bạn có thể trả lời rất mạnh trong phỏng vấn:

- “Event store không chỉ là lưu log, mà là nguồn sự thật của write model.”

## 18. Projection/read model đang mang lại giá trị gì?

Nếu chỉ có event store:

- query order sẽ phải replay event mỗi lần
- rất chậm và rất bất tiện cho UI

Projection repo giải quyết chuyện đó bằng cách:

- duy trì `orders_read`
- duy trì `order_items_read`
- cho phép query buyer/seller visibility nhanh
- cập nhật read model theo sequence

Giá trị thực tế:

- UI đọc order nhanh
- query side đơn giản
- event replay không ảnh hưởng trực tiếp tới read performance hàng ngày

## 19. Event handlers: tại sao tách projector và outbox listener?

Trong [events/index.ts](/D:/document/study/projects/ECommerce/services/order-subgraph/src/modules/order/application/events/index.ts), có hai kiểu handler:

- projector handler
- outbox handler

Tại sao phải tách?

Vì event sau khi sinh ra có ít nhất hai loại phản ứng:

1. cập nhật trạng thái query nội bộ
2. chuẩn bị giao tiếp với thế giới bên ngoài

Nếu nhồi hết vào command handler:

- command handler sẽ phình rất to
- coupling nặng
- khó test
- khó mở rộng

Tách như hiện tại là đúng tinh thần event-driven nội bộ.

## 20. Outbox: nó thực sự giải quyết bài toán gì?

`OrderOutboxRepo` và `OrderOutboxWorker` là phần rất đáng học.

Outbox đang làm đúng một việc cực quan trọng:

- đảm bảo side-effect liên service không bị buộc chặt vào transaction ghi nghiệp vụ

Nếu không có outbox:

- append event thành công nhưng publish MQ fail -> hệ thống lệch
- publish MQ xong mà persist state fail -> hệ thống cũng lệch

Outbox giúp biến việc publish message thành:

- tác vụ có thể retry
- có thể quan sát
- có thể chạy độc lập

Đây là pattern rất đúng cho domain order.

## 21. OrderOutboxWorker: chức năng thực tế

Worker này đang:

- chạy định kỳ
- lấy pending outbox
- publish event ra ngoài
- mark published nếu thành công
- tăng `retryCount` nếu fail

Hiện nó xử lý quan trọng nhất là:

- `order.submitted`
  - publish sang inventory
  - publish sang payment

Điều này mang lại chức năng:

- biến submit order thành điểm khởi động cho workflow hậu xử lý liên service

Tức là worker này không chỉ là “background helper”, mà là một phần của purchase orchestration.

## 22. Payment/inventory callback: tại sao phải callback ngược?

Vì `order-subgraph` là nơi sở hữu order state cuối cùng.

Payment và inventory không nên trực tiếp sửa DB của order.

Thay vào đó:

- payment/inventory xử lý ở domain của họ
- rồi callback ngược về order bằng API nội bộ
- order append thêm event mới
- projection update theo domain order

Lợi ích:

- order vẫn là domain owner của order state
- service khác không đụng vào storage của order

Đây là boundary rất đúng, dù hiện tại vẫn cần harden thêm về security callback.

## 23. Chức năng “tự confirm” khi payment + inventory đều ổn

Một điểm rất đẹp trong aggregate là:

- inventory reserved thì mark inventory status
- payment authorized thì mark payment status
- nếu cả hai điều kiện đều đủ thì tự sinh `OrderConfirmedEvent`

Điều này mang lại:

- trạng thái confirmed không cần controller ngoài tự set tay
- logic confirm nằm đúng trong aggregate
- rule business trung tâm được bảo toàn

Đây là một ví dụ rất tốt để nói về domain model mạnh.

## 24. Auth và authorization ở order-subgraph: điều gì thực sự quan trọng?

Auth pattern ở đây giống các subgraph khác:

- verify JWT
- introspect `user-service`

Nhưng điểm quan trọng ở order không phải verified seller guard như product.

Mà là:

- buyer chỉ thấy order của mình
- seller chỉ thấy order có liên quan tới seller đó

Nói cách khác:

- product thiên về actor eligibility
- order thiên về transactional ownership/visibility

Đây là khác biệt domain rất đáng nói.

## 25. Những điểm mạnh lớn nhất của order-subgraph

- Đặt `order` đúng vai trò domain owner của purchase flow
- Reprice trước submit là quyết định cực kỳ đúng
- Event store + projection phản ánh rõ write/read split
- Outbox pattern giúp tích hợp payment/inventory an toàn hơn
- Aggregate giữ business rule trung tâm, không để trôi vào controller
- Callback flow phản ánh đúng eventual consistency của e-commerce

## 26. Những trade-off và rủi ro cần nhìn thẳng

### 26.1 Độ phức tạp rất cao

Service này khó hiểu hơn hẳn các service khác.

Đó là giá phải trả cho:

- CQRS
- event store
- outbox
- integration async

### 26.2 Callback nội bộ cần bảo vệ mạnh hơn

Hiện tại callback controller chủ yếu nhận DTO rồi command bus execute.

Điểm nên hỏi kỹ:

- có shared secret chưa?
- có signature chưa?
- có network isolation/internal gateway chưa?

Nếu chưa, đây là điểm cần harden.

### 26.3 `orders()` đang là placeholder

Resolver `orders()` hiện trả `[]`.

Điều này cho thấy:

- admin/global query side chưa hoàn thiện

### 26.4 Idempotency story cần review thêm

`idempotencyKey` đã có trong command contract, nhưng cần hỏi tiếp:

- có persist thật để deduplicate chưa?
- hay hiện mới chỉ là correlation id ở mức response/logical contract?

### 26.5 Eventual consistency làm UI khó hơn

Sau submit, user có thể thấy:

- order đã tạo
- nhưng payment/inventory chưa xong

Frontend phải biết:

- `SUBMITTED` chưa phải thành công cuối cùng

## 27. Câu hỏi phỏng vấn có thể trả lời rất hay từ service này

- Vì sao `order-subgraph` cần CQRS trong khi `cart-subgraph` thì không?
- Tại sao reprice trước submit là bắt buộc về mặt business?
- Tại sao order nên là entrypoint của checkout, không phải cart?
- Event store khác gì so với bảng `orders` truyền thống?
- Projection đem lại lợi ích gì ngoài performance?
- Outbox giải quyết failure mode nào?
- Khi nào nên gọi sync sang service khác, khi nào nên dùng async MQ?
- Tại sao payment/inventory callback lại phải quay về order thay vì tự sửa trạng thái order ở nơi khác?

## 28. Tóm tắt ngắn để nhớ

- `order-subgraph` là service sở hữu trạng thái order chính thức và là service quan trọng nhất về transactional workflow.
- Nó cho phép tạo draft từ cart hoặc direct product, nhưng trước submit luôn phải reprice để không tin dữ liệu cũ.
- Nó dùng CQRS, aggregate, event store, projection và outbox để giải quyết write model phức tạp, query nhanh và integration an toàn hơn.
- Sau submit, inventory/payment được kích hoạt bất đồng bộ; callback quay về order để append event mới và cập nhật trạng thái.
- Đây là service rất mạnh để nói về kiến trúc nâng cao, nhưng cũng là service có chi phí hiểu, test và vận hành cao nhất trong backend hiện tại.
