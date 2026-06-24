import { OrderDomainEvent } from '../../domain/events/order-domain-event';

export function getEventSequenceOrThrow(event: OrderDomainEvent): number {
  if (typeof event.sequence !== 'number' || !Number.isInteger(event.sequence) || event.sequence < 0) {
    throw new Error(`Projector event ${event.type} is missing a valid sequence.`);
  }

  return event.sequence;
}
