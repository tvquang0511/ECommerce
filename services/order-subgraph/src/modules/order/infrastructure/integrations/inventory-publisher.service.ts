import { Injectable } from '@nestjs/common';

@Injectable()
export class InventoryPublisherService {
  async publishReservationRequested(orderId: string): Promise<void> {
    void orderId;
  }
}
