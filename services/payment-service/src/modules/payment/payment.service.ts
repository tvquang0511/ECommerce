import { Injectable } from '@nestjs/common';

interface PaymentAuthorizationRequest {
  orderId: string;
  buyerId?: string;
  expectedVersion?: number;
  orderVersion?: number;
  correlationId?: string;
  totalAmount: number;
  currency: string;
}

@Injectable()
export class PaymentService {
  authorize(input: PaymentAuthorizationRequest) {
    const expectedVersion =
      typeof input.expectedVersion === 'number'
        ? input.expectedVersion
        : typeof input.orderVersion === 'number'
          ? input.orderVersion
          : 1;

    return {
      orderId: input.orderId,
      status: 'AUTHORIZED' as const,
      expectedVersion,
      correlationId:
        input.correlationId ?? `payment-${input.orderId}-${expectedVersion}`,
      amount: input.totalAmount,
      currency: input.currency,
    };
  }
}
