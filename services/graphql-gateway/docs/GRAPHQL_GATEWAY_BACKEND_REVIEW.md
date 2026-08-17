# GraphQL Gateway Backend Review

## 1. Mục tiêu tài liệu

Tài liệu này phân tích `graphql-gateway` dưới góc nhìn thiết kế backend để phục vụ review hệ thống và trả lời phỏng vấn. Trọng tâm không phải là “gateway có những file nào”, mà là:

- Gateway này đang đóng vai trò gì trong kiến trúc tổng thể
- Nó xử lý những gì và cố tình không xử lý những gì
- Cơ chế Apollo Federation đang được dùng ra sao
- Auth context, request context và header forwarding được thiết kế như thế nào
- Những điểm mạnh, trade-off, rủi ro và các câu hỏi phỏng vấn có thể khai thác

## 2. Gateway này đang là gì trong hệ thống?

`graphql-gateway` là lớp vào duy nhất cho GraphQL ở cấp hệ thống, được viết bằng NestJS nhưng thực chất đóng vai trò như một Apollo Federation gateway.

Các subgraph hiện được compose:

- `product-subgraph`
- `cart-subgraph`
- `order-subgraph`

Điểm quan trọng cần hiểu:

- Gateway này không chứa business logic của product/cart/order
- Nó không tự quản lý dữ liệu nghiệp vụ
- Nó không cố verify auth theo domain
- Nó chủ yếu làm nhiệm vụ:
  - compose schema từ nhiều subgraph
  - nhận request GraphQL từ client
  - forward request context xuống subgraph phù hợp

Nói ngắn gọn, đây là lớp orchestration và routing ở cấp GraphQL, không phải application service thực thụ.

## 3. Tổng quan kiến trúc

Các file chính:

- [app.module.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/app.module.ts)
- [main.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/main.ts)
- [gateway.module.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway.module.ts)
- [gateway.service.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway.service.ts)
- [gateway-bootstrap.service.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway-bootstrap.service.ts)
- [gateway-forward-headers.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway-forward-headers.ts)

Stack chính:

- NestJS để bootstrap và tổ chức module
- Apollo Gateway để compose supergraph
- Apollo Server để serve endpoint `/graphql`
- Express 5 middleware để mount GraphQL runtime

Luồng khởi động:

1. Nest boot app
2. `GatewayBootstrapService` được lấy ra từ DI container
3. Service này tạo Apollo Gateway
4. Apollo Server được khởi động với gateway
5. Express middleware được mount tại `/graphql`

Điểm đáng chú ý:

- Gateway không dùng `GraphQLModule` kiểu code-first/schema-first của Nest
- Thay vào đó, nó mount Apollo Server thủ công
- Đây là lựa chọn đúng khi làm federation gateway, vì gateway không phải nơi định nghĩa schema nghiệp vụ

## 4. Cấu hình và discovery subgraph

Trong [gateway.config.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway.config.ts), gateway đọc:

- `PORT`
- `PRODUCT_SUBGRAPH_URL`
- `CART_SUBGRAPH_URL`
- `ORDER_SUBGRAPH_URL`

Mặc định:

- product: `http://127.0.0.1:4002/graphql`
- cart: `http://127.0.0.1:4003/graphql`
- order: `http://127.0.0.1:4004/graphql`

Trong [gateway.service.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway.service.ts), gateway dùng:

- `ApolloGateway`
- `IntrospectAndCompose`

Điều này có nghĩa là:

- Khi khởi động, gateway sẽ introspect schema của từng subgraph
- Sau đó compose thành một supergraph schema duy nhất

Tư duy thiết kế:

- Schema của gateway không được hard-code tại gateway
- Nguồn sự thật về schema nằm ở từng subgraph
- Gateway chỉ tổng hợp và route

Đây là đúng tinh thần federation.

## 5. Vì sao dùng `IntrospectAndCompose`?

`IntrospectAndCompose` phù hợp với giai đoạn dev hoặc hệ thống nhỏ-trung bình vì:

- dễ setup
- thay đổi schema ở subgraph có thể được gateway lấy về khi khởi động lại
- không cần một pipeline quản lý supergraph SDL quá nặng

Nhưng trade-off là:

- gateway phụ thuộc vào việc subgraph phải reachable lúc startup
- nếu một subgraph chết hoặc trả schema lỗi, gateway có thể không compose được
- production lớn thường sẽ muốn dùng quy trình publish schema tập trung hơn

Nói theo ngôn ngữ review:

- Thiết kế hiện tại tối ưu cho đơn giản và tốc độ triển khai
- Chưa tối ưu cho vận hành federation ở quy mô lớn

## 6. Thiết kế request context và header forwarding

Đây là phần quan trọng nhất của gateway.

Trong [gateway-bootstrap.service.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway-bootstrap.service.ts), mỗi request vào `/graphql` sẽ được tạo `context` gồm:

- `authorization`
- `forwardedHeaders`
- `requestId`

### 6.1 `requestId`

Gateway lấy `x-request-id` từ client nếu có, nếu không thì tự sinh bằng `crypto.randomUUID()`.

Ý nghĩa:

- Hỗ trợ trace request xuyên qua gateway và subgraph
- Phù hợp cho debugging, logging, correlation

Đây là một thiết kế rất tốt vì gateway thường là nơi lý tưởng để bắt đầu distributed tracing ở mức đơn giản.

### 6.2 Forward header allowlist

Trong [gateway-forward-headers.ts](/D:/document/study/projects/ECommerce/services/graphql-gateway/src/modules/gateway/gateway-forward-headers.ts), gateway chỉ forward một danh sách header được allow:

- `authorization`
- `x-request-id`
- `x-dev-user-id`
- `x-dev-roles`
- `x-dev-permissions`
- `x-dev-email`
- `x-dev-seller-status`
- `x-dev-kyc-verified`

Đây là một quyết định rất đáng khen.

Vì sao?

- Gateway không forward toàn bộ header của client xuống subgraph
- Nó chỉ cho qua các header đã được chủ động chọn
- Điều này giảm nguy cơ header pollution, spoofing ngoài ý muốn, hoặc coupling ngầm giữa client và subgraph

Nói cách khác:

- Gateway đang đóng vai trò trust boundary
- Nó kiểm soát request context nào được phép đi qua federation boundary

### 6.3 `willSendRequest` ở `RemoteGraphQLDataSource`

Trong `buildService(...)`, gateway tạo `RemoteGraphQLDataSource` cho từng subgraph và dùng `willSendRequest(...)` để set header xuống request đi tới subgraph.

Logic:

- copy `forwardedHeaders`
- nếu context có `authorization` thì set thêm `authorization`
- luôn set `x-request-id`

Điều này tạo ra một hợp đồng rõ ràng:

- Client gửi auth vào gateway
- Gateway không tự decode hay reissue token
- Gateway forward token xuống subgraph
- Subgraph tự chịu trách nhiệm verify token và authorize theo domain của mình

Đây là kiến trúc đúng kiểu “dumb gateway, smart subgraph”.

## 7. Gateway có làm auth không?

Câu trả lời chính xác là: không hẳn.

Gateway này không:

- verify JWT
- gọi user-service để introspect actor
- quyết định role/permission
- chặn mutation theo domain rule

Gateway chỉ:

- forward `Authorization` header
- forward một số dev/test header

Điều đó có nghĩa:

- authn/authz thực sự nằm ở subgraph
- gateway chỉ giữ vai trò trung gian truyền context

Đây là một lựa chọn thiết kế có chủ đích.

### 7.1 Ưu điểm của cách này

- Gateway mỏng, ít business coupling
- Mỗi subgraph tự kiểm soát security theo domain của nó
- Không cần nhồi toàn bộ authorization logic vào gateway
- Dễ mở rộng thêm subgraph mới mà không phải sửa quá nhiều gateway

### 7.2 Trade-off

- Mỗi subgraph phải tự verify và resolve actor
- Có thể bị lặp auth logic giữa các subgraph
- Nếu không có shared auth library/pattern, rất dễ drift

Nói cách khác:

- Thiết kế này tốt nếu team có kỷ luật domain ownership
- Nhưng cũng có giá là phải đầu tư tốt vào shared auth conventions

## 8. Vai trò của gateway trong Federation

Gateway hiện đang phục vụ ba trách nhiệm chính:

### 8.1 Schema composition

- Gom schema từ product/cart/order subgraph
- Tạo supergraph schema thống nhất cho client

### 8.2 Query planning và request dispatch

- Apollo Gateway sẽ quyết định field nào thuộc subgraph nào
- Sau đó chia request và gửi xuống các subgraph tương ứng

### 8.3 Context propagation

- Giữ `authorization`
- Giữ `requestId`
- Giữ các dev header được allow

Điều quan trọng là gateway này không tự thêm business metadata như:

- tenant
- locale
- currency
- customer segment

Nếu sau này hệ thống lớn hơn, đây có thể là nơi hợp lý để enrich thêm request context toàn cục.

## 9. Caching, rate limit, worker: có hay không?

### 9.1 Cache

Trong code hiện tại, gateway không có cache riêng cho:

- GraphQL response
- persisted query
- subgraph introspection result theo chu kỳ dài
- request deduplication

Điều này nói lên:

- Gateway hiện đang tối ưu cho đơn giản hơn hiệu năng tối đa
- Chưa có lớp gateway cache chuyên biệt

### 9.2 Rate limit

Gateway hiện không có middleware rate limit riêng.

Điều này có nghĩa:

- Nếu cần chống abuse, hiện tại trách nhiệm đó có thể đang nằm ở:
  - upstream proxy/load balancer
  - từng subgraph
  - hoặc chưa được triển khai

Đây là một điểm nên note khi review:

- Gateway là nơi rất tự nhiên để áp rate limit global
- Nhưng code hiện tại chưa làm

### 9.3 Worker

Gateway hiện không có background worker.

Lý do hợp lý:

- Gateway không xử lý tác vụ bất đồng bộ nghiệp vụ
- Nó là request/response orchestration layer

## 10. Điểm mạnh kỹ thuật của gateway

- Thiết kế mỏng và đúng vai trò của federation gateway
- Tách hẳn gateway bootstrap khỏi business logic
- Header forwarding có allowlist rõ ràng
- Có `requestId` propagation để hỗ trợ tracing
- Không nhồi domain logic vào gateway
- Dùng `RemoteGraphQLDataSource` theo đúng pattern Apollo Gateway

## 11. Rủi ro, trade-off và điểm cần review kỹ

### 11.1 Gateway đang phụ thuộc vào subgraph availability lúc compose

Vì dùng `IntrospectAndCompose`, nếu subgraph chết hoặc schema lỗi thì gateway có thể không lên được đúng cách.

### 11.2 Auth bị phân tán xuống subgraph

Đây không phải lỗi, nhưng là trade-off:

- subgraph nào cũng phải làm auth tốt
- nếu một subgraph làm ẩu thì toàn hệ thống có điểm yếu

### 11.3 Chưa có global rate limit hoặc global protection tại gateway

Nếu client spam query nặng:

- gateway hiện chưa có lớp chặn riêng

### 11.4 Chưa có response cache hay persisted query strategy

Ở quy mô lớn hơn, đây có thể trở thành bottleneck.

### 11.5 Dev headers được forward qua gateway

Điều này rất tiện cho test/dev, nhưng cần đảm bảo:

- chỉ bật/được chấp nhận ở môi trường phù hợp
- subgraph phải tự kiểm soát việc chấp nhận `x-dev-*`

Nếu không, trust boundary có thể bị yếu đi.

## 12. Câu hỏi phỏng vấn có thể dùng ngay

- Tại sao gateway này không tự verify JWT mà chỉ forward `Authorization` xuống subgraph?
- Khi nào nên để gateway “mỏng”, khi nào nên để gateway “thông minh” hơn?
- Vì sao chỉ forward header theo allowlist thay vì pass-through toàn bộ?
- `IntrospectAndCompose` phù hợp ở giai đoạn nào của hệ thống?
- Nếu một subgraph chết lúc startup thì gateway nên xử lý thế nào?
- Nếu muốn thêm tracing toàn hệ thống, gateway nên enrich request context ra sao?
- Nếu muốn chống GraphQL abuse, nên đặt rate limit ở gateway, subgraph, hay cả hai?

## 13. Tóm tắt ngắn để nhớ

- `graphql-gateway` là lớp Apollo Federation gateway mỏng, chủ yếu làm schema composition, query dispatch và context propagation.
- Nó không chứa business logic domain và cũng không tự làm authorization theo nghiệp vụ.
- Thiết kế hiện tại đúng hướng cho hệ thống đang phát triển nhiều subgraph: gateway mỏng, subgraph tự chịu trách nhiệm auth/domain rule.
- Điểm mạnh lớn là header allowlist và `requestId` propagation.
- Điểm cần chú ý là chưa có global rate limit/cache, và đang phụ thuộc vào `IntrospectAndCompose` nên production scale lớn có thể cần quy trình supergraph chặt hơn.
