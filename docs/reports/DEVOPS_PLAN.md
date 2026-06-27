# PLAN.md - Summer Backend Engineering Roadmap

## 1. Mục tiêu 2 tháng

Trong 2 tháng hè, mục tiêu chính là nâng cấp dự án E-Commerce từ một project học backend thành một project có quy trình gần giống môi trường công ty.

Không tập trung xây thêm business feature mới.

Tập trung vào:

* Testing
* CI/CD
* Docker
* Deployment
* Logging
* Monitoring
* Observability
* Kubernetes căn bản

---

## 2. Nguyên tắc làm việc

Trong 2 tháng này:

* Không phát triển sâu `inventory-service`.
* Không phát triển sâu `payment-service`.
* Không thêm domain mới như coupon, shipping, wishlist.
* Không học thêm backend framework mới.
* Không nhảy sớm vào Kubernetes production.
* Mọi thay đổi nên đi qua Issue → Branch → Pull Request → Merge.

---

# Month 1 - Làm cho repo đáng tin cậy

## Week 1 - Chuẩn hóa repo và Git workflow

### Mục tiêu

Làm cho repo nhìn và vận hành giống repo trong công ty.

### Việc cần làm

* [ ] Tạo `CONTRIBUTING.md`
* [ ] Tạo Pull Request template
* [ ] Tạo Issue template
* [ ] Tạo `ARCHITECTURE.md`
* [ ] Chuẩn hóa branch naming:

  * `feature/*`
  * `fix/*`
  * `docs/*`
  * `refactor/*`
* [ ] Áp dụng Conventional Commits:

  * `feat:`
  * `fix:`
  * `docs:`
  * `test:`
  * `refactor:`
  * `chore:`

### Kết quả cuối tuần

Repo có quy trình làm việc rõ ràng, không còn commit tùy tiện trực tiếp lên `main`.

---

## Week 2 - Testing cho các flow quan trọng

### Mục tiêu

Có test bảo vệ những phần quan trọng nhất của backend.

### Ưu tiên test

#### Order Service

* [ ] Create order
* [ ] Submit order
* [ ] Cancel order
* [ ] Replay event
* [ ] Update projection
* [ ] Outbox event được tạo đúng

#### User Service

* [ ] Register
* [ ] Login
* [ ] Refresh token
* [ ] Seller application

#### Product Service

* [ ] Seller tạo product
* [ ] Admin approve product
* [ ] Admin reject product
* [ ] Buyer không được chỉnh product của seller

### Kết quả cuối tuần

Có ít nhất 20 test case có ý nghĩa.

Không chạy theo coverage, chỉ tập trung vào business rule quan trọng.

---

## Week 3 - GitHub Actions CI

### Mục tiêu

Mỗi Pull Request phải được kiểm tra tự động.

### Workflow cần tạo

Tạo file:

```text
.github/workflows/backend-ci.yml
```

Pipeline gồm:

```text
Install dependencies
↓
Lint
↓
Typecheck
↓
Test
↓
Build
```

### Việc cần làm

* [ ] CI cho `user-service`
* [ ] CI cho `product-subgraph`
* [ ] CI cho `cart-subgraph`
* [ ] CI cho `order-subgraph`
* [ ] Chặn merge nếu CI fail

### Kết quả cuối tuần

Khi mở PR, GitHub tự chạy kiểm tra.

Nếu code lỗi build, lỗi type, lỗi test thì không được merge.

---

## Week 4 - Docker và deploy VPS

### Mục tiêu

Deploy được hệ thống ra môi trường thật.

### Việc cần làm

* [ ] Chuẩn hóa Dockerfile cho từng service
* [ ] Tạo `.dockerignore`
* [ ] Chuẩn hóa `docker-compose.yml`
* [ ] Tạo `.env.example`
* [ ] Setup VPS Ubuntu
* [ ] Cài Docker, Docker Compose
* [ ] Cấu hình Nginx reverse proxy
* [ ] Cấu hình HTTPS bằng Let's Encrypt

### Kết quả cuối tháng 1

Hệ thống có thể chạy trên VPS.

Có URL thật để demo backend.

---

# Month 2 - Làm cho hệ thống dễ vận hành

## Week 5 - Logging chuẩn

### Mục tiêu

Debug được hệ thống dễ hơn.

### Việc cần làm

* [ ] Thêm structured logging
* [ ] Mỗi log có `serviceName`
* [ ] Mỗi request có `requestId`
* [ ] Mỗi flow order có `correlationId`
* [ ] Log rõ các event quan trọng:

  * `OrderCreated`
  * `OrderSubmitted`
  * `InventoryReserved`
  * `PaymentAuthorized`
  * `OrderCancelled`

### Log mẫu

```json
{
  "service": "order-subgraph",
  "requestId": "req_123",
  "correlationId": "order_456",
  "event": "OrderSubmitted",
  "orderId": "order_456",
  "userId": "user_789"
}
```

### Kết quả cuối tuần

Có thể lần theo một order từ lúc submit đến lúc inventory/payment phản hồi.

---

## Week 6 - Monitoring với Prometheus và Grafana

### Mục tiêu

Biết hệ thống đang khỏe hay lỗi.

### Việc cần làm

* [ ] Thêm metrics endpoint cho service chính
* [ ] Setup Prometheus
* [ ] Setup Grafana
* [ ] Theo dõi:

  * Request count
  * Error rate
  * Response time
  * CPU/RAM
  * RabbitMQ queue size
  * Order submitted count
  * Payment failed count

### Dashboard tối thiểu

* API Health Dashboard
* Order Flow Dashboard
* RabbitMQ Dashboard

### Kết quả cuối tuần

Có dashboard Grafana chụp màn hình được để đưa vào portfolio.

---

## Week 7 - Distributed Tracing

### Mục tiêu

Nhìn được một request đi qua nhiều service.

### Việc cần làm

* [ ] Setup OpenTelemetry
* [ ] Setup Jaeger
* [ ] Trace flow:

  * Gateway
  * Order Service
  * RabbitMQ
  * Inventory Mock
  * Payment Mock

### Flow cần trace

```text
Submit Order
→ Order Service
→ Publish Event
→ RabbitMQ
→ Inventory Service
→ Callback Order
→ Payment Service
→ Callback Order
```

### Kết quả cuối tuần

Có ít nhất một trace hoàn chỉnh trong Jaeger.

---

## Week 8 - Kubernetes căn bản

### Mục tiêu

Hiểu Kubernetes ở mức intern/fresher cần biết.

Không cần production-grade.

### Chỉ deploy thử

* `user-service`
* `order-subgraph`

### Cần học

* Pod
* Deployment
* Service
* ConfigMap
* Secret
* Ingress
* Liveness Probe
* Readiness Probe

### Việc cần làm

* [ ] Cài Minikube hoặc Kind
* [ ] Viết manifest cho `user-service`
* [ ] Viết manifest cho `order-subgraph`
* [ ] Tách config bằng ConfigMap
* [ ] Tách secret bằng Secret
* [ ] Thêm readiness/liveness probe

### Kết quả cuối tuần

Deploy được 1–2 service lên Kubernetes local.

Hiểu Kubernetes dùng để giải quyết vấn đề gì.

---

# 3. Kết quả cuối cùng sau 2 tháng

Sau 2 tháng, repo cần có:

* [ ] Quy trình Git rõ ràng
* [ ] Pull Request template
* [ ] Issue template
* [ ] Test cho các flow quan trọng
* [ ] GitHub Actions CI
* [ ] Dockerfile chuẩn cho service chính
* [ ] Deploy được lên VPS
* [ ] Logging có requestId/correlationId
* [ ] Grafana dashboard
* [ ] Jaeger trace
* [ ] Kubernetes demo local

---

# 4. Thứ tự ưu tiên nếu không đủ thời gian

Nếu không làm kịp hết, ưu tiên theo thứ tự này:

1. Testing
2. GitHub Actions CI
3. Docker + VPS Deploy
4. Logging + Correlation ID
5. Prometheus + Grafana
6. OpenTelemetry + Jaeger
7. Kubernetes

Kubernetes là phần cuối cùng, không được làm trước CI/CD.

---

# 5. Cách ghi vào CV sau khi hoàn thành

Có thể ghi:

* Built an E-Commerce microservices backend with GraphQL Federation, DDD, CQRS, Event Sourcing, RabbitMQ, PostgreSQL, MongoDB, Redis and MinIO.
* Implemented CI pipeline using GitHub Actions for linting, type checking, testing and building backend services.
* Containerized services with Docker and deployed the system to a VPS using Docker Compose and Nginx.
* Added structured logging, correlation IDs, Prometheus metrics, Grafana dashboards and distributed tracing with OpenTelemetry/Jaeger.
* Practiced professional software workflow with Issues, Pull Requests, Conventional Commits and code review checklist.

---

# 6. Định hướng chính

Mục tiêu của roadmap này không phải là làm dự án to hơn.

Mục tiêu là làm dự án trưởng thành hơn.

Một backend project tốt không chỉ có nhiều service, mà còn phải:

* chạy được ổn định,
* test được,
* build được,
* deploy được,
* debug được,
* quan sát được,
* và người khác có thể hiểu, review, chạy lại được.

Đó là hướng phát triển chính trong 2 tháng hè này.
