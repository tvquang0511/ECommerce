import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { AuthModule } from '../auth/auth.module';
import { OrderResolver } from './interfaces/graphql/order.resolver';
import { OrderInventoryCallbacksController } from './interfaces/callbacks/order-inventory-callbacks.controller';
import { OrderPaymentCallbacksController } from './interfaces/callbacks/order-payment-callbacks.controller';
import { OrderCommandHandlers } from './application/commands';
import { OrderQueryHandlers } from './application/queries';
import { OrderEventHandlers } from './application/events';
import { CheckoutPricingService } from './application/services/checkout-pricing.service';
import { OrderPolicy } from './domain/policies/order-policy';
import { OrderEventStoreRepo } from './infrastructure/event-store/order-event-store.repo';
import { OrderEventMapper } from './infrastructure/event-store/order-event.mapper';
import { OrderProjectionRepo } from './infrastructure/projections/order-projection.repo';
import { CartReaderService } from './infrastructure/integrations/cart-reader.service';
import { CartWriterService } from './infrastructure/integrations/cart-writer.service';
import { ProductReaderService } from './infrastructure/integrations/product-reader.service';
import { InventoryPublisherService } from './infrastructure/integrations/inventory-publisher.service';
import { OrderRabbitMqPublisherService } from './infrastructure/integrations/order-rabbitmq-publisher.service';
import { PaymentPublisherService } from './infrastructure/integrations/payment-publisher.service';
import { OrderOutboxRepo } from './infrastructure/outbox/order-outbox.repo';
import { OrderOutboxWorker } from './infrastructure/outbox/order-outbox.worker';
import { OrderPrismaService } from './infrastructure/prisma/order-prisma.service';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [OrderInventoryCallbacksController, OrderPaymentCallbacksController],
  providers: [
    OrderResolver,
    CheckoutPricingService,
    OrderPolicy,
    OrderPrismaService,
    OrderEventStoreRepo,
    OrderEventMapper,
    OrderProjectionRepo,
    CartReaderService,
    CartWriterService,
    ProductReaderService,
    OrderRabbitMqPublisherService,
    InventoryPublisherService,
    PaymentPublisherService,
    OrderOutboxRepo,
    OrderOutboxWorker,
    ...OrderCommandHandlers,
    ...OrderQueryHandlers,
    ...OrderEventHandlers,
  ],
})
export class OrderModule {}


