# product-subgraph

NestJS service cho sản phẩm, đang dùng MongoDB qua Mongoose theo hướng tối giản: `controller -> service -> model`.

## Dev
- Cài dependencies ở root workspace: `pnpm install`
- Chạy dev: `pnpm --filter product-subgraph dev`

Biến môi trường:
- `MONGO_URI`: chuỗi kết nối MongoDB. Nếu không set, app sẽ dùng `mongodb://127.0.0.1:27017/product-subgraph`.

Default port: `4002`.

## Endpoints
- `GET /`
- `GET /health`
- `GET /products`
- `GET /products/:id`
- `POST /products`
- `PUT /products/:id`
- `DELETE /products/:id`

## Cấu trúc gọn hiện tại
- `src/products/products.controller.ts`
- `src/products/products.service.ts`
- `src/products/product.schema.ts`
- `src/products/dto/create-product.dto.ts`
- `src/products/dto/update-product.dto.ts`

## Data hiện tại
- Dữ liệu nằm trong MongoDB, không còn in-memory.
- API vẫn giữ cùng contract để sau này thay persistence layer sẽ ít ảnh hưởng.
- E2E test đang chạy với `mongodb-memory-server` để không phụ thuộc Mongo thật khi test.

## Lệnh ngắn
- Chạy dev: `pnpm product` hoặc `make product`
- Lint: `pnpm product:lint` hoặc `make product-lint`
- Unit test: `pnpm product:test` hoặc `make product-test`
- E2E test: `pnpm product:e2e` hoặc `make product-e2e`
- Generate Nest file: `pnpm product:g -- controller products --no-spec`
- Generate qua Makefile: `make product-g ARGS="controller products --no-spec"`

## Lộ trình học đề xuất
1. Làm quen NestJS core: `AppModule`, `AppController`, `AppService`.
2. Thêm DTO + validation.
3. Thêm database (Prisma/Mongoose).
4. Sau đó mới thêm GraphQL (Apollo) và cuối cùng mới Federation.

Chốt nền tảng Product REST trước
Mục tiêu: nắm chắc NestJS core theo hướng REST, chưa cần GraphQL.
Việc làm:
Thêm POST /products.
Thêm PUT /products/:id.
Thêm DELETE /products/:id.
Trả mã lỗi chuẩn 404, 400.
Done khi: CRUD chạy ổn qua Postman/Insomnia.
Học DTO + ValidationPipe (bắt buộc cho Nest)
Việc làm:
Tạo CreateProductDto, UpdateProductDto.
Dùng class-validator cho name, price.
Bật ValidationPipe global ở main.ts.
Done khi: request sai dữ liệu bị chặn tự động và có message rõ ràng.
Nâng test để học Jest thực chiến
Việc làm:
Unit test cho ProductsService.
Unit test cho ProductsController.
E2E test thêm case lỗi (id không tồn tại).
Done khi: test không chỉ pass happy path mà có cả case fail.
Chuẩn hóa lint theo từng service (adopt dần)
Hiện đã có shared eslint config rồi, bước tiếp theo là giảm warning dần ở user-service.
Việc làm:
Mỗi tuần xử lý 5-10 warning unsafe-any.
Ưu tiên module auth và middleware trước.
Done khi: warning giảm đều, không phát sinh error mới.
Chốt workflow lệnh ngắn cho team
Việc làm:
Dùng nhất quán make hoặc pnpm scripts (khuyến nghị giữ cả 2).
Viết 1 trang command cheatsheet ngắn cho dev.
Done khi: ai vào repo cũng chạy được trong 2-3 lệnh.
Hoàn thiện infra dev đang dùng
Việc làm:
Dùng tool-up để kiểm tra Redis/Mongo thật sự trong luồng product.
Bổ sung seed script dữ liệu mẫu product.
Done khi: khởi động infra + app + test data trong vài phút.
Sau khi xong REST mới chuyển database thật
Việc làm:
Chọn Prisma hoặc Mongoose cho product.
Thay in-memory bằng repository.
Giữ nguyên contract API.
Done khi: API không đổi, chỉ đổi persistence layer.
Khi REST vững rồi mới quay lại GraphQL/Federation
Việc làm:
Re-enable GraphQL cho product-subgraph.
Kết nối lại gateway.
So sánh REST vs GraphQL để hiểu tradeoff.
Done khi: bạn tự giải thích được khi nào nên dùng REST, khi nào dùng GraphQL.