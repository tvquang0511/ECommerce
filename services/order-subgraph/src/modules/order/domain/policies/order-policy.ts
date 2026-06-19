import { Injectable } from '@nestjs/common';

import { OrderStatusEnum } from '../enums/order-status.enum';

@Injectable()
export class OrderPolicy {
  canSubmit(status: OrderStatusEnum): boolean {
    return status === OrderStatusEnum.DRAFT;
  }

  canCancel(status: OrderStatusEnum): boolean {
    return ![OrderStatusEnum.CONFIRMED, OrderStatusEnum.CANCELLED].includes(status);
  }
}
