import { registerAs } from '@nestjs/config';

export const inventoryConfig = registerAs('inventory', () => ({
  port: Number(process.env.PORT ?? 4010),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as
    | 'development'
    | 'production'
    | 'test',
  orderSubgraphBaseUrl:
    process.env.ORDER_SUBGRAPH_BASE_URL ?? 'http://localhost:4004',
  rabbitmqUrl: process.env.RABBITMQ_URL ?? 'amqp://rabbit:rabbit@localhost:5672',
  rabbitmqExchange: process.env.RABBITMQ_EXCHANGE ?? 'order.integration',
  reservationQueue:
    process.env.INVENTORY_RESERVATION_QUEUE ?? 'inventory.reservation.requested.q',
}));
