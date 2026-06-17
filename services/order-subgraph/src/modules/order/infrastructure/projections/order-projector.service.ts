import { Injectable } from '@nestjs/common';

import { OrderCreatedEvent } from '../../domain/events/order-created.event';
import { OrderProjectionRepo } from './order-projection.repo';

@Injectable()
export class OrderProjectorService {
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async project(events: unknown[]): Promise<void> {
    for (const event of events) {
      if (event instanceof OrderCreatedEvent) {
        this.projectionRepo.seedDraft(event.orderId, event.buyerId, event.currency);
      }
    }
  }
}
