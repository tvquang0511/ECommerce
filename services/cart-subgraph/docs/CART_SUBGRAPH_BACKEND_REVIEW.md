# Cart Subgraph Backend Review

## 1. Mục tiêu tài liệu

Tài liệu này review `cart-subgraph` dưới góc nhìn thiết kế backend để phục vụ ôn phỏng vấn và hiểu hệ thống thật kỹ. Mục tiêu không chỉ là biết query/mutation nào đang có, mà là hiểu:

- Cart-subgraph đang đóng vai trò gì trong kiến trúc marketplace
- Vì sao nó dùng Redis làm primary store
- Vì sao nó gọi sang `product-subgraph` để lấy snapshot thay vì tự giữ product catalog
- Cơ chế auth, trust boundary và cách nó lấy `userId` ra sao
- Những điểm mạnh, trade-off và rủi ro thiết kế

## 2. Cart-subgraph là gì trong hệ thống?

`cart-subgraph` là GraphQL subgraph quản lý giỏ hàng của người dùng đã đăng nhập. Nó đứng giữa:

- `product-subgraph`: nguồn sự thật về sản phẩm
- `order-subgraph` trong tương lai: nơi cart có thể được chuyển thành order

Vai trò của nó:

- Lưu trạng thái giỏ hàng theo user
- Cho phép add/update/remove/clear item
- Giữ snapshot hiển thị của product tại thời điểm add vào cart
- Cung cấp entity `Cart` và `CartItem` trong supergraph

Điểm rất quan trọng:

- Cart không phải source of truth cuối cùng cho giá bán
- Cart là trạng thái tạm thời phục vụ UX và bước chuẩn bị trước checkout

Tài liệu hiện có trong `docs/README.md` cũng gợi ý rất rõ điều đó:

- cart giữ snapshot hiển thị
- nhưng không phải nguồn sự thật cuối cùng khi submit order

Đây là một tư duy thiết kế rất đúng với domain giỏ hàng.

## 3. Tổng quan kiến trúc

Các file lõi:

- [app.module.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/app.module.ts)
- [cart.module.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/cart.module.ts)
- [cart.resolver.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/graphql/cart.resolver.ts)
- [cart.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/application/cart.service.ts)
- [product-catalog.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/infrastructure/product-catalog.service.ts)
- [redis.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/redis/redis.service.ts)
- [auth-context.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/auth/auth-context.service.ts)

Stack chính:

- NestJS
- GraphQL Federation Driver
- Redis qua `ioredis`
- Passport JWT cho xác minh token RS256
- HTTP call sang `user-service` để introspect actor
- HTTP GraphQL call sang `product-subgraph` để lấy product snapshot

Kiến trúc tổng thể có thể mô tả là:

- `resolver -> service -> redis/integration service`

Không có database quan hệ hay document store riêng cho cart.

Điều này cho thấy cart được xem là:

- dữ liệu ngắn hạn
- truy cập nhanh
- gắn theo user key
- ít cần query phân tích phức tạp

## 4. Cart-subgraph tích hợp vào Federation ra sao?

Trong [app.module.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/app.module.ts), service dùng:

- `ApolloFederationDriver`
- `autoSchemaFile` với `federation: 2`

Điều đó có nghĩa:

- cart là một subgraph thật sự trong Apollo Federation
- schema được generate code-first
- gateway sẽ compose nó cùng product/order

Ngoài ra, resolver của `CartItem` có:

- `@ResolveField(() => ProductRef) product(...)`

Điều này cực kỳ đáng chú ý.

Nó có nghĩa là:

- Cart item không tự nhúng full product object
- Nó chỉ trả reference `{ __typename: 'Product', id: productId }`
- Federation sẽ để `product-subgraph` resolve entity `Product`

Đây là một thiết kế rất chuẩn federation:

- cart giữ `productId`
- product-subgraph là owner của product details
- cart chỉ giữ snapshot cục bộ cho UX/totals

## 5. Schema GraphQL và API surface

Schema generate trong [schema.gql](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/schema.gql).

### Query

- `cart`

### Mutation

- `addToCart(input)`
- `updateCartItem(input)`
- `removeCartItem(input)`
- `clearCart`

### Kiểu dữ liệu chính

- `Cart`
- `CartItem`
- `CartTotals`
- `Money`

Điều thú vị là API surface này rất gọn.

Điều đó cho thấy tư duy hiện tại là:

- xây đúng cart core
- chưa cố ôm coupon, tax engine, reservation, checkout session
- giữ boundary cart càng rõ càng tốt

Đây là một lựa chọn tốt ở giai đoạn đầu.

## 6. Data model của cart và tư duy snapshot

Trong [cart.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/application/cart.service.ts), cart được biểu diễn bằng `CartEntity` và `CartItemEntity`.

### 6.1 Cart entity

`CartEntity` gồm:

- `id`
- `userId`
- `items`
- `totals`
- `currency`
- `updatedAt`

### 6.2 Cart item entity

`CartItemEntity` gồm:

- `id`
- `productId`
- `quantity`
- `unitPrice`
- `titleSnapshot`
- `imageSnapshot`
- `createdAt`
- `updatedAt`

Điểm quan trọng nhất ở đây là cart item không chỉ lưu `productId`, mà còn lưu snapshot:

- tên sản phẩm
- ảnh
- đơn giá tại thời điểm add/refresh

Tại sao làm vậy?

- Nếu mỗi lần render cart lại phải gọi product-subgraph để lấy mọi thứ, UX sẽ phụ thuộc mạnh vào product service
- Nếu product bị đổi tên/ảnh/giá liên tục, cart vẫn cần một trải nghiệm ổn định ở thời điểm user thao tác

Tư duy này rất thực tế:

- Cart là read model dành cho trải nghiệm mua hàng
- Không phải lúc nào cũng phải phản ánh ngay 100% trạng thái product mới nhất

Nhưng đồng thời, vì cart chỉ là snapshot, nên khi checkout thật:

- hệ thống order vẫn phải re-validate giá và availability

## 7. Redis trong cart-subgraph: cache hay primary store?

Đây là điểm cần hiểu thật kỹ.

Trong README cũng nói rõ:

- Redis là `primary store`
- không cần cache riêng cho cart

Nghĩa là:

- Redis ở đây không phải lớp cache trước DB
- Nó chính là nơi lưu dữ liệu cart gốc

Đây là một quyết định kiến trúc rất hợp lý cho cart.

### 7.1 Vì sao Redis hợp với cart?

Cart có đặc điểm:

- dữ liệu nhỏ
- đọc/ghi nhanh
- gắn theo từng user
- không cần query join phức tạp
- có thể chấp nhận mô hình key-value/document đơn giản

Redis rất phù hợp cho:

- tốc độ cao
- key theo `userId`
- lưu JSON serialized

### 7.2 Trade-off của việc dùng Redis làm primary store

Ưu điểm:

- rất nhanh
- đơn giản
- ít tầng hạ tầng hơn
- phù hợp dữ liệu tạm thời

Nhược điểm:

- không mạnh về truy vấn phân tích
- durability tùy cách cấu hình Redis
- cần cẩn thận nếu cart trở thành dữ liệu nghiệp vụ cần tính nhất quán mạnh hơn

Đây là điểm phỏng vấn rất hay:

- “Cart có thể là một domain hiếm hoi mà Redis làm primary store là hoàn toàn hợp lý.”

## 8. Cart key design

Trong `CartService`, cart được lưu theo key:

- `cart:user:<userId>`

Đây là thiết kế rất rõ ràng:

- 1 user -> 1 cart
- không tin client gửi `userId`
- `userId` luôn lấy từ actor đã auth

Điều này giúp tránh một lỗi bảo mật rất phổ biến:

- user A không thể thao tác vào cart của user B chỉ bằng cách sửa payload

## 9. Phân tích resolver và API behavior

Resolver nằm ở [cart.resolver.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/graphql/cart.resolver.ts).

### 9.1 `cart`

- Yêu cầu `AuthGuard`
- Chỉ user đã đăng nhập mới xem được cart
- Trả `null` nếu user chưa có cart trong Redis

Điểm thiết kế:

- Không hỗ trợ guest cart
- Đây là lựa chọn đơn giản và phù hợp hơn khi hệ thống muốn gắn cart với account thay vì session/anonymous cookie

Trade-off:

- giảm phức tạp merge guest cart -> account cart
- nhưng mất trải nghiệm “thêm vào giỏ trước khi đăng nhập”

### 9.2 `addToCart`

- Yêu cầu `AuthGuard`
- Lấy actor từ token
- Gọi `cartService.addToCart(...)`

Điểm quan trọng trong service:

- nếu cart chưa có thì tạo cart mới
- gọi sang `product-subgraph` để lấy product snapshot
- chỉ cho add product đang `APPROVED`
- nếu item đã có sẵn thì tăng quantity và refresh snapshot
- nếu item chưa có thì thêm item mới
- kiểm tra giới hạn `maxDistinctItems`
- tính lại totals
- lưu lại vào Redis

Đây là nơi tư duy domain hiện rất rõ.

Cart không tin client ở các điểm:

- không tin `userId`
- không tin giá từ client
- không tin product title từ client
- không tin product có hợp lệ hay không

Nó tự resolve product snapshot từ product service.

Đây là thiết kế rất đúng.

### 9.3 `updateCartItem`

- Yêu cầu auth
- Cho phép xác định item bằng `itemId` hoặc `productId`
- Nếu quantity = 0 thì chuyển sang remove
- Nếu không tìm thấy item thì `NotFound`
- Nếu có thì update quantity, updatedAt, totals, rồi save lại

Điểm hay:

- API khá thân thiện cho client
- Client có thể thao tác bằng `productId` nếu không muốn quản lý `itemId`

Trade-off:

- logic match theo `itemId` hoặc `productId` cần thống nhất rõ để tránh ambiguity
- nhưng với mô hình hiện tại mỗi product chỉ xuất hiện một lần trong cart, nên chấp nhận được

### 9.4 `removeCartItem`

- Yêu cầu auth
- Cho phép remove theo `itemId` hoặc `productId`
- Nếu không tìm thấy thì `NotFound`
- Sau khi xóa thì tính lại totals và save

### 9.5 `clearCart`

- Yêu cầu auth
- Xóa toàn bộ `items`
- Reset totals
- Giữ lại cart object

Điều này cho thấy:

- cart không bị delete hẳn khỏi Redis khi clear
- mà trở thành một cart rỗng

Đây là quyết định hợp lý vì:

- giữ đơn giản
- tránh chuyện cart có lúc null có lúc object rỗng trong flow mutation

## 10. Tư duy tích hợp với product-subgraph

Đây là phần rất đáng chú ý về trust boundary.

Trong [product-catalog.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/cart/infrastructure/product-catalog.service.ts), khi add vào cart, service sẽ:

- gọi GraphQL `product(id)` sang `product-subgraph`
- lấy:
  - `id`
  - `name`
  - `price`
  - `currency`
  - `status`
  - `coverImage.objectKey`

Sau đó:

- nếu product không tồn tại -> fail
- nếu product không ở `APPROVED` -> fail
- nếu hợp lệ -> tạo snapshot

Ý nghĩa thiết kế:

- Cart không tự giữ catalog
- Cart không tự quyết định product nào bán được
- `product-subgraph` là source of truth của product visibility

Đây là domain boundary rất đúng:

- product service sở hữu luật “sản phẩm nào được public”
- cart service chỉ tiêu thụ luật đó

## 11. Tại sao chỉ cho add product `APPROVED`?

Đây là một business rule quan trọng.

Nếu product:

- `DRAFT`
- `PENDING_REVIEW`
- `REJECTED`
- `ARCHIVED`

thì không được vào cart.

Tại sao hợp lý?

- Cart là bước chuẩn bị cho mua hàng
- Nếu user add được cả product chưa duyệt, checkout flow sẽ trở nên rất bẩn

Đây là một rule khá đúng với marketplace moderation flow.

## 12. Cơ chế totals hiện tại

`recalculateTotals(cart)` hiện tính:

- `subtotal`
- `discount = 0`
- `tax = 0`
- `total = subtotal`

Điều này cho thấy cart đã chuẩn bị shape dữ liệu cho:

- khuyến mãi
- thuế
- tổng thanh toán

nhưng hiện tại mới chỉ triển khai subtotal cơ bản.

Đây là thiết kế tốt vì:

- GraphQL contract đã sẵn sàng cho tương lai
- không cần phá schema sau này

Nhưng cũng cần nhớ:

- total hiện tại chưa phải checkout total hoàn chỉnh

## 13. Authentication và trust model

Cart-subgraph dùng cùng mô hình auth như product-subgraph.

### 13.1 Luồng auth

1. Nhận Bearer token
2. Verify JWT RS256 bằng public key
3. Tạo actor tối thiểu từ claims
4. Nếu actor chưa có roles/permissions thì gọi `user-service /api/users/auth/introspect`
5. Attach actor vào GraphQL context

Files liên quan:

- [auth.guard.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/auth/guards/auth.guard.ts)
- [jwt.strategy.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/auth/strategies/jwt.strategy.ts)
- [auth-context.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/modules/auth/auth-context.service.ts)

### 13.2 Vì sao cart cần introspect nếu hiện tại chỉ dùng `userId`?

Đây là điểm thú vị.

Hiện tại cart core flow chủ yếu cần:

- `userId`

Nhưng auth layer vẫn được thiết kế sẵn theo chuẩn chung:

- roles
- permissions
- sellerProfile

Điều này cho thấy team đang cố gắng thống nhất auth model giữa các subgraph.

Ưu điểm:

- tái sử dụng pattern
- dễ mở rộng rule sau này

Trade-off:

- cart đang chịu thêm một network hop auth mà hiện tại có thể chưa tận dụng hết

Đây là một điểm rất đáng đem ra phân tích trong review:

- Thiết kế đang ưu tiên consistency giữa các subgraph hơn là tối ưu tối thiểu cho cart.

### 13.3 Dev actor headers

Cart-subgraph cũng hỗ trợ `x-dev-*` header nếu `AUTH_ALLOW_TEST_HEADERS` được bật.

Điều này rất tiện cho:

- test local
- integration test
- demo workflow mà không cần login thật mỗi lần

Nhưng cũng cần kiểm soát chặt ở production.

## 14. Cache, worker, rate limit: có gì và không có gì?

### 14.1 Cache

Cart hiện không có cache riêng vì:

- Redis đã là primary store
- không cần thêm cache layer trên chính Redis cart data

Đây là quyết định hợp lý.

### 14.2 Worker

Cart-subgraph hiện không có worker.

Điều đó dễ hiểu vì:

- cart mutation là lightweight
- chưa có job async như abandoned-cart email, cart cleanup background, reservation expiration

Tuy nhiên, tương lai những chỗ có thể cần worker là:

- abandoned cart reminder
- cleanup cart cũ
- đồng bộ analytics

### 14.3 Rate limit

Hiện tại chưa thấy rate limit trong cart-subgraph.

Đây là một điểm nên note:

- add/update cart rất dễ bị spam
- đặc biệt nếu sau này cart kéo theo reservation, promotion engine hoặc inventory soft hold

## 15. Redis availability strategy

Trong [redis.service.ts](/D:/document/study/projects/ECommerce/services/cart-subgraph/src/redis/redis.service.ts):

- client dùng `lazyConnect: true`
- nếu thao tác Redis fail thì throw `ServiceUnavailableException('Redis unavailable')`

Tư duy này khác `user-service`.

Ở `user-service`, rate limit fail-open khi Redis lỗi.

Ở `cart-subgraph`, Redis là primary store nên:

- Redis lỗi là cart lỗi thật
- không có chuyện fail-open

Đây là một so sánh rất hay khi đi phỏng vấn:

- cùng là Redis
- nhưng vai trò khác nhau thì failure strategy cũng khác nhau

## 16. Điểm mạnh kỹ thuật của cart-subgraph

- Redis được dùng đúng vai trò primary store cho dữ liệu cart ngắn hạn
- Cart không tin dữ liệu product từ client, mà lấy snapshot từ product-subgraph
- Cart không tin client gửi `userId`, mà lấy từ actor đã auth
- API surface gọn, đúng trọng tâm cart core
- Federation được dùng hợp lý qua `ProductRef`
- Shape totals đã chuẩn bị cho tương lai mà chưa làm phức tạp domain hiện tại

## 17. Rủi ro, trade-off và điểm cần review kỹ

### 17.1 Chưa có optimistic locking hoặc concurrency control

Nếu cùng một user mở nhiều tab và update cart đồng thời:

- có thể xảy ra lost update

Hiện tại service đang:

- read cart
- mutate object
- write lại toàn bộ

Đây là pattern đơn giản nhưng có rủi ro race condition.

### 17.2 Chưa có TTL cho cart key

Trong `setJson`, cart đang được lưu mà không truyền TTL.

Điều này có nghĩa:

- cart tồn tại vô thời hạn trong Redis cho đến khi bị ghi đè/xóa

Đây không hẳn là sai, nhưng cần team quyết định rõ:

- có muốn cart hết hạn sau X ngày không?

### 17.3 Snapshot giá có thể stale

Cart cố tình lưu snapshot.

Ưu điểm:

- UX ổn định

Nhược điểm:

- giá trong cart có thể khác giá hiện tại ở product service

Điều này bắt buộc checkout/order step phải reprice.

### 17.4 Auth layer hiện hơi nặng so với nhu cầu cart hiện tại

Vì cart hiện chủ yếu cần `userId`, việc introspect đầy đủ roles/permissions ở mọi request có thể là hơi dư.

Tuy nhiên, nó lại đem lại consistency với các subgraph khác.

### 17.5 Chưa có rule về currency mixing

Cart đang set `cart.currency = snapshot.currency || cart.currency`.

Điều này gợi ra câu hỏi:

- nếu add nhiều product khác currency thì sao?

Hiện tại có vẻ hệ thống đang ngầm giả định một currency thống nhất, ví dụ `VND`.

### 17.6 Chưa có inventory/reservation check

Cart hiện chỉ check product approved.

Nó chưa check:

- stock còn hay hết
- số lượng tối đa
- purchase limit

Điều này hợp lý ở giai đoạn đầu, nhưng checkout bắt buộc phải làm lại các check đó.

## 18. Câu hỏi phỏng vấn có thể dùng ngay

- Vì sao cart lại phù hợp với Redis làm primary store?
- Tại sao cart không nên tin giá sản phẩm từ client?
- Vì sao cart chỉ nên add product `APPROVED`?
- Tại sao cart giữ snapshot tên/giá/ảnh thay vì luôn đọc trực tiếp từ product service?
- Nếu giá đổi sau khi add vào cart thì hệ thống nên xử lý ở bước nào?
- Rủi ro concurrency của mô hình read-modify-write toàn bộ cart là gì?
- Tại sao cart không nên tin `userId` từ payload mà phải lấy từ token?
- Vì sao `CartItem.product` chỉ trả `ProductRef` thay vì full product object?

## 19. Tóm tắt ngắn để nhớ

- `cart-subgraph` là GraphQL subgraph quản lý giỏ hàng của user đã đăng nhập.
- Redis ở đây là primary store chứ không phải cache.
- Khi add item, cart gọi sang `product-subgraph` để lấy snapshot product approved, rồi lưu snapshot vào cart.
- Cart không tin `userId`, không tin giá, không tin trạng thái product từ client.
- Điểm cần review kỹ nhất là concurrency, thiếu TTL, snapshot giá bị stale và việc checkout bắt buộc phải re-validate giá/stock ở bước sau.
