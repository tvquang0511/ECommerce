import { OrderPaymentAuthorizedProjectorHandler } from '../application/events/order-payment-authorized/order-payment-authorized-projector.handler';
import { OrderPaymentFailedProjectorHandler } from '../application/events/order-payment-failed/order-payment-failed-projector.handler';
import { OrderPaymentAuthorizedEvent } from '../domain/events/order-payment-authorized.event';
import { OrderPaymentFailedEvent } from '../domain/events/order-payment-failed.event';
import { OrderProjectionRepo } from '../infrastructure/projections/order-projection.repo';

describe('Payment projector handlers', () => {
  it('projects payment authorized with event sequence', async () => {
    const projectionRepo = {
      markPaymentAuthorized: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderPaymentAuthorizedProjectorHandler(projectionRepo);
    const event = Object.assign(new OrderPaymentAuthorizedEvent('ord_pay_1'), {
      sequence: 6,
    });

    await handler.handle(event);

    expect(projectionRepo.markPaymentAuthorized).toHaveBeenCalledWith(
      'ord_pay_1',
      6,
    );
  });

  it('projects payment failed with event sequence', async () => {
    const projectionRepo = {
      markPaymentFailed: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderPaymentFailedProjectorHandler(projectionRepo);
    const event = Object.assign(
      new OrderPaymentFailedEvent('ord_pay_2', 'card declined'),
      { sequence: 7 },
    );

    await handler.handle(event);

    expect(projectionRepo.markPaymentFailed).toHaveBeenCalledWith(
      'ord_pay_2',
      7,
    );
  });

  it('throws when payment projector event is missing sequence', async () => {
    const projectionRepo = {
      markPaymentAuthorized: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<OrderProjectionRepo>;

    const handler = new OrderPaymentAuthorizedProjectorHandler(projectionRepo);
    const event = new OrderPaymentAuthorizedEvent('ord_pay_3');

    await expect(handler.handle(event)).rejects.toThrow(
      'Projector event OrderPaymentAuthorized is missing a valid sequence.',
    );
    expect(projectionRepo.markPaymentAuthorized).not.toHaveBeenCalled();
  });
});
