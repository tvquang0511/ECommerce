# BLOCKCHAIN_PLAN.md

## 1. Mục tiêu học Blockchain trong 2 tháng hè

Mục tiêu chính của kế hoạch này không phải là học blockchain theo hướng trading, coin, NFT hay Web3 marketing. Mục tiêu là học blockchain như một phần của **distributed systems**, từ đó bổ trợ cho định hướng Backend Engineer, Microservices, Event Sourcing, CQRS và System Design.

Sau 2 tháng, cần đạt được các kết quả sau:

- Hiểu blockchain ở mức nền tảng kỹ thuật: hash, block, chain, Merkle Tree, consensus, distributed ledger.
- Phân biệt được blockchain với database, event sourcing và message broker.
- Tự xây được một blockchain/hash-chain đơn giản bằng TypeScript hoặc Node.js.
- Tích hợp được ý tưởng blockchain vào ecommerce project thông qua **Payment Audit Ledger**.
- Hiểu được vai trò của blockchain trong môi trường nhiều bên không hoàn toàn tin tưởng nhau.
- Có một mini-project đủ tốt để đưa vào GitHub/CV.

---

## 2. Nguyên tắc học

### Nên tập trung

- Cryptographic Hashing
- Block Structure
- Hash-chain
- Merkle Tree
- Consensus
- Distributed Trust
- Immutable Ledger
- Event Sourcing vs Blockchain
- Payment Audit Ledger
- Smart Contract cơ bản

### Không nên tập trung trong giai đoạn này

- Trading bot
- Meme coin
- Token launch
- NFT marketplace
- DeFi phức tạp
- Blockchain marketing
- Đào coin thật

Lý do: mục tiêu chính hiện tại là trở thành Backend Engineer mạnh hơn, không phải chuyển hướng hoàn toàn sang Web3 Engineer.

---

## 3. Tổng quan lộ trình 8 tuần

| Tuần | Chủ đề chính | Kết quả cần đạt |
|---|---|---|
| Tuần 1 | Blockchain fundamentals | Hiểu hash, block, chain, Merkle Tree |
| Tuần 2 | Consensus & distributed trust | Hiểu vì sao blockchain cần consensus |
| Tuần 3 | Blockchain vs Event Sourcing | So sánh được blockchain với event store |
| Tuần 4 | Mini blockchain implementation | Code được blockchain/hash-chain cơ bản |
| Tuần 5 | Payment Audit Ledger | Thiết kế audit ledger cho payment service |
| Tuần 6 | Integration with Microservices | Tích hợp RabbitMQ + Payment Audit Service |
| Tuần 7 | Multi-party ledger simulation | Giả lập nhiều bên cùng giữ ledger |
| Tuần 8 | Smart Contract intro + final docs | Làm escrow contract đơn giản + viết README |

---

# Tuần 1: Blockchain Fundamentals

## Mục tiêu

Hiểu blockchain là gì ở mức kỹ thuật, không chỉ ở mức khái niệm chung chung.

## Kiến thức cần học

### 1. Hash Function

Cần hiểu:

- Hash là gì.
- SHA-256 hoạt động ở mức sử dụng như thế nào.
- Vì sao chỉ cần thay đổi một ký tự thì hash thay đổi hoàn toàn.
- Hash giúp phát hiện dữ liệu bị sửa như thế nào.

Ví dụ:

```ts
sha256("payment-100000")
sha256("payment-100001")
```

Hai input gần giống nhau nhưng output hash sẽ khác hoàn toàn.

### 2. Block

Một block cơ bản gồm:

```ts
type Block = {
  index: number;
  timestamp: string;
  data: unknown;
  previousHash: string;
  hash: string;
};
```

Ý nghĩa:

- `data`: dữ liệu cần ghi nhận.
- `previousHash`: hash của block trước đó.
- `hash`: hash của block hiện tại.

### 3. Chain

Blockchain là một chuỗi block:

```text
Block 1 -> Block 2 -> Block 3 -> Block 4
```

Mỗi block phụ thuộc vào hash của block trước đó. Nếu sửa một block cũ, toàn bộ chain phía sau sẽ bị sai.

### 4. Merkle Tree

Cần hiểu ở mức cơ bản:

- Merkle Tree gom nhiều transaction thành một Merkle Root.
- Chỉ cần Merkle Root là có thể kiểm tra transaction có thuộc block hay không.
- Merkle Tree xuất hiện nhiều trong blockchain, Git, distributed databases.

## Deliverable cuối tuần

Viết một file note:

```text
notes/week-01-blockchain-fundamentals.md
```

Nội dung cần có:

- Blockchain là gì?
- Hash là gì?
- Block gồm những gì?
- Vì sao blockchain khó sửa lịch sử?
- Merkle Tree dùng để làm gì?

---

# Tuần 2: Consensus & Distributed Trust

## Mục tiêu

Hiểu phần quan trọng nhất của blockchain: nhiều node làm sao cùng đồng ý về một lịch sử giao dịch.

## Kiến thức cần học

### 1. Blockchain không chỉ là hash-chain

Hash-chain chỉ giúp phát hiện dữ liệu bị sửa. Nhưng blockchain thật còn cần giải quyết câu hỏi:

```text
Nếu nhiều node cùng ghi dữ liệu, ai là người quyết định block nào là đúng?
```

Đó là vấn đề consensus.

### 2. Proof of Work

Cần hiểu:

- Miner làm gì.
- Nonce là gì.
- Difficulty là gì.
- Vì sao mining tốn tài nguyên.
- Vì sao Proof of Work giúp chống spam và chống sửa lịch sử.

### 3. Proof of Stake

Cần hiểu:

- Validator là gì.
- Stake là gì.
- Vì sao Proof of Stake tiết kiệm năng lượng hơn Proof of Work.

### 4. Byzantine Fault Tolerance

Cần hiểu ở mức ý tưởng:

- Có những node có thể lỗi hoặc gian lận.
- Hệ thống vẫn cần đạt được đồng thuận.
- Đây là vấn đề rất quan trọng trong distributed systems.

## Deliverable cuối tuần

Viết note:

```text
notes/week-02-consensus.md
```

Nội dung cần có:

- Consensus là gì?
- Vì sao blockchain cần consensus?
- Proof of Work khác Proof of Stake như thế nào?
- Blockchain khác database ở điểm nào?

---

# Tuần 3: Blockchain vs Event Sourcing

## Mục tiêu

Liên hệ blockchain với kiến thức hiện tại trong ecommerce project: Event Sourcing, CQRS, Event Store và Outbox Pattern.

## Nội dung cần phân tích

### Event Sourcing

Trong Order Service:

```text
OrderCreated
OrderSubmitted
OrderPaid
OrderCancelled
```

Các event được append vào Event Store. Không sửa event cũ, chỉ thêm event mới.

### Blockchain

Trong blockchain:

```text
Block 1 -> Block 2 -> Block 3
```

Block cũng được append vào chain. Nếu sửa block cũ thì hash bị sai.

### So sánh

| Tiêu chí | Event Sourcing | Blockchain |
|---|---|---|
| Append-only | Có | Có |
| Replay lịch sử | Có | Có |
| Immutable history | Có, nếu thiết kế đúng | Có |
| Distributed trust | Không bắt buộc | Là trọng tâm |
| Consensus | Không bắt buộc | Cần có |
| Phù hợp cho internal system | Rất phù hợp | Thường bị over-engineering |
| Phù hợp cho nhiều bên không tin nhau | Không mạnh | Rất phù hợp |

## Kết luận cần hiểu

Blockchain không phải là bản thay thế trực tiếp cho Event Sourcing. Event Sourcing phù hợp cho hệ thống nội bộ do một tổ chức kiểm soát. Blockchain phù hợp hơn khi có nhiều bên cùng tham gia và không bên nào có quyền sửa lịch sử một cách đơn phương.

## Deliverable cuối tuần

Viết note:

```text
notes/week-03-blockchain-vs-event-sourcing.md
```

Nội dung cần có:

- Event Store giống blockchain ở điểm nào?
- Event Store khác blockchain ở điểm nào?
- Vì sao Payment Service không nên xử lý payment chính bằng blockchain?
- Vì sao Payment Audit Ledger lại là ý tưởng hợp lý?

---

# Tuần 4: Mini Blockchain Implementation

## Mục tiêu

Tự code một blockchain/hash-chain đơn giản bằng TypeScript hoặc Node.js.

## Chức năng cần làm

### 1. Block Model

```ts
type Block = {
  index: number;
  timestamp: string;
  data: unknown;
  previousHash: string;
  hash: string;
  nonce?: number;
};
```

### 2. Blockchain Class

Cần có các method:

```ts
class Blockchain {
  createGenesisBlock(): Block;
  getLatestBlock(): Block;
  addBlock(data: unknown): Block;
  calculateHash(block: Omit<Block, 'hash'>): string;
  isValidChain(): boolean;
}
```

### 3. Tamper Simulation

Tạo script sửa dữ liệu block cũ:

```ts
chain[2].data.amount = 999999;
```

Sau đó chạy:

```ts
blockchain.isValidChain();
```

Kết quả phải trả về `false`.

### 4. Optional: Proof of Work đơn giản

Thêm mining rule:

```text
hash phải bắt đầu bằng "0000"
```

Ví dụ:

```ts
while (!hash.startsWith('0000')) {
  nonce++;
  hash = calculateHash(...);
}
```

## Deliverable cuối tuần

Tạo repo hoặc folder:

```text
blockchain-lab/
```

Cấu trúc gợi ý:

```text
blockchain-lab/
  src/
    block.ts
    blockchain.ts
    main.ts
  notes/
    week-01-blockchain-fundamentals.md
    week-02-consensus.md
    week-03-blockchain-vs-event-sourcing.md
  README.md
```

---

# Tuần 5: Payment Audit Ledger Design

## Mục tiêu

Thiết kế audit ledger cho Payment Service trong ecommerce project.

## Ý tưởng chính

Payment Service vẫn xử lý payment theo kiến trúc microservices bình thường:

```text
Order Service -> RabbitMQ -> Payment Service -> Database
```

Blockchain/hash-chain chỉ đóng vai trò audit:

```text
Payment Service -> RabbitMQ -> Payment Audit Service -> Ledger DB
```

## Payment Events

Các event nên hỗ trợ:

```text
PaymentAuthorized
PaymentCaptured
PaymentFailed
PaymentRefundRequested
PaymentRefunded
```

## Ledger Block

```ts
type PaymentLedgerBlock = {
  id: string;
  blockNumber: number;
  paymentId: string;
  orderId: string;
  eventType: string;
  amount: number;
  currency: string;
  actor: string;
  eventPayload: Record<string, unknown>;
  previousHash: string;
  hash: string;
  createdAt: Date;
};
```

## API Design

```text
GET /audit/blocks
GET /audit/blocks/:blockNumber
GET /audit/payments/:paymentId
GET /audit/orders/:orderId
GET /audit/verify-chain
```

## Deliverable cuối tuần

Tạo tài liệu:

```text
docs/payment-audit-ledger-design.md
```

Nội dung cần có:

- Vì sao cần Payment Audit Ledger?
- Flow event từ Payment Service sang Audit Service.
- Data model của ledger block.
- API cần có.
- Verify chain hoạt động như thế nào?

---

# Tuần 6: Integrate Payment Audit Service with Microservices

## Mục tiêu

Triển khai service thật trong ecommerce project.

## Service mới

Tạo service:

```text
payment-audit-service
```

Gợi ý stack:

- NestJS
- PostgreSQL
- Prisma hoặc TypeORM
- RabbitMQ consumer
- REST API

## Flow

```text
Order Service
  -> OrderSubmitted
  -> RabbitMQ
  -> Payment Service
  -> PaymentAuthorized / PaymentFailed / PaymentRefunded
  -> RabbitMQ
  -> Payment Audit Service
  -> Append Ledger Block
```

## Chức năng cần làm

### 1. Consume Payment Events

Payment Audit Service subscribe các event:

```text
payment.authorized
payment.captured
payment.failed
payment.refund_requested
payment.refunded
```

### 2. Append Block

Mỗi event tạo một ledger block mới.

### 3. Verify Chain

Endpoint:

```text
GET /audit/verify-chain
```

Response hợp lệ:

```json
{
  "valid": true,
  "totalBlocks": 25,
  "brokenAtBlock": null
}
```

Response khi bị sửa:

```json
{
  "valid": false,
  "totalBlocks": 25,
  "brokenAtBlock": 12,
  "reason": "Hash mismatch"
}
```

### 4. Query Payment Audit Trail

Endpoint:

```text
GET /audit/payments/:paymentId
```

Response trả về toàn bộ lịch sử của một payment:

```text
PaymentAuthorized -> PaymentCaptured -> PaymentRefundRequested -> PaymentRefunded
```

## Deliverable cuối tuần

- Service chạy được bằng Docker Compose.
- Nhận được event từ RabbitMQ.
- Ghi được ledger block.
- Verify chain được.
- Query audit trail theo paymentId được.

---

# Tuần 7: Multi-party Ledger Simulation

## Mục tiêu

Mô phỏng điểm quan trọng của blockchain: nhiều bên cùng giữ ledger và cùng xác minh lịch sử.

## Các node giả lập

```text
Buyer Ledger Node
Seller Ledger Node
Payment Provider Ledger Node
```

Có thể triển khai đơn giản bằng 3 database/schema khác nhau hoặc 3 instance service khác nhau.

## Flow

```text
Payment Event
  -> Buyer Ledger Node
  -> Seller Ledger Node
  -> Payment Provider Ledger Node
```

Mỗi node lưu cùng một block.

## Chức năng cần làm

### 1. Replicate Block

Khi có payment event, ghi block vào cả 3 ledger.

### 2. Compare Ledger

Endpoint:

```text
GET /audit/compare-ledgers
```

Response ví dụ:

```json
{
  "consistent": false,
  "nodes": [
    {
      "node": "buyer",
      "valid": true,
      "latestHash": "abc123"
    },
    {
      "node": "seller",
      "valid": false,
      "latestHash": "fake999",
      "brokenAtBlock": 8
    },
    {
      "node": "payment_provider",
      "valid": true,
      "latestHash": "abc123"
    }
  ]
}
```

### 3. Tamper Demo

Tạo script cố tình sửa dữ liệu ở Seller Ledger Node:

```text
amount: 250000 -> 2500000
```

Sau đó gọi compare endpoint để phát hiện node bị sai.

## Deliverable cuối tuần

- Multi-node ledger simulation chạy được.
- Có endpoint compare-ledgers.
- Có demo phát hiện node bị chỉnh sửa dữ liệu.
- Có diagram giải thích vì sao blockchain phù hợp với môi trường nhiều bên.

---

# Tuần 8: Smart Contract Intro + Final Documentation

## Mục tiêu

Làm quen với smart contract ở mức cơ bản và tổng kết project thành tài liệu đẹp trên GitHub.

## Phần 1: Solidity cơ bản

Học các khái niệm:

- Contract
- State variable
- Function
- Modifier
- Event
- Address
- Payable
- Require

## Phần 2: Hardhat cơ bản

Cần biết:

- Compile contract
- Run local blockchain
- Deploy contract
- Write simple test

## Phần 3: Escrow Contract

Làm contract đơn giản:

```text
Buyer gửi tiền vào contract
Seller giao hàng
Buyer xác nhận
Contract release tiền cho Seller
```

Chức năng tối thiểu:

```solidity
fundEscrow()
confirmDelivery()
releasePayment()
refundBuyer()
```

Không cần làm frontend. Chỉ cần test bằng Hardhat là đủ.

## Final Documentation

Viết README chính cho project:

```text
payment-audit-ledger/README.md
```

README nên có:

- Problem Statement
- Why Blockchain?
- Why not use blockchain as the main payment system?
- Architecture Diagram
- Event Flow
- Ledger Block Structure
- Chain Verification
- Multi-party Ledger Simulation
- Demo Scenarios
- Lessons Learned

## Deliverable cuối tuần

- Smart contract escrow demo.
- README hoàn chỉnh.
- Architecture diagram.
- Demo script.
- CV bullet.

---

# 4. Project cuối cùng nên có gì?

Tên project gợi ý:

```text
Payment Audit Ledger
```

Hoặc:

```text
Tamper-Evident Payment Ledger
```

## Thành phần kỹ thuật

- Node.js / TypeScript
- NestJS
- RabbitMQ
- PostgreSQL
- Docker Compose
- Hash-chain ledger
- Chain verification
- Multi-party ledger simulation
- Optional: Solidity + Hardhat escrow demo

## Kiến trúc tổng thể

```text
Order Service
  -> RabbitMQ
  -> Payment Service
  -> RabbitMQ
  -> Payment Audit Service
  -> Ledger DB
  -> Verify Chain API
```

Bản nâng cấp:

```text
Payment Event
  -> Buyer Ledger Node
  -> Seller Ledger Node
  -> Payment Provider Ledger Node
  -> Compare Ledgers API
```

---

# 5. Cách chia thời gian mỗi tuần

Nếu blockchain chỉ là side quest, mỗi tuần nên dành khoảng 5 đến 8 giờ.

Gợi ý:

| Hoạt động | Thời lượng |
|---|---:|
| Đọc/học lý thuyết | 2 giờ |
| Code lab/project | 3 đến 4 giờ |
| Viết note/README | 1 giờ |
| Review/refactor | 1 giờ |

Không nên dành toàn bộ mùa hè cho blockchain nếu mục tiêu chính vẫn là backend engineering.

---

# 6. Checklist hoàn thành

## Kiến thức

- [ ] Hiểu hash function.
- [ ] Hiểu block và previousHash.
- [ ] Hiểu Merkle Tree cơ bản.
- [ ] Hiểu Proof of Work.
- [ ] Hiểu Proof of Stake ở mức khái niệm.
- [ ] Hiểu consensus là gì.
- [ ] Hiểu distributed trust là gì.
- [ ] Phân biệt được blockchain và database.
- [ ] Phân biệt được blockchain và event sourcing.

## Code

- [ ] Code mini blockchain bằng TypeScript.
- [ ] Có function calculateHash.
- [ ] Có function addBlock.
- [ ] Có function verifyChain.
- [ ] Có tamper simulation.
- [ ] Có payment-audit-service.
- [ ] Có RabbitMQ consumer.
- [ ] Có ledger table.
- [ ] Có API query audit trail.
- [ ] Có API verify chain.
- [ ] Có multi-party ledger simulation.
- [ ] Có compare-ledgers endpoint.
- [ ] Có Solidity escrow demo cơ bản.

## Tài liệu

- [ ] README giải thích project.
- [ ] Architecture diagram.
- [ ] Event flow diagram.
- [ ] Blockchain vs Event Sourcing note.
- [ ] Payment Audit Ledger design note.
- [ ] Demo scenarios.
- [ ] CV bullet.

---

# 7. CV Bullet gợi ý

```text
Built a tamper-evident payment audit ledger using hash-chain design, integrated with RabbitMQ events in a microservices-based ecommerce system, supporting chain verification, payment audit trail queries, and multi-party ledger consistency simulation.
```

Bản tiếng Việt:

```text
Xây dựng Payment Audit Ledger theo mô hình hash-chain nhằm ghi nhận lịch sử thanh toán không thể chỉnh sửa âm thầm, tích hợp với RabbitMQ trong kiến trúc microservices, hỗ trợ kiểm chứng chuỗi giao dịch và mô phỏng nhiều bên cùng xác minh ledger.
```

---

# 8. Kết luận

Blockchain nên được học như một phần của distributed systems, không nên học theo hướng chạy theo coin hoặc trend Web3.

Với ecommerce project hiện tại, hướng tốt nhất là không thay thế Payment Service bằng blockchain, mà xây thêm một lớp:

```text
Payment Audit Ledger
```

Lớp này giúp học được bản chất quan trọng của blockchain:

- Immutable history
- Tamper detection
- Distributed ledger
- Multi-party verification
- Trust between parties

Đây là hướng vừa thực tế, vừa hợp với nền tảng backend hiện tại, vừa có giá trị để trình bày trong CV và phỏng vấn.
