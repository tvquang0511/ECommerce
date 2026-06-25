import { Module } from '@nestjs/common';

import { InventoryController } from './inventory.controller';
import { InventoryOrderCallbackService } from './inventory-order-callback.service';
import { InventoryRabbitMqConsumer } from './inventory-rabbitmq.consumer';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController],
  providers: [
    InventoryService,
    InventoryOrderCallbackService,
    InventoryRabbitMqConsumer,
  ],
})
export class InventoryModule {}
