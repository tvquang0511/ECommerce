import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentCallbackService {
  constructor(private readonly configService: ConfigService) {}

  async sendAuthorized(input: {
    orderId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<void> {
    await this.post('/internal/order-callbacks/payment/authorized', input);
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<void> {
    const baseUrl =
      this.configService.get<string>('payment.orderSubgraphBaseUrl') ??
      'http://localhost:4004';

    const response = await fetch(`${baseUrl.replace(/\/+$/g, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Payment callback request failed with status ${response.status}.`);
    }
  }
}
