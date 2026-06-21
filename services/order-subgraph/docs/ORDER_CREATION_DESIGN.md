# Thiết kế `createOrderFromCart` và `createOrderDirect`

Tài liệu này chốt bài toán cho 2 luồng tạo order đầu tiên trong `order-subgraph`:

- `createOrderDirect`
- `createOrderFromCart`

Mục tiêu là để sau này khi quay lại repo, bạn đọc lại sẽ nhớ rõ:

- giá trong `cart` có ý nghĩa gì
- giá trong `order` được chốt khi nào
- vì sao `order` phải re-check lại `product`
- cần hoàn thiện những gì để 2 luồng này trở thành order thật, không chỉ là skeleton CQRS

---

## 1. Bối cảnh hiện tại của hệ thống

Hiện tại repo đã có 3 mảnh ghép quan trọng:

- `product-subgraph`: dữ liệu sản phẩm thật, giá thật, trạng thái thật
- `cart-subgraph`: giỏ hàng nằm trên Redis, lưu snapshot để phục vụ trải nghiệm người dùng
- `order-subgraph`: nơi sẽ chốt giao dịch nghiệp vụ

Trong thiết kế này, `order-subgraph` không được tin tuyệt đối vào dữ liệu bên `cart`.

Lý do:

- giá sản phẩm trong `product` có thể thay đổi liên tục
- trạng thái sản phẩm có thể đổi từ `APPROVED` sang `ARCHIVED` hoặc `REJECTED`
- seller có thể cập nhật tên, giá, media

Vì vậy `cart` chỉ nên là đầu vào cho checkout, còn `order` mới là nơi chốt snapshot giao dịch cuối cùng.

---

## 2. Phân biệt rõ `cart snapshot` và `order snapshot`

Đây là điểm quan trọng nhất của 2 luồng tạo order.

### 2.1 Cart snapshot là gì

`cart-subgraph` hiện đang lưu:

- `productId`
- `quantity`
- `titleSnapshot`
- `unitPrice`
- `imageSnapshot`

Snapshot này được dùng để:

- hiển thị cart nhanh
- tính subtotal/total tạm thời trong UI
- cho buyer thấy “gần đúng” trạng thái hiện tại của sản phẩm

Nhưng snapshot này **không phải giá chính thức của giao dịch**.

### 2.2 Order snapshot là gì

`order snapshot` là dữ liệu được chốt tại thời điểm tạo order.

Nó phải đủ để sau này:

- replay event store
- dựng read model
- audit giao dịch
- không cần phụ thuộc ngược vào `cart` hay `product` để biết order đã mua cái gì, với giá nào

Order snapshot cần chứa tối thiểu:

- `buyerId`
- `productId`
- `sellerId`
- `titleSnapshot`
- `imageSnapshot`
- `quantity`
- `unitPriceAmount`
- `currency`
- `lineTotalAmount`
- `sellerIds`
- `orderTotalAmount`

Nói ngắn gọn:

- `cart snapshot` phục vụ UX
- `order snapshot` phục vụ transaction

---

## 3. Quy tắc giá cần chốt

### 3.1 Với `createOrderDirect`

Khi buyer bấm “Mua ngay”, `order-subgraph` phải:

1. gọi `product-subgraph`
2. lấy dữ liệu sản phẩm mới nhất
3. kiểm tra sản phẩm còn hợp lệ để bán
4. chốt giá ngay lúc đó

Tức là `createOrderDirect` luôn dùng **giá live tại thời điểm tạo order**.

### 3.2 Với `createOrderFromCart`

Khi buyer checkout từ cart, `order-subgraph` phải:

1. đọc cart để biết buyer đang muốn mua gì, số lượng bao nhiêu
2. lấy lại dữ liệu product mới nhất từ `product-subgraph`
3. tính lại snapshot order từ dữ liệu product hiện tại
4. chốt giá mới để tạo order

Tức là `createOrderFromCart` **không lấy `cart.totals` làm total chính thức**.

### 3.3 Tại sao phải làm như vậy

Nếu không re-check giá ở bước tạo order, hệ thống sẽ gặp các vấn đề:

- giá trong cart đã cũ nhưng order vẫn dùng giá cũ
- sản phẩm đã bị ẩn hoặc archived nhưng vẫn tạo order được
- product và order lệch nhau, khó audit

Trong e-commerce thực tế, điều bình thường là:

- buyer thêm sản phẩm vào cart lúc giá A
- đến khi checkout, giá đã thành B
- order phải chốt theo rule hiện tại của hệ thống, không theo cart snapshot cũ

---

## 4. Rule nghiệp vụ đề xuất cho project này

Để vừa thực tế vừa không quá nặng cho đồ án, mình đề xuất chốt rule như sau:

### Rule 1

`cart` chỉ là dữ liệu tạm cho trải nghiệm người dùng.

### Rule 2

`order` là nơi chốt snapshot giao dịch chính thức.

### Rule 3

`createOrderDirect` luôn lấy giá mới nhất từ `product-subgraph`.

### Rule 4

`createOrderFromCart` luôn re-price lại toàn bộ item từ `product-subgraph`.

### Rule 5

Náº¿u product không còn `APPROVED`, không tạo order.

### Rule 6

Náº¿u currency không đồng nhất giữa các item, fail luôn ở phase đầu.

### Rule 7

Ở phase đầu, khi giá giữa cart snapshot và giá mới lệch nhau, không cần giữ lại giá cũ của cart. Hệ thống chốt luôn theo giá mới khi tạo order.

### Rule 8

Sau này nếu muốn nâng UX, có thể thêm `previewCheckout` để báo cho buyer:

- sản phẩm nào đã đổi giá
- sản phẩm nào không còn bán được

Nhưng phase hiện tại chưa cần.

---

## 5. Mục tiêu cuối cùng của 2 command tạo order

Sau khi chạy thành công:

- `createOrderDirect`
- `createOrderFromCart`

hệ thống phải tạo được một `draft order` hoàn chỉnh về mặt nghiệp vụ.

Draft order đó cần có:

- `orderId`
- `buyerId`
- `items[]`
- `sellerIds[]`
- `totalAmount`
- `currency`
- `status = DRAFT`
- `inventoryStatus = NOT_REQUESTED`
- `paymentStatus = NOT_REQUESTED`

Điểm quan trọng:

- đây không còn là “draft kỹ thuật”
- đây là “draft nghiệp vụ” đã đủ dữ liệu để submit, lưu event store, dựng projection và audit

---

## 6. Thiết kế luồng `createOrderDirect`

### 6.1 Ý nghĩa nghiệp vụ

Buyer đang ở trang sản phẩm và muốn mua ngay, không cần đi qua cart.

Đây là luồng giống:

- Shopee “Mua ngay”
- Lazada “Mua ngay”
- Amazon “Buy now”

### 6.2 Input tối thiểu

- `productId`
- `quantity`
- `idempotencyKey`

### 6.3 Flow đề xuất

```text
GraphQL mutation createOrderDirect
  -> CommandBus
  -> CreateOrderDirectHandler
  -> ProductReaderService.getProductForDirectOrder(productId)
  -> validate product status + quantity
  -> build OrderItemSnapshot
  -> tính total
  -> OrderAggregate.createDirect(...)
  -> append event store
  -> publish EventBus
  -> projector seed read model
```

### 6.4 Validate cần có

- `quantity > 0`
- product tồn tại
- product `APPROVED`
- product có `sellerId`
- product có `price` hợp lệ
- currency hợp lệ

### 6.5 Snapshot cần chốt

- `productId`
- `sellerId`
- `titleSnapshot`
- `imageSnapshot`
- `quantity`
- `unitPriceAmount`
- `currency`

### 6.6 Event cần sinh

`OrderCreatedDirect`

Event này nên mang đầy đủ dữ liệu snapshot, không chỉ mỗi `productId`.

---

## 7. Thiết kế luồng `createOrderFromCart`

### 7.1 Ý nghĩa nghiệp vụ

Buyer đã gom hàng trong cart, giờ muốn checkout.

### 7.2 Input tối thiểu

- `cartId` hoặc ngầm hiểu cart của `buyerId`
- `idempotencyKey`

### 7.3 Flow đề xuất

```text
GraphQL mutation createOrderFromCart
  -> CommandBus
  -> CreateOrderFromCartHandler
  -> CartReaderService.readBuyerCart(...)
  -> validate cart không rỗng
  -> gom productId + quantity từ cart
  -> ProductReaderService.getProductsForCheckout(...)
  -> re-price lại toàn bộ item
  -> build OrderItemSnapshot[]
  -> tính total
  -> OrderAggregate.createDraft(...)
  -> append event store
  -> publish EventBus
  -> projector seed read model
```

### 7.4 Validate cần có

- cart tồn tại
- cart thuộc buyer
- cart không rỗng
- mọi item có `quantity > 0`
- mọi product đều tồn tại
- mọi product đều `APPROVED`
- mọi product đều có dữ liệu giá hợp lệ
- currency đồng nhất

### 7.5 Điều quan trọng nhất

`createOrderFromCart` không được:

- tin `cart.totals`
- tin `cart.unitPrice` là giá cuối cùng

Nó chỉ nên dùng cart để biết:

- buyer đang muốn mua sản phẩm nào
- số lượng bao nhiêu

Còn giá chính thức phải lấy lại từ `product-subgraph`.

### 7.6 Event cần sinh

`OrderCreatedFromCart`

Event này cũng phải mang đủ snapshot item và total.

---

## 8. Dữ liệu nào nên nằm ở đâu

### 8.1 Cart giữ gì

Cart giữ:

- item tạm
- quantity
- title snapshot để hiển thị
- price snapshot để hiển thị
- image snapshot để hiển thị

Cart không phải nơi chốt giao dịch.

### 8.2 Order giữ gì

Order giữ:

- snapshot giao dịch đã chốt
- total chính thức
- sellerIds
- event history
- read model

### 8.3 Product giữ gì

Product giữ:

- catalog hiện tại
- giá hiện tại
- trạng thái hiện tại
- seller sở hữu sản phẩm

---

## 9. Aggregate cần được nâng cấp ra sao

Hiện tại aggregate mới giữ phần khung:

- `id`
- `buyerId`
- `currency`
- `status`
- `inventoryStatus`
- `paymentStatus`

Để 2 luồng tạo order trở thành order thật, aggregate nên giữ thêm:

- `items`
- `sellerIds`
- `totalAmount`

Nếu không có các field này, aggregate vẫn chạy được về mặt kỹ thuật, nhưng chưa đủ mạnh về mặt domain.

### 9.1 State đề xuất

```text
OrderAggregate
  - id
  - buyerId
  - items[]
  - sellerIds[]
  - totalAmount
  - currency
  - status
  - inventoryStatus
  - paymentStatus
  - version
```

### 9.2 Lợi ích

Khi đó:

- event replay dựng được order gần như hoàn chỉnh
- projector không cần đi hỏi ngược service khác
- test aggregate rõ nghĩa hơn

---

## 10. Event payload nên chứa gì

### 10.1 `OrderCreatedDirect`

Nên có:

- `orderId`
- `buyerId`
- `items`
- `sellerIds`
- `totalAmount`
- `currency`

### 10.2 `OrderCreatedFromCart`

Nên có:

- `orderId`
- `buyerId`
- `cartId` nếu muốn trace
- `items`
- `sellerIds`
- `totalAmount`
- `currency`

### 10.3 Vì sao event phải béo hơn hiện tại

Vì event sourcing cần:

- replay
- audit
- projection

Nếu event chỉ có `buyerId` và `currency` thì event store chưa đủ giá trị nghiệp vụ.

---

## 11. Projection cần phản ánh điều gì

Khi tạo order xong, read model phải phản ánh ngay:

- order nào vừa được tạo
- buyer nào tạo
- các seller liên quan
- order gồm các item nào
- giá đã chốt là bao nhiêu

### 11.1 `orders_read`

Nên lưu:

- `orderId`
- `buyerId`
- `sellerIds`
- `status`
- `inventoryStatus`
- `paymentStatus`
- `totalAmount`
- `currency`
- `version`

### 11.2 `order_items_read`

Nên lưu:

- `lineId`
- `orderId`
- `productId`
- `sellerId`
- `titleSnapshot`
- `quantity`
- `unitPriceAmount`
- `currency`

---

## 12. Những tình huống cần nghĩ tới

### 12.1 Giá đổi sau khi thêm vào cart

Đây là case bình thường.

Kết quả mong muốn:

- cart vẫn hiển thị snapshot cũ cho tới lúc checkout
- khi `createOrderFromCart`, order chốt theo giá mới nhất

### 12.2 Product bị archived sau khi đã có trong cart

Kết quả mong muốn:

- cart vẫn còn item đó cho tới khi buyer chỉnh sửa
- nhưng `createOrderFromCart` phải fail

### 12.3 Buyer bấm mua ngay với quantity không hợp lệ

Kết quả mong muốn:

- reject ngay ở `createOrderDirect`

### 12.4 Một cart có nhiều seller

Kết quả mong muốn ở phase đầu:

- vẫn cho tạo một order chung
- lưu `sellerIds[]`

Sau này nếu muốn học sâu hơn, có thể tách thành:

- `checkout session`
- rồi sinh nhiều order con theo seller

Nhưng phase hiện tại chưa cần.

---

## 13. Quyết định kiến trúc chốt cho phase này

Để dễ nhớ, đây là bộ quyết định ngắn gọn:

- `cart` là nơi lưu dữ liệu tạm cho UX
- `order` là nơi chốt snapshot giao dịch chính thức
- `createOrderDirect` dùng giá live từ `product`
- `createOrderFromCart` re-price lại từ `product`
- `order` không tin `cart.totals`
- event tạo order phải mang đủ snapshot item và total
- aggregate phải giữ `items`, `sellerIds`, `totalAmount`
- projector phải seed cả `orders_read` và `order_items_read`

---

## 14. Thứ tự implement hợp lý

Sau khi chốt thiết kế này, thứ tự làm nên là:

1. tạo type snapshot chuẩn cho order item
2. nâng `ProductReaderService`
3. nâng `CartReaderService`
4. hoàn thiện `CheckoutPricingService`
5. nâng event `OrderCreatedDirect` và `OrderCreatedFromCart`
6. nâng `OrderAggregate`
7. nâng projector + projection repo
8. test `createOrderDirect`
9. test `createOrderFromCart`

---

## 15. Kết luận

Muốn `createOrderFromCart` và `createOrderDirect` trở thành order thật, điểm mấu chốt không nằm ở việc thêm nhiều command, mà nằm ở việc:

- chốt rule giá đúng
- phân biệt rõ cart snapshot và order snapshot
- re-check product tại thời điểm tạo order
- lưu snapshot giao dịch đầy đủ vào event store và read model

Nếu làm đúng phần này, `submitOrder`, outbox, inventory và payment phía sau sẽ rất tự nhiên và đúng tinh thần CQRS + Event Sourcing.
