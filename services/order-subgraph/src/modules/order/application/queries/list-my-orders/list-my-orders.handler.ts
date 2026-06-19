import { Injectable } from '@nestjs/common';

import { Order } from '../../../graphql/order.gql.type';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { ListMyOrdersQuery } from './list-my-orders.query';

@Injectable()
export class ListMyOrdersHandler {
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async execute(query: ListMyOrdersQuery): Promise<Order[]> {
    return this.projectionRepo.listByBuyerId(query.buyerId);
  }
}
