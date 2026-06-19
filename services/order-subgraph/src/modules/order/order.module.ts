import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

import { OrderResolver } from './graphql/order.resolver';
import { OrderCommandHandlers } from './application/commands';
import { OrderQueryHandlers } from './application/queries';
import { OrderEventHandlers } from './application/events';
import { CheckoutPricingService } from './application/services/checkout-pricing.service';
import { OrderPolicy } from './domain/policies/order-policy';
import { OrderEventStoreRepo } from './infrastructure/event-store/order-event-store.repo';
import { OrderEventMapper } from './infrastructure/event-store/order-event.mapper';
import { OrderProjectionRepo } from './infrastructure/projections/order-projection.repo';
import { CartReaderService } from './infrastructure/integrations/cart-reader.service';
import { ProductReaderService } from './infrastructure/integrations/product-reader.service';
import { InventoryPublisherService } from './infrastructure/integrations/inventory-publisher.service';
import { PaymentPublisherService } from './infrastructure/integrations/payment-publisher.service';
import { OrderOutboxRepo } from './infrastructure/outbox/order-outbox.repo';
import { OrderOutboxWorker } from './infrastructure/outbox/order-outbox.worker';

@Module({
  imports: [CqrsModule],
  providers: [
    OrderResolver,
    CheckoutPricingService,
    OrderPolicy,
    OrderEventStoreRepo,
    OrderEventMapper,
    OrderProjectionRepo,
    CartReaderService,
    ProductReaderService,
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
