import { Injectable } from '@nestjs/common';

@Injectable()
export class PaymentPublisherService {
  async publishPaymentRequested(orderId: string): Promise<void> {
    void orderId;
  }
}
