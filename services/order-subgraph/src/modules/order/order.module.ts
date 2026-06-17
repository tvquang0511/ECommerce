import { Module } from '@nestjs/common';

import { OrderResolver } from './graphql/order.resolver';
import { CreateOrderFromCartHandler } from './application/commands/create-order-from-cart/create-order-from-cart.handler';
import { SubmitOrderHandler } from './application/commands/submit-order/submit-order.handler';
import { CancelOrderHandler } from './application/commands/cancel-order/cancel-order.handler';
import { GetOrderHandler } from './application/queries/get-order/get-order.handler';
import { ListMyOrdersHandler } from './application/queries/list-my-orders/list-my-orders.handler';
import { CheckoutPricingService } from './application/services/checkout-pricing.service';
import { OrderPolicy } from './domain/policies/order-policy';
import { OrderEventStoreRepo } from './infrastructure/event-store/order-event-store.repo';
import { OrderEventMapper } from './infrastructure/event-store/order-event.mapper';
import { OrderProjectionRepo } from './infrastructure/projections/order-projection.repo';
import { OrderProjectorService } from './infrastructure/projections/order-projector.service';
import { CartReaderService } from './infrastructure/integrations/cart-reader.service';
import { ProductReaderService } from './infrastructure/integrations/product-reader.service';
import { InventoryPublisherService } from './infrastructure/integrations/inventory-publisher.service';
import { PaymentPublisherService } from './infrastructure/integrations/payment-publisher.service';
import { OrderOutboxRepo } from './infrastructure/outbox/order-outbox.repo';
import { OrderOutboxWorker } from './infrastructure/outbox/order-outbox.worker';

@Module({
  providers: [
    OrderResolver,
    CreateOrderFromCartHandler,
    SubmitOrderHandler,
    CancelOrderHandler,
    GetOrderHandler,
    ListMyOrdersHandler,
    CheckoutPricingService,
    OrderPolicy,
    OrderEventStoreRepo,
    OrderEventMapper,
    OrderProjectionRepo,
    OrderProjectorService,
    CartReaderService,
    ProductReaderService,
    InventoryPublisherService,
    PaymentPublisherService,
    OrderOutboxRepo,
    OrderOutboxWorker,
  ],
})
export class OrderModule {}
