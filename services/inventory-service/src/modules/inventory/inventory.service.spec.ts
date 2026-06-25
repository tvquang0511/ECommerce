import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(() => {
    service = new InventoryService();
  });

  it('reserves stock successfully and keeps reservation idempotent by orderId', () => {
    const reserved = service.reserve({
      orderId: 'ord-1',
      buyerId: 'buyer-1',
      items: [{ productId: 'p1003', sellerId: 'seller-1', quantity: 1 }],
    });

    expect(reserved.status).toBe('RESERVED');
    expect(service.getStock('p1003').available).toBe(2);

    const replay = service.reserve({
      orderId: 'ord-1',
      buyerId: 'buyer-1',
      items: [{ productId: 'p1003', sellerId: 'seller-1', quantity: 1 }],
    });

    expect(replay.idempotentReplay).toBe(true);
    expect(service.getStock('p1003').available).toBe(2);
  });

  it('rejects reservation when stock is insufficient', () => {
    const result = service.reserve({
      orderId: 'ord-2',
      items: [{ productId: 'p1004', sellerId: 'seller-1', quantity: 1 }],
    });

    expect(result.status).toBe('REJECTED');
    expect(result.reason).toContain('Insufficient stock');
  });

  it('releases previously reserved stock', () => {
    service.reserve({
      orderId: 'ord-3',
      items: [{ productId: 'p1002', sellerId: 'seller-1', quantity: 2 }],
    });

    const released = service.release({ orderId: 'ord-3' });

    expect(released.status).toBe('RELEASED');
    expect(service.getStock('p1002').available).toBe(4);
  });

  it('checks availability for multiple items', () => {
    const result = service.checkAvailability({
      items: [
        { productId: 'p1001', quantity: 2 },
        { productId: 'p1004', quantity: 1 },
      ],
    });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.canReserve).toBe(true);
    expect(result.items[1]?.canReserve).toBe(false);
  });
});
