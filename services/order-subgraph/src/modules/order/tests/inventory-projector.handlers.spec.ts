import { OrderInventoryRejectedProjectorHandler } from '../application/events/order-inventory-rejected/order-inventory-rejected-projector.handler';
import { OrderInventoryReservedProjectorHandler } from '../application/events/order-inventory-reserved/order-inventory-reserved-projector.handler';
import { OrderInventoryRejectedEvent } from '../domain/events/order-inventory-rejected.event';
import { OrderInventoryReservedEvent } from '../domain/events/order-inventory-reserved.event';
import { OrderProjectionRepo } from '../infrastructure/projections/order-projection.repo';

describe('Inventory projector handlers', () => {
  it('projects inventory reserved with event sequence', async () => {
    const projectionRepo = {
      markInventoryReserved: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderInventoryReservedProjectorHandler(projectionRepo);
    const event = Object.assign(new OrderInventoryReservedEvent('ord_proj_1'), {
      sequence: 4,
    });

    await handler.handle(event);

    expect(projectionRepo.markInventoryReserved).toHaveBeenCalledWith(
      'ord_proj_1',
      4,
    );
  });

  it('projects inventory rejected with event sequence', async () => {
    const projectionRepo = {
      markInventoryRejected: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderInventoryRejectedProjectorHandler(projectionRepo);
    const event = Object.assign(
      new OrderInventoryRejectedEvent('ord_proj_2', 'out of stock'),
      { sequence: 5 },
    );

    await handler.handle(event);

    expect(projectionRepo.markInventoryRejected).toHaveBeenCalledWith(
      'ord_proj_2',
      5,
    );
  });

  it('throws when projector event does not have a valid sequence', async () => {
    const projectionRepo = {
      markInventoryReserved: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderInventoryReservedProjectorHandler(projectionRepo);
    const event = new OrderInventoryReservedEvent('ord_proj_3');

    await expect(handler.handle(event)).rejects.toThrow(
      'Projector event OrderInventoryReserved is missing a valid sequence.',
    );
    expect(projectionRepo.markInventoryReserved).not.toHaveBeenCalled();
  });
});
