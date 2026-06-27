# order-subgraph Docs

Thư mục này chứa các tài liệu thiết kế và runtime flow của `order-subgraph`, là service được dùng để học sâu về `CQRS + DDD + Event Sourcing + Outbox`.

## Nên đọc theo thứ tự

1. [../README.md](../README.md)
2. [ORDER_CQRS_DDD_EVENT_SOURCING_DESIGN.md](ORDER_CQRS_DDD_EVENT_SOURCING_DESIGN.md)
3. [CQRS_BUS_AND_EVENT_DESIGN.md](CQRS_BUS_AND_EVENT_DESIGN.md)
4. [ORDER_CREATION_DESIGN.md](ORDER_CREATION_DESIGN.md)
5. [ORDER_COMMUNICATION_BOUNDARIES.md](ORDER_COMMUNICATION_BOUNDARIES.md)
6. [ORDER_LIFECYCLE_AND_OUTBOX_RULES.md](ORDER_LIFECYCLE_AND_OUTBOX_RULES.md)
7. [ORDER_OUTBOX_DESIGN.md](ORDER_OUTBOX_DESIGN.md)
8. [ORDER_RUNTIME_FLOWS.md](ORDER_RUNTIME_FLOWS.md)
9. [ORDER_DEMO_E2E_GUIDE.md](ORDER_DEMO_E2E_GUIDE.md)

## Mô tả từng tài liệu

- `ORDER_CQRS_DDD_EVENT_SOURCING_DESIGN.md`: thiết kế nền cho order theo hướng kiến trúc học thuật.
- `CQRS_BUS_AND_EVENT_DESIGN.md`: giải thích vai trò của command bus, query bus, event bus và mediator mindset.
- `ORDER_CREATION_DESIGN.md`: rule tạo order từ product hoặc cart, snapshot và pricing.
- `ORDER_COMMUNICATION_BOUNDARIES.md`: chốt boundary giữa direct call và event-driven, cũng như lý do chọn `order` làm checkout entrypoint.
- `ORDER_LIFECYCLE_AND_OUTBOX_RULES.md`: lifecycle nghiệp vụ, rule submit/cancel/fail/confirm, draft expiry.
- `ORDER_OUTBOX_DESIGN.md`: thiết kế outbox, message contract, worker, retry và callback flow.
- `ORDER_RUNTIME_FLOWS.md`: mô tả flow chạy thực tế của command, projection, outbox và replay.
- `ORDER_DEMO_E2E_GUIDE.md`: cách test end-to-end phục vụ demo.

## Quy ước cho docs của order

- Tài liệu ở đây nên ưu tiên giải thích rõ trade-off và runtime flow.
- Nếu đổi message contract, callback flow hoặc schema event store, phải cập nhật docs liên quan trong cùng task.
