import { Injectable } from '@nestjs/common';

import { OrderSubmittedOutboxPayload } from '../outbox/order-outbox-message.type';

@Injectable()
export class PaymentPublisherService {
  async publishPaymentRequested(
    payload: OrderSubmittedOutboxPayload,
  ): Promise<void> {
    void payload;
  }
}
