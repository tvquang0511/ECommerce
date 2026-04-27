# E-commerce Microservices — Roadmap học tập + System Design (Nginx + Apollo Federation)

> Mục tiêu: bắt đầu từ nền tảng bạn đã quen (Node.js/Postgres/Docker/REST), rồi mở rộng dần sang Next.js/NestJS/MongoDB/GraphQL/RabbitMQ/CI-CD (Jenkins)/Kubernetes.
>
> Nguyên tắc: đi theo **mốc có demo được** (deliverables), tăng độ phức tạp theo từng phase để tránh “ngợp microservices”.

---

## 0) Phạm vi đề xuất (MVP để học)

### MVP user journey (demo được)
- Đăng ký/đăng nhập
- Xem danh sách sản phẩm + xem chi tiết sản phẩm
- Thêm vào giỏ hàng, cập nhật số lượng
- Checkout → tạo order
- Reserve inventory + thanh toán giả lập
- Nhận email xác nhận (qua notification service)

### Non-goals (để không loãng)
- Chưa làm promotion engine phức tạp, đa kho, hoàn/đổi trả, search engine, recommendation.

---

## 1) Nguyên tắc kiến trúc (để polyglot không “vỡ”) 

- **Database-per-service**: mỗi service sở hữu DB của nó; service khác không query DB trực tiếp.
- **API rõ ràng**: REST dùng OpenAPI, GraphQL dùng schema (SDL) + conventions.
- **Edge layer**: Nginx làm gateway routing; frontend chủ yếu gọi **GraphQL Gateway (Apollo Federation)** để giảm round trips và chuẩn hoá dữ liệu.
- **Giao tiếp liên service**:
  - **Sync** (HTTP) cho các lệnh cần phản hồi ngay (checkout gọi reserve/authorize).
  - **Async events** (RabbitMQ) để đồng bộ data/side effects (email, analytics, cache rebuild).
- **Eventual consistency** là bình thường trong microservices (không làm distributed transaction).
- **Idempotency** cho các endpoint quan trọng (checkout, payment webhook, reserve/release).
- **Outbox pattern** cho các event quan trọng (đảm bảo “commit DB” và “publish event” không lệch).

---

## 2) Danh sách service (chức năng + stack)

> Quyết định cho đồ án học tập:
> - Tái sử dụng auth từ TeamHub: `user-service` (Node/Express + Postgres + REST).
> - Access token dùng để gọi các service khác (propagate qua Gateway → subgraphs/services).
> - Refresh token: gọi REST `/api/users/refresh` về `user-service` khi cần.
> - Dùng **Apollo Federation**: 1 GraphQL Gateway + nhiều GraphQL subgraphs (product/cart/order).

### 2.1 `graphql-gateway` (Apollo Federation Gateway)
- **Stack**: Node.js + TypeScript + Express + Apollo Gateway (`@apollo/gateway`) + Apollo Server
- **API**: GraphQL (public entrypoint cho UI)
- **Sở hữu dữ liệu**: không sở hữu DB (stateless)
- **Chức năng**:
  - Compose supergraph từ các subgraphs (product/cart/order…)
  - Propagate `Authorization` + correlation id sang subgraphs
  - Bảo vệ schema công khai: rate limit/burst control (nếu muốn), query complexity (phase sau)
- **Gợi ý vận hành**:
  - Dev: `IntrospectAndCompose` để gateway tự đọc SDL từ các subgraph endpoints
  - CI/CD: dùng `rover supergraph compose` để tạo `supergraph.graphql` cố định (học thêm)

### 2.2 `user-service` (Auth/Users)
- **Stack**: Node.js (Express) + TypeScript + Postgres + Prisma
- **API**: REST
- **Sở hữu dữ liệu**: users, sessions/refresh tokens, roles
- **Chức năng**:
  - Register/Login/Refresh/Logout
  - Profile + địa chỉ giao hàng (tối thiểu 1 address)
  - RBAC cơ bản: `ADMIN`, `CUSTOMER`
- **Events**:
  - Publish: `user.registered.v1`, `user.email_verified.v1` (optional)

### 2.3 `product-service` (Catalog — Federation Subgraph)
- **Stack**: NestJS + GraphQL (Federation Subgraph) + MongoDB + Redis (cache) + MinIO (blob/S3)
- **API**: GraphQL
- **Sở hữu dữ liệu**: products, categories, attributes, product images metadata (object keys) + blobs (MinIO)
- **Chức năng**:
  - Product listing/filter/sort đơn giản
  - Product detail
  - Product images: upload/serve qua MinIO (khuyến nghị: presigned URL; metadata lưu Mongo)
  - Cache đọc nhanh cho listing/detail qua Redis (TTL + invalidate theo event `product.updated.v1` ở phase sau)
  - Admin CRUD products (phase sau)
- **Events**:
  - Publish: `product.created.v1`, `product.updated.v1`, `product.price_changed.v1`

### 2.4 `cart-service` (Shopping cart — Federation Subgraph)
- **Stack**: NestJS + GraphQL (Federation Subgraph) + Redis (hot store)
- **API**: GraphQL
- **Sở hữu dữ liệu**: carts (ephemeral), cart items
- **Chức năng**:
  - Cart theo user (và/hoặc anonymous session)
  - Add/update/remove items
  - Merge cart khi login (optional)

> Ghi chú: Redis ở đây là “primary store” cho cart (không chỉ cache). Nếu bạn dùng chung 1 Redis instance cho cả cart + catalog cache thì nên tách namespace/key-prefix (vd: `cart:*`, `cache:product:*`) hoặc tách logical DB.
- **Events**:
  - Publish: `cart.checked_out.v1` (khi bắt đầu checkout)

### 2.5 `order-service` (Orders + Checkout orchestration — Federation Subgraph)
- **Stack**: NestJS + GraphQL (Federation Subgraph) + Postgres
- **API**: GraphQL
- **Sở hữu dữ liệu**: orders, order_items (snapshot), order_state
- **Chức năng**:
  - Tạo order từ cart (snapshot: name/price tại thời điểm mua)
  - State machine: `PENDING` → `CONFIRMED` → `CANCELLED`…
  - Điều phối checkout (orchestrator/Saga): reserve inventory + authorize payment
- **Events**:
  - Publish: `order.created.v1`, `order.confirmed.v1`, `order.cancelled.v1`
  - Consume: `inventory.reserved.v1`, `inventory.reserve_failed.v1`, `payment.authorized.v1`, `payment.failed.v1`

### 2.6 `inventory-service` (Stock + Reservation)
- **Stack**: NestJS + REST + Postgres
- **API**: REST
- **Sở hữu dữ liệu**: stock, reservations
- **Chức năng**:
  - Reserve theo `orderId` (idempotent)
  - Release reservation khi order fail/cancel
  - (Phase sau) sync stock theo nhiều nguồn
- **Events**:
  - Publish: `inventory.reserved.v1`, `inventory.reserve_failed.v1`, `inventory.released.v1`
  - Consume: `order.cancelled.v1` (để release)

### 2.7 `payment-service` (Payments)
- **Stack**: NestJS + REST + Postgres
- **API**: REST
- **Sở hữu dữ liệu**: payment intents/transactions, webhook logs
- **Chức năng**:
  - Authorize/Capture (giả lập hoặc tích hợp Stripe/MoMo sau)
  - Webhook handler (idempotent)
- **Events**:
  - Publish: `payment.authorized.v1`, `payment.failed.v1`, `payment.captured.v1`

### 2.8 `notification-service` (Email)
- **Stack**: Worker (Node/Nest) + SMTP
- **API**: không cần public API (internal)
- **Chức năng**:
  - Email xác nhận order
  - Email password reset (nếu muốn học thêm)
- **Events**:
  - Consume: `user.registered.v1`, `order.confirmed.v1`, `payment.failed.v1`

---

## 3) Auth & token strategy (reuse TeamHub)

Bạn có thể “bê” gần như nguyên phần auth của TeamHub sang `user-service`, cụ thể các module sau:
- `backend/src/modules/auth`
- `backend/src/modules/users`
- `backend/src/common/middlewares/authJwt.ts`

### 3.1 Token strategy (khuyến nghị cho học tập)
- **Access token** (JWT):
  - Client lưu **trong memory** (đơn giản và an toàn hơn LocalStorage).
  - Gửi lên gateway/subgraphs bằng header `Authorization: Bearer <accessToken>`.
  - TTL gợi ý: 10–15 phút.
  - Claims tối thiểu: `sub` (userId), `roles`, `iat`, `exp`, `iss`, `aud`.
- **Refresh token**:
  - Lưu bằng **HttpOnly cookie**.
  - Khi access token hết hạn, frontend gọi REST `POST /api/users/refresh` → `user-service` để lấy access token mới.
  - Nên dùng **refresh rotation** (mỗi lần refresh cấp refresh token mới và revoke cái cũ).

### 3.2 Services verify JWT như thế nào?
- **Phase đầu (dễ nhất)**: HS256 + shared secret (mọi service có chung `JWT_ACCESS_SECRET`).
- **Phase sau (đúng thực tế hơn)**: RS256 + JWKS
  - `user-service` sign access tokens bằng private key.
  - Expose JWKS endpoint (ví dụ `GET /api/users/.well-known/jwks.json`).
  - Subgraphs/services verify bằng public keys (cho phép rotate keys).

### 3.3 Propagate auth trong Apollo Gateway
- Gateway chỉ **forward header** sang subgraphs (không tự tin vào gateway để authz).
- Mỗi subgraph tự enforce authorization (guards/policies).
- Với call nội bộ (order → inventory/payment):
  - Tối thiểu: forward `Authorization` + `x-request-id`.
  - Nâng cao: dùng **service token** riêng cho service-to-service.

---

## 4) Nginx Gateway (bước đầu)

### 4.1 Routing đề xuất
- `/` → Next.js frontend
- `/api/users/*` → user-service (REST)
- `/graphql` → graphql-gateway (Apollo Federation)

> Gợi ý: về lâu dài, **frontend chỉ gọi GraphQL Gateway**; riêng auth có thể giữ REST trong user-service cho đơn giản (cookie/refresh flow).

> Các domain services khác nên để **internal only** (gateway gọi qua network), không cần expose public qua Nginx.

Tuỳ giai đoạn học tập, bạn có thể tạm expose để debug:
- `/internal/graphql/products` → product-service (GraphQL)
- `/internal/graphql/carts` → cart-service (GraphQL)
- `/internal/graphql/orders` → order-service (GraphQL)
- `/api/inventory/*` → inventory-service (REST)
- `/api/payments/*` → payment-service (REST)

### 4.2 Snippet Nginx (gợi ý)
> Chỉ minh hoạ ý tưởng route; bạn sẽ chỉnh upstream/ports theo compose/k8s.

> Dev tip: nếu Nginx chạy trong Docker nhưng services chạy trên host (pnpm), dùng `host.docker.internal:<port>` (Windows/macOS). Nếu services cũng chạy trong Compose thì dùng service name (vd: `graphql-gateway:4000`).

```nginx
server {
  listen 80;

  location / {
    proxy_pass http://frontend:3000;
  }

  location /api/users/ {
    proxy_pass http://user-service:4001/;
  }

  location /graphql {
    proxy_pass http://graphql-gateway:4000/graphql;
  }

  # (Optional) debug internal GraphQL services
  location /internal/graphql/products {
    proxy_pass http://product-service:4002/graphql;
  }

  location /internal/graphql/carts {
    proxy_pass http://cart-service:14103/graphql;
  }

  location /internal/graphql/orders {
    proxy_pass http://order-service:14104/graphql;
  }

  location /api/inventory/ {
    proxy_pass http://inventory-service:14105/;
  }

  location /api/payments/ {
    proxy_pass http://payment-service:14106/;
  }
}
```


## 5) RabbitMQ (event design để học “đúng chất” microservices)

### 5.1 Naming / routing keys (ví dụ)
- `user.registered.v1`
- `product.updated.v1`
- `cart.checked_out.v1`
- `order.created.v1`
- `inventory.reserved.v1`
- `payment.authorized.v1`

### 5.2 Message envelope (khuyến nghị)
```json
{
  "id": "uuid",
  "type": "order.created.v1",
  "occurredAt": "2026-04-05T12:34:56.000Z",
  "source": "order-service",
  "traceId": "...",
  "data": {
    "orderId": "...",
    "userId": "...",
    "total": 12345,
    "currency": "VND"
  }
}
```

### 5.3 Outbox pattern (tối thiểu nên có ở `order-service`)
- `order-service` khi tạo order:
  - Transaction: insert `orders` + insert `outbox_events`
  - Background publisher đọc outbox và publish lên RabbitMQ
- Lợi ích: giảm rủi ro “DB commit xong nhưng publish fail”.

---

## 6) Component diagram (PlantUML)

Xem sơ đồ component (đã bổ sung Redis cache + MinIO) tại: [docs/diagrams/component-diagram.md](docs/diagrams/component-diagram.md).

---

## 7) Cấu trúc thư mục repo (monorepo) — gợi ý để init GitHub

> Mục tiêu: 1 repo, dev nhanh bằng Docker Compose; CI/CD tách theo từng service; chia sẻ code qua `packages/*`.

Gợi ý layout:

```text
.
├─ apps/
│  └─ web/                      # Next.js storefront (SSR/SEO)
├─ services/
│  ├─ graphql-gateway/           # Apollo Federation Gateway (public /graphql)
│  ├─ user-service/              # Express REST auth/users (+ Postgres)
│  ├─ product-subgraph/          # NestJS GraphQL Federation subgraph (+ MongoDB)
│  ├─ cart-subgraph/             # NestJS GraphQL Federation subgraph (+ Redis)
│  ├─ order-subgraph/            # NestJS GraphQL Federation subgraph (+ Postgres + outbox)
│  ├─ inventory-service/         # NestJS REST (+ Postgres)
│  ├─ payment-service/           # NestJS REST (+ Postgres)
│  └─ notification-worker/       # worker/consumer (RabbitMQ) + SMTP
├─ packages/
│  ├─ common/                    # shared types, error codes, zod schemas
│  ├─ auth/                      # jwt verify helper, role types (optional)
│  ├─ config/                    # env loader, logging, constants
│  ├─ eslint-config/             # shared lint rules
│  └─ tsconfig/                  # base tsconfig presets
├─ infra/
│  ├─ docker/
│  │  ├─ docker-compose.dev.yml
│  │  ├─ docker-compose.edge.yml
│  │  ├─ docker-compose.tool.yml
│  │  └─ docker-compose.yml
│  ├─ nginx/                     # nginx.conf (+ conf.d)
│  ├─ jenkins/                   # Jenkinsfile(s) / shared pipeline snippets
│  └─ k8s/                       # Helm charts/manifests (phase Kubernetes)
├─ docs/
│  ├─ architecture/
│  └─ diagrams/
├─ scripts/                      # seed/dev scripts
├─ Makefile                      # dev shortcuts (up/down, logs, lint)
├─ package.json                  # workspaces + scripts
└─ pnpm-workspace.yaml           # (hoặc dùng npm workspaces)
```

Quy ước tối thiểu cho mỗi service:
- `src/` + `package.json` + `tsconfig.json`
- `Dockerfile`
- `.env.example`
- `README.md` ngắn (cách chạy riêng service)

### 7.1) pnpm quickstart (cho người mới)

> Repo này định hướng monorepo, nên `pnpm` rất hợp vì chạy workspace nhanh và quản lý dependency gọn.

- Cài pnpm (khuyến nghị dùng Corepack đi kèm Node):
  - Bật Corepack: `corepack enable`
  - Kích hoạt pnpm (khớp `package.json`): `corepack prepare pnpm@9.0.0 --activate`
- Các lệnh cơ bản:
  - Cài deps: `pnpm install`
  - Chạy script: `pnpm run <script>` (vd: `pnpm run dev`)
  - Thêm package: `pnpm add <pkg>` (dev dep: `pnpm add -D <pkg>`)
  - Xoá package: `pnpm remove <pkg>`
- Workspaces (điểm khác biệt hay dùng):
  - Chạy tất cả packages: `pnpm -r <script>`
  - Chạy 1 package: `pnpm --filter <name-or-path> <script>`
  - Chạy ở root (workspace): `pnpm -w <cmd>`

Tài liệu pnpm chi tiết: [docs/pnpm.md](docs/pnpm.md).

### 7.2) Khi chạy `docker-compose.dev` có cần Nginx chưa?

- Chưa bắt buộc ở giai đoạn skeleton: bạn có thể chạy app bằng pnpm trên host (Next.js/gateway/services) và chỉ dùng Compose cho hạ tầng (Postgres/Mongo/Redis/RabbitMQ/MinIO).
- Nên cấu hình Nginx sớm nếu bạn muốn **1 origin** để đỡ CORS và dễ xử lý refresh token cookie (đặc biệt khi auth dùng cookie HttpOnly).
- Chạy hạ tầng dev:
  - `pnpm deps:up` (hoặc `make dev-up`)
- Nếu muốn bật Nginx (optional):
  - `make edge-up`
  - Truy cập qua `http://localhost:8080`
- Nếu muốn bật tool xem DB (optional):
  - `make tool-up` (hoặc `pnpm tools:up`)
  - Mongo Express: `http://localhost:8081`
  - Redis Commander: `http://localhost:8082`
  - Redis Insight: `http://localhost:5540`

Tài liệu kiến trúc:
- Overview: [docs/architecture/overview.md](docs/architecture/overview.md)
- Chức năng từng service: [docs/architecture/services.md](docs/architecture/services.md)
- Template cây thư mục (NestJS-first): [docs/architecture/folder-structure.md](docs/architecture/folder-structure.md)
- Lộ trình học Apollo + NestJS (tách biệt product plan): [docs/architecture/apollo-nestjs-learning-roadmap.md](docs/architecture/apollo-nestjs-learning-roadmap.md)

---

## 8) Lộ trình học tập chi tiết (milestone-based)

> Mốc thời gian chỉ là gợi ý (12 tuần). Bạn có thể kéo giãn/thu ngắn tùy quỹ thời gian.

### Milestone 0 (Tuần 1) — Repo skeleton + Compose + Nginx + Federation “hello world”
**Bạn học/practice**: monorepo workspaces, Docker Compose, Nginx reverse proxy, Apollo Gateway + 1 subgraph.

#### Day 1 checklist (khuyến nghị)
1) Cài toolchain
  - Node.js LTS (>= 18)
  - Corepack + pnpm: `corepack enable` rồi `corepack prepare pnpm@9.0.0 --activate`
2) Cài dependencies workspace
  - `pnpm install`
3) Chạy 2 service GraphQL tối thiểu (hello federation)
  - Terminal A: `pnpm --filter product-subgraph dev` (port `4002`)
    - hoặc: `make product` / `pnpm run product`
  - Terminal B: `pnpm --filter graphql-gateway dev` (port `4000`)
    - hoặc: `make gateway` / `pnpm run gateway`
  - Một lệnh (chạy cả 2): `make federation` hoặc `pnpm run federation`
4) Test nhanh gateway
  - Mở `http://localhost:4000/graphql` (Apollo landing page)
  - Query thử:
    - `{ ping }`
    - `query { product(id: "1") { id name } }`
5) (Tuỳ chọn) chạy hạ tầng bằng Docker Compose (DB/broker/blob)
  - `make dev-up` (Postgres/Mongo/Redis/RabbitMQ/MinIO)

> Troubleshooting (Postgres Docker): nếu `infra-postgres-1` bị `Exited (1)` và log có kiểu
> `The data directory was initialized by PostgreSQL version 15, which is not compatible with this version 16.x`
> thì bạn đang dùng **volume cũ**. Cách nhanh nhất (dev-only, sẽ mất data): `make clean-volumes` rồi `make dev-up`.
6) (Tuỳ chọn) bật Nginx single-origin (để đỡ CORS/cookie về sau)
  - `make edge-up`
    - Gọi `http://localhost:8080/graphql` thay vì `http://localhost:4000/graphql`

- Build:
  - Tạo `graphql-gateway` + `product-subgraph` (chỉ cần query `ping`).
  - Gateway compose từ subgraph bằng `IntrospectAndCompose`.
  - Nginx route `/graphql` → gateway.
- Deliverables:
  - `infra/docker/docker-compose.dev.yml`: Postgres + Mongo + Redis + RabbitMQ + MinIO (hạ tầng dev).
  - `infra/docker/docker-compose.edge.yml`: (optional) Nginx single-origin.
  - Next.js page gọi query `{ ping }`.
- Done criteria:
  - `POST /graphql` qua Nginx trả `ping` OK.

### Milestone 1 (Tuần 2–3) — Port `user-service` từ TeamHub + access/refresh chuẩn
**Bạn học/practice**: JWT access/refresh, refresh rotation, cookie security, OpenAPI.
- Build:
  - Port module từ TeamHub: `backend/src/modules/auth`, `backend/src/modules/users`.
  - Implement endpoints: `POST /register`, `POST /login`, `POST /refresh`, `POST /logout`, `GET /me`.
  - Access token trả về JSON; refresh token set HttpOnly cookie.
  - Gateway/subgraphs forward `Authorization` và subgraph có auth guard tối thiểu.
- Done criteria:
  - Login → gọi GraphQL query/mutation có auth guard OK.
  - Token hết hạn → gọi refresh → retry GraphQL OK.

### Milestone 2 (Tuần 4–5) — `product-subgraph` (Mongo) + pagination/sort/filter
**Bạn học/practice**: NestJS Federation subgraph, Mongo modeling, GraphQL pagination.
- Build:
  - Schema tối thiểu: `Product @key(fields: "id")`.
  - Queries: `products(cursor, limit, filter, sort)` + `product(id)`.
  - Seed dữ liệu demo.
  - Next.js: listing + detail gọi **gateway**.
- Done criteria:
  - Listing có cursor pagination; detail nhanh; schema stable.

### Milestone 3 (Tuần 6) — `cart-subgraph` (Redis) + Federation entity reference (CartItem → Product)
**Bạn học/practice**: Redis, GraphQL mutations, Federation entity references.
- Build:
  - Mutations: `addToCart(productId, qty)`, `updateCartItem`, `removeCartItem`, `clearCart`.
  - Query: `cart` theo `userId` đọc từ JWT.
  - `CartItem.product: Product!` trả về **reference** `{ __typename: "Product", id }` để gateway resolve qua `product-subgraph`.
  - Next.js: cart page (gọi gateway).
- Done criteria:
  - Load cart trả được product info mà không cần cart gọi trực tiếp product.

### Milestone 4 (Tuần 7–8) — `order-subgraph` (Postgres) + checkout orchestration
**Bạn học/practice**: transactional modeling, snapshot, idempotency keys, Saga basics.
- Build:
  - Mutation: `checkout(idempotencyKey)` lấy cart, snapshot items, tạo order `PENDING`.
  - `order-subgraph` gọi `inventory-service` reserve + gọi `payment-service` authorize (sync trước).
  - Query: `orders`, `order(id)`.
- Done criteria:
  - Checkout thành công tạo order `CONFIRMED`.
  - Retry cùng `idempotencyKey` không tạo order trùng.

### Milestone 5 (Tuần 9) — `inventory-service` + `payment-service` (REST) + notification
**Bạn học/practice**: payment intent giả lập, webhook idempotency, side effects.
- Deliverables:
  - `inventory-service`: reserve/release idempotent
  - `payment-service`: authorize/capture mock + webhook logs
  - `notification-service` gửi email order confirmed
- Done criteria:
  - Demo “checkout → payment ok → email xác nhận”

### Milestone 6 (Tuần 10) — RabbitMQ events + Outbox + Saga tối thiểu
**Bạn học/practice**: event-driven, eventual consistency, outbox, retries.
- Deliverables:
  - `order.created` publish qua outbox
  - `inventory.reserved`/`payment.authorized` events cập nhật state order
- Done criteria:
  - Tắt 1 service tạm thời rồi bật lại: hệ thống vẫn “hồi phục” và xử lý tiếp

### Milestone 6.5 (Advanced) — Federation hardening (Rover + schema checks)
**Bạn học/practice**: schema composition, breaking changes, contract checks.
- Deliverables:
  - Compose `supergraph.graphql` bằng `rover supergraph compose`
  - Jenkins step: fail build nếu schema compose lỗi
- Done criteria:
  - Thay đổi schema ở 1 subgraph không phá vỡ compose ngoài ý muốn

### Milestone 7 (Tuần 11) — CI/CD với Jenkins
**Bạn học/practice**: Jenkinsfile, build images, push registry, deploy automation.
- Deliverables:
  - Jenkins pipeline cho mỗi service: lint/test/build Docker image
  - Tagging strategy: `service-name:git-sha`
- Done criteria:
  - Push image thành công, deploy dev environment tự động

### Milestone 8 (Tuần 12) — Kubernetes (dev cluster)
**Bạn học/practice**: Deployments, Services, Ingress, ConfigMap/Secret, HPA basics.
- Deliverables:
  - Helm chart (hoặc manifests) cho toàn hệ thống
  - Ingress thay thế Nginx compose
- Done criteria:
  - Truy cập app qua Ingress, scale 1 service lên 2 replicas

---

## 9) Gợi ý “quy ước” để bạn đỡ mệt khi nhiều service

- Chuẩn hoá:
  - `GET /health`, `GET /metrics` (phase sau)
  - Correlation id: `x-request-id`
  - Error format thống nhất (code/message/details)
- Versioning:
  - REST: `/v1/...`
  - Events: suffix `.v1`
- Security:
  - Public API chỉ qua Nginx; services nội bộ chỉ expose trong network

---

## 10) Câu hỏi mở (để chốt trước khi code)

1) JWT verify v1 bạn muốn chọn HS256 (shared secret) hay làm luôn RS256 + JWKS?
2) Bạn có muốn đưa `user-service` vào Federation như 1 subgraph (giữ REST refresh/login song song) để học entity `User @key(fields: "id")` không?
