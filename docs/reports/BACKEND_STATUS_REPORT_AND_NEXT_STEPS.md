# Báo Cáo Hiện Trạng Backend Và Đề Xuất Công Việc Tiếp Theo

## 1. Mục tiêu của báo cáo

Tài liệu này dùng để:

- Tổng kết chính xác những gì backend của đồ án đã làm được đến thời điểm hiện tại.
- Chỉ ra giá trị học thuật và giá trị kỹ thuật của từng service.
- Làm mốc để quyết định công việc tiếp theo mà không tiếp tục mở rộng domain quá sớm.
- Chuyển trọng tâm từ “xây thêm service mới” sang “vận hành hệ thống như trong môi trường chuyên nghiệp”.

Phạm vi của báo cáo này chỉ tập trung vào backend. Frontend không phải trọng tâm ở giai đoạn hiện tại.

---

## 2. Tổng quan kiến trúc backend hiện tại

Backend của dự án hiện đang đi theo hướng:

- Kiến trúc microservices ở mức học tập nhưng đã có tách domain tương đối rõ.
- Giao tiếp client-facing chủ yếu qua GraphQL/Apollo Federation cho các domain phù hợp.
- Một số service hỗ trợ hoặc callback nội bộ dùng REST để đơn giản hóa flow tích hợp.
- Kết hợp nhiều kiểu lưu trữ tùy domain:
  - PostgreSQL + Prisma cho user-service và order-subgraph.
  - MongoDB cho product-subgraph.
  - Redis cho cart-subgraph và một phần cache/hạ tầng.
- Event-driven communication đã bắt đầu hình thành qua RabbitMQ.
- Order-subgraph là service có chiều sâu kiến trúc nhất, dùng CQRS + DDD + Event Sourcing + Outbox.

Nói ngắn gọn: dự án không còn là CRUD đơn giản nữa, mà đã bắt đầu chạm tới các bài toán kiến trúc backend thực tế như:

- xác thực và phân quyền,
- tách domain,
- read/write model khác nhau,
- eventual consistency,
- event-driven integration,
- worker nền,
- lưu snapshot dữ liệu để chốt nghiệp vụ,
- idempotency và retry.

---

## 3. Báo cáo theo từng service

## 3.1. `user-service`

### Vai trò

Đây là service trung tâm cho danh tính người dùng và quyền truy cập. Nó đang đóng vai trò nền tảng cho toàn bộ hệ thống.

### Những gì đã làm được

- Đăng ký tài khoản, đăng nhập, refresh token, logout.
- Xác minh email và các flow OTP/email liên quan.
- Quên mật khẩu, đặt lại mật khẩu, đổi mật khẩu.
- Quản lý hồ sơ người dùng cơ bản.
- Hỗ trợ seller onboarding:
  - user nộp đơn trở thành seller,
  - theo dõi trạng thái seller,
  - admin duyệt hoặc từ chối seller.
- Hỗ trợ admin workflow:
  - quản lý seller,
  - các role admin đã được nghĩ theo hướng có thể mở rộng.
- Có cơ chế seed dữ liệu dev để test nhanh.
- Có worker mail riêng để xử lý email nền.

### Công cụ/kỹ thuật đang dùng

- Node.js + TypeScript
- Express
- PostgreSQL
- Prisma ORM
- JWT / RBAC
- Redis
- MinIO
- BullMQ/queue cho mail worker
- OpenAPI/Swagger

### Giá trị kỹ thuật

`user-service` cho thấy bạn đã làm được nhiều thứ hơn một auth service cơ bản:

- auth không chỉ có login/register mà còn có lifecycle người dùng tương đối hoàn chỉnh,
- đã có phân vai buyer/seller/admin,
- đã có tư duy tách xử lý nền ra worker,
- đã có chỗ bám để các service khác xác thực token và lấy auth context.

### Điểm còn nên cải thiện

- Chuẩn hóa logging và correlation id.
- Viết rõ contract của auth/introspect cho các service khác.
- Bổ sung test tự động cho các flow quan trọng nhất.
- Chuẩn hóa migration/seed/reset để local setup nhanh hơn.

---

## 3.2. `product-subgraph`

### Vai trò

Đây là domain quản lý catalog sản phẩm trong marketplace.

### Những gì đã làm được

- Tạo, cập nhật, đọc danh sách và chi tiết sản phẩm.
- Quản lý trạng thái nghiệp vụ của sản phẩm:
  - draft,
  - pending review,
  - approved,
  - rejected,
  - archived.
- Áp RBAC theo ngữ cảnh:
  - guest chỉ xem,
  - seller thao tác trên sản phẩm của chính mình,
  - admin có phạm vi rộng hơn.
- Gắn seller verification vào quyền thao tác sản phẩm.
- Hỗ trợ media/upload theo hướng MinIO.
- Có cache layer cho một phần dữ liệu sản phẩm.
- Đã có tài liệu hóa policy thao tác sản phẩm và RBAC của product khá rõ.

### Công cụ/kỹ thuật đang dùng

- NestJS
- GraphQL Subgraph / Apollo Federation
- MongoDB + Mongoose
- Redis
- MinIO/S3-style storage
- JWT verification từ user-service

### Giá trị kỹ thuật

`product-subgraph` thể hiện tốt tư duy:

- domain riêng cho catalog,
- schema GraphQL có ngữ nghĩa nghiệp vụ,
- phân quyền theo vai trò và ownership,
- tách media/cache/auth tương đối rõ.

### Điểm còn nên cải thiện

- Dọn lại cấu trúc guard/decorator nếu thấy còn rối.
- Rà lại index MongoDB, nhất là các field truy vấn thường xuyên.
- Chuẩn hóa log theo operation GraphQL.
- Viết thêm test cho các policy quan trọng.

---

## 3.3. `cart-subgraph`

### Vai trò

Quản lý giỏ hàng theo buyer, phục vụ flow mua sắm trước khi tạo order.

### Những gì đã làm được

- Guest không được thêm vào cart, chỉ buyer đã đăng nhập mới thao tác được.
- Add/update/remove item trong cart.
- Tính subtotal/total theo snapshot phục vụ hiển thị.
- Cho phép chọn một phần item trong cart để tạo order, không ép phải checkout toàn bộ cart.
- Có guide test buyer flow end-to-end từ product sang cart.

### Công cụ/kỹ thuật đang dùng

- NestJS
- GraphQL Subgraph
- Redis-backed persistence
- Tích hợp đọc dữ liệu sản phẩm để dựng snapshot hiển thị

### Giá trị kỹ thuật

`cart-subgraph` hiện đang đúng với vai trò “state ngắn hạn, thay đổi nhanh”:

- phù hợp để học cách dùng Redis cho domain stateful,
- phù hợp để làm bàn đạp cho order creation,
- thể hiện được UX marketplace thực tế hơn nhờ chọn item cụ thể để checkout.

### Điểm còn nên cải thiện

- Chuẩn hóa rule snapshot giá trong cart và mối quan hệ với giá chính thức lúc submit order.
- Bổ sung test contract với order-subgraph cho selected item flow.
- Làm rõ chiến lược clear cart sau submit.

---

## 3.4. `order-subgraph`

### Vai trò

Đây là service quan trọng nhất về mặt học thuật và kiến trúc trong toàn bộ hệ thống hiện tại.

### Những gì đã làm được

- Tạo order trực tiếp từ product (`createOrderDirect`).
- Tạo order từ các item đã chọn trong cart (`createOrderFromCart`).
- Query chi tiết order và danh sách order của buyer.
- Submit order theo lifecycle nhiều bước.
- Cancel order theo rule nghiệp vụ.
- Re-price tại thời điểm submit để tránh dùng giá snapshot cũ một cách sai nghiệp vụ.
- Lưu event store vào PostgreSQL.
- Duy trì read model/projection riêng để query nhanh.
- Dùng outbox để chuẩn bị publish integration event ra ngoài.
- Có callback flow từ inventory/payment quay ngược về order.
- Có tài liệu khá đầy đủ về CQRS, bus, aggregate, event sourcing, runtime flow, lifecycle, outbox.

### Công cụ/kỹ thuật đang dùng

- NestJS
- GraphQL
- PostgreSQL
- Prisma
- `@nestjs/cqrs`
- CQRS pattern
- DDD theo mức học tập có chủ đích
- Event Sourcing
- Outbox pattern
- RabbitMQ

### Giá trị kỹ thuật

`order-subgraph` là phần mạnh nhất của dự án vì nó cho thấy:

- bạn không chỉ làm CRUD,
- bạn hiểu vì sao order là nơi nên áp CQRS và event sourcing,
- bạn đã bắt đầu xử lý các vấn đề thật như:
  - aggregate version,
  - replay event,
  - projection/read model,
  - outbox,
  - eventual consistency,
  - integration callback,
  - idempotency.

Nếu nhìn dưới góc độ portfolio học kiến trúc backend, đây là điểm nhấn lớn nhất.

### Điểm còn nên cải thiện

- Hoàn thiện hơn nữa outbox worker và retry policy.
- Chuẩn hóa message contract với inventory/payment.
- Tăng độ chặt của idempotency cho callback/projector.
- Bổ sung test integration cho flow submit end-to-end.
- Thêm observability thực sự cho event-driven flow.

---

## 3.5. `inventory-service`

### Vai trò

Hiện tại đây là mock service phục vụ học event-driven và flow reserve hàng khi submit order.

### Những gì đã làm được

- Có thể consume event từ RabbitMQ.
- Có callback ngược về order-subgraph để báo reserved hoặc rejected.
- Có thể giữ dữ liệu tồn kho ở mức đơn giản để phục vụ demo.

### Công cụ/kỹ thuật đang dùng

- NestJS
- RabbitMQ consumer
- REST callback về order-subgraph

### Trạng thái hiện tại

Service này đang ở mức “đủ để học flow”, chưa phải mức production-ready.

---

## 3.6. `payment-service`

### Vai trò

Hiện tại đây là mock service để hoàn thiện flow event-driven sau khi order submit.

### Những gì đã làm được

- Consume payment request từ RabbitMQ.
- Callback về order-subgraph để đánh dấu authorized hoặc failed.
- Dùng như bàn đạp để sau này thay thế bằng service thanh toán thực hơn.

### Công cụ/kỹ thuật đang dùng

- NestJS
- RabbitMQ consumer
- REST callback về order-subgraph

### Trạng thái hiện tại

Đây là service mô phỏng, đúng với mục tiêu học event-driven integration. Chưa cần đầu tư sâu nếu trọng tâm hiện tại là vận hành hệ thống và quy trình chuyên nghiệp.

---

## 3.7. Hạ tầng và tích hợp hiện có

### Thành phần đã xuất hiện trong hệ thống

- PostgreSQL
- MongoDB
- Redis
- RabbitMQ
- MinIO
- Apollo Gateway / subgraph composition
- Docker Compose
- Nginx reverse proxy cho demo

### Giá trị học tập

Bạn đã chạm được vào một stack backend đủ rộng để học các khái niệm rất quan trọng:

- service-to-service auth,
- polyglot persistence,
- cache,
- queue/message broker,
- worker nền,
- reverse proxy,
- containerized local environment,
- event-driven callbacks.

---

## 4. Những gì dự án đã đạt được về mặt kỹ thuật

Nếu nhìn từ góc độ trưởng thành của backend, dự án của bạn đã có các điểm mạnh sau:

### 4.1. Có phân ranh domain khá rõ

- user cho identity/access,
- product cho catalog,
- cart cho state ngắn hạn của mua sắm,
- order cho lifecycle giao dịch.

Đây là nền rất tốt để học microservices đúng nghĩa.

### 4.2. Không dừng ở CRUD

Dự án đã vượt khỏi mức CRUD app vì đã có:

- RBAC theo domain,
- seller onboarding,
- product moderation,
- cart checkout selection,
- order lifecycle,
- pricing snapshot và repricing,
- event-driven integration.

### 4.3. Có chiều sâu kiến trúc

Đặc biệt ở order:

- CQRS,
- aggregate,
- event store,
- read model,
- outbox,
- eventual consistency.

Đây là phần rất đáng giữ làm “hạt nhân học sâu”.

### 4.4. Có tư duy tài liệu hóa

Bạn đã có khá nhiều file docs cho từng domain và từng quyết định thiết kế. Đây là một thói quen rất tốt, gần với môi trường làm việc chuyên nghiệp hơn nhiều dự án học tập thông thường.

---

## 5. Những khoảng trống còn tồn tại

Đây là phần quan trọng nhất nếu mục tiêu tiếp theo là học cách vận hành hệ thống và làm việc chuyên nghiệp.

## 5.1. Chưa có quy trình phát triển chuẩn hóa

Hiện tại hệ thống có nhiều kỹ thuật hay, nhưng quy trình làm việc nhóm/professional engineering vẫn chưa được chuẩn hóa rõ ràng:

- commit style chưa thống nhất hoàn toàn,
- chưa có branching strategy cố định,
- chưa có PR checklist,
- chưa có release checklist,
- chưa có chuẩn rollback hoặc hotfix flow.

## 5.2. Chưa có CI/CD đúng nghĩa

Đây là lỗ hổng lớn nhất nếu nhìn theo góc độ vận hành:

- chưa có pipeline lint/typecheck/test/build đầy đủ,
- chưa có tự động migrate/check schema,
- chưa có image build/publish pipeline,
- chưa có deployment flow nhất quán.

## 5.3. Observability còn yếu

Với hệ thống GraphQL + event-driven, nếu không có observability thì debug sẽ rất mệt:

- log chưa thật sự thống nhất,
- chưa có correlation id xuyên service,
- chưa có metrics,
- chưa có tracing,
- health/readiness mới ở mức cơ bản.

## 5.4. Testing strategy chưa hoàn chỉnh

Bạn đã test tay nhiều, nhưng về mặt chuyên nghiệp vẫn nên tách rõ:

- unit test,
- integration test,
- contract test,
- end-to-end smoke test,
- event-driven flow test.

## 5.5. Runtime orchestration vẫn ở mức local/demo

Docker Compose đã tốt cho local/dev/demo, nhưng nếu muốn học sâu về vận hành thật thì cần bước tiếp:

- image strategy,
- env strategy,
- secret/config separation,
- deployment strategy,
- Kubernetes fundamentals.

---

## 6. Đề xuất định hướng tiếp theo

Ở thời điểm này, **không nên mở thêm domain service mới trước**. Lý do là vì:

- backend hiện tại đã đủ phong phú để học sâu,
- nếu tiếp tục thêm service, độ rộng sẽ tăng nhưng độ sâu vận hành sẽ vẫn thiếu,
- bạn đang cần học cách một hệ thống được vận hành chuyên nghiệp hơn là chỉ viết thêm feature.

### Định hướng đúng hơn lúc này

Chuyển mục tiêu từ:

- “xây thêm payment/inventory/notification thật sâu”

sang:

- “làm cho hệ thống hiện tại đáng tin cậy hơn, dễ chạy hơn, dễ review hơn, dễ deploy hơn, dễ debug hơn”.

---

## 7. Lộ trình đề xuất theo phase

## Phase A. Ổn định backend hiện tại

Mục tiêu: làm cho những gì đã có trở nên chắc tay.

### Việc nên làm

- Chuẩn hóa lệnh chạy cho từng service.
- Chuẩn hóa seed/reset local environment.
- Rà lại tài liệu setup/run/test.
- Thêm health check nhất quán cho các service.
- Thêm logging có ngữ nghĩa hơn:
  - request id,
  - actor id,
  - service name,
  - operation name.
- Chốt docs kiến trúc tổng ở mức đủ dùng.

### Kết quả mong muốn

Người khác clone repo về có thể hiểu và chạy được hệ thống mà không phải đoán quá nhiều.

---

## Phase B. Chuẩn hóa quy trình Git và làm việc nhóm

Mục tiêu: học cách làm việc giống môi trường chuyên nghiệp.

### Việc nên làm

- Chọn một branching strategy đơn giản:
  - `main`
  - `develop`
  - `feature/*`
  - `fix/*`
- Chuẩn hóa commit message:
  - `feat:`
  - `fix:`
  - `refactor:`
  - `docs:`
  - `test:`
  - `chore:`
- Viết:
  - PR template,
  - issue template,
  - checklist review code,
  - checklist release local/demo.
- Tạo guideline:
  - commit nhỏ,
  - mỗi commit một ý rõ,
  - không trộn refactor với feature nếu không cần.

### Kết quả mong muốn

Bạn bắt đầu quen với nhịp làm việc chuyên nghiệp chứ không chỉ quen viết code một mình.

---

## Phase C. CI cơ bản trước, CD để sau

Mục tiêu: mỗi lần push code là hệ thống tự kiểm tra chất lượng tối thiểu.

### Việc nên làm

- Dùng GitHub Actions trước vì đơn giản nhất để bắt đầu.
- Pipeline tối thiểu:
  - install dependencies,
  - lint,
  - typecheck,
  - unit test,
  - build các service chính.
- Tách workflow:
  - `backend-ci.yml`
  - `docker-smoke.yml`
- Nếu muốn học Jenkins, hãy làm sau khi đã có pipeline logic rõ bằng GitHub Actions.

### Vì sao chưa nên nhảy ngay vào Jenkins

Nếu chưa rõ pipeline cần chạy gì, dùng Jenkins trước sẽ dễ thành “học công cụ nhưng chưa hiểu quy trình”.

Nên hiểu CI workflow trước, rồi mới chuyển hoặc nhân bản sang Jenkins.

---

## Phase D. Học Jenkins đúng cách

Mục tiêu: hiểu Jenkins như một CI orchestrator, không chỉ là chỗ bấm chạy job.

### Việc nên học

- Jenkins pipeline cơ bản:
  - checkout,
  - install,
  - test,
  - build,
  - artifact/image.
- Jenkinsfile declarative syntax.
- Agent, stage, step.
- Credentials handling.
- Parametrized build.
- Trigger theo branch hoặc PR.

### Cách học hợp lý với repo này

Tạo một Jenkins pipeline chỉ để:

- build `user-service`,
- build `product-subgraph`,
- build `order-subgraph`,
- chạy lint/test/build.

Sau đó mới mở rộng sang Docker image.

---

## Phase E. Học Kubernetes theo hướng thực dụng

Mục tiêu: hiểu cách deploy và vận hành service, không nhất thiết phải production-grade ngay.

### Bắt đầu từ đâu

Đừng đưa toàn bộ hệ thống lên Kubernetes ngay. Hãy bắt đầu từ 1 hoặc 2 service:

- `user-service`
- `order-subgraph`

### Những khái niệm nên nắm

- Pod
- Deployment
- Service
- ConfigMap
- Secret
- Ingress
- Liveness/Readiness Probe
- Horizontal scaling ở mức khái niệm

### Bài tập phù hợp

- Containerize ổn định từng service.
- Viết manifest Kubernetes cho 1 service.
- Expose qua Ingress.
- Tách env/config/secret.

Sau khi làm được với 1 service, mới nghĩ tới cả cụm service.

---

## 8. Thứ tự công việc nên làm tiếp theo

Đây là thứ tự mình đề xuất mạnh nhất cho giai đoạn kế tiếp:

1. Không mở thêm feature business mới trong ngắn hạn.
2. Chốt tài liệu backend hiện trạng và cách chạy/test.
3. Chuẩn hóa Git workflow + commit convention + PR template.
4. Thêm CI cơ bản bằng GitHub Actions.
5. Chuẩn hóa logging + health check + startup checklist.
6. Viết test tự động cho các flow backend quan trọng nhất.
7. Làm Jenkins pipeline tương đương với CI đã có.
8. Sau đó mới bắt đầu học Kubernetes với 1-2 service trước.

---

## 9. Checklist rất cụ thể cho bạn

## 9.1. Nhóm “làm việc chuyên nghiệp hơn”

- [ ] Viết `CONTRIBUTING.md`
- [ ] Viết quy ước commit message
- [ ] Viết PR template
- [ ] Viết checklist review code
- [ ] Quy ước đặt branch `feature/*`, `fix/*`, `docs/*`

## 9.2. Nhóm “ổn định local/dev”

- [ ] Chuẩn hóa script start từng service
- [ ] Chuẩn hóa script seed/reset
- [ ] Viết tài liệu setup ngắn gọn cho backend-only
- [ ] Rà lại toàn bộ `.env.example`
- [ ] Tạo health endpoint nhất quán

## 9.3. Nhóm “chất lượng mã nguồn”

- [ ] Chốt lệnh `lint`, `typecheck`, `test`, `build` cho từng service
- [ ] Thêm test tự động cho user auth flow tối thiểu
- [ ] Thêm test tự động cho product policy tối thiểu
- [ ] Thêm test tự động cho order submit flow tối thiểu
- [ ] Bổ sung contract test cho order <-> payment/inventory callback

## 9.4. Nhóm “observability”

- [ ] Thêm request id vào log
- [ ] Gắn operation name cho GraphQL log
- [ ] Gắn order id/correlation id cho event-driven log
- [ ] Thêm health/readiness rõ ràng
- [ ] Thiết kế tối thiểu dashboard log hoặc log format chuẩn

## 9.5. Nhóm “CI/CD”

- [ ] Tạo GitHub Actions backend CI
- [ ] Tạo workflow build Docker image
- [ ] Tạo workflow smoke test Docker Compose
- [ ] Sau khi ổn mới dựng Jenkins pipeline tương đương

## 9.6. Nhóm “Kubernetes”

- [ ] Chọn 1 service đầu tiên để deploy thử
- [ ] Viết Dockerfile chuẩn production-ish
- [ ] Viết Deployment/Service/Ingress
- [ ] Tách config bằng ConfigMap/Secret
- [ ] Thêm readiness/liveness probe

---

## 10. Kết luận

Ở thời điểm hiện tại, backend của bạn đã có nền tảng rất tốt để chuyển từ “học viết service” sang “học làm hệ thống”.

Điểm mạnh nhất của repo không nằm ở số lượng service, mà nằm ở chỗ:

- đã có domain separation,
- đã có auth/RBAC thật,
- đã có GraphQL federation,
- đã có Redis/Mongo/Postgres/RabbitMQ/MinIO,
- đặc biệt đã có `order-subgraph` với CQRS + DDD + Event Sourcing + Outbox.

Vì vậy, bước đi khôn ngoan tiếp theo không phải là thêm thật nhiều service mới, mà là:

- ổn định những gì đã có,
- chuẩn hóa quy trình phát triển,
- thêm CI/CD,
- tăng khả năng quan sát hệ thống,
- học deploy và vận hành giống môi trường chuyên nghiệp.

Nếu đi theo hướng này, repo của bạn sẽ mạnh hơn rất nhiều cả về chiều sâu kỹ thuật lẫn giá trị portfolio.
