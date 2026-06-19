import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Order } from '../../../graphql/order.gql.type';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { GetOrderQuery } from './get-order.query';

@QueryHandler(GetOrderQuery)
export class GetOrderHandler
  implements IQueryHandler<GetOrderQuery, Order | null>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async execute(query: GetOrderQuery): Promise<Order | null> {
    return this.projectionRepo.findVisibleById(query.orderId, query.actorId);
  }
}
