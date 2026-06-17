import { Injectable } from '@nestjs/common';

import { Order } from '../../../graphql/order.gql.type';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { GetOrderQuery } from './get-order.query';

@Injectable()
export class GetOrderHandler {
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async execute(query: GetOrderQuery): Promise<Order | null> {
    return this.projectionRepo.findVisibleById(query.orderId, query.actorId);
  }
}
