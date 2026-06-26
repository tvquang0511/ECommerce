import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InventoryOrderCallbackService {
  constructor(private readonly configService: ConfigService) {}

  async sendReserved(input: {
    orderId: string;
    expectedVersion: number;
    correlationId: string;
  }): Promise<void> {
    await this.post('/internal/order-callbacks/inventory/reserved', input);
  }

  async sendRejected(input: {
    orderId: string;
    expectedVersion: number;
    correlationId: string;
    reason?: string | null;
  }): Promise<void> {
    await this.post('/internal/order-callbacks/inventory/rejected', input);
  }

  private async post(path: string, payload: Record<string, unknown>): Promise<void> {
    const baseUrl =
      this.configService.get<string>('inventory.orderSubgraphBaseUrl') ??
      'http://localhost:4004';

    const response = await fetch(`${baseUrl.replace(/\/+$/g, '')}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Order callback request failed with status ${response.status}.`,
      );
    }
  }
}
