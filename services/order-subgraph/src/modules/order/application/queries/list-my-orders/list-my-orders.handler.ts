import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';

import { Order } from '../../../graphql/order.gql.type';
import { OrderProjectionRepo } from '../../../infrastructure/projections/order-projection.repo';
import { ListMyOrdersQuery } from './list-my-orders.query';

@QueryHandler(ListMyOrdersQuery)
export class ListMyOrdersHandler
  implements IQueryHandler<ListMyOrdersQuery, Order[]>
{
  constructor(private readonly projectionRepo: OrderProjectionRepo) {}

  async execute(query: ListMyOrdersQuery): Promise<Order[]> {
    return this.projectionRepo.listByBuyerId(query.buyerId);
  }
}


