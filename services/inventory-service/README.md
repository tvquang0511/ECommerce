# inventory-service

Inventory service cơ bản phục vụ:

- tra cứu trạng thái còn hàng cho product/UI
- kiểm tra khả năng reserve cho nhiều item
- reserve/release hàng theo `orderId`
- xem trạng thái reservation theo order

Phase hiện tại dùng in-memory store để demo luồng event-driven với `order-subgraph`.

## Endpoints hiện có

- `GET /health`
- `GET /api/inventory/stock`
- `GET /api/inventory/stock/:productId`
- `POST /api/inventory/stock/check`
- `POST /api/inventory/stock/upsert`
- `POST /api/inventory/reserve`
- `GET /api/inventory/reservations/:orderId`
- `POST /api/inventory/release`
