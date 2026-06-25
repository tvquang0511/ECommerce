import { Module } from '@nestjs/common';

import { PaymentCallbackService } from './payment-callback.service';
import { PaymentRabbitMqConsumer } from './payment-rabbitmq.consumer';
import { PaymentService } from './payment.service';

@Module({
  providers: [PaymentService, PaymentCallbackService, PaymentRabbitMqConsumer],
})
export class PaymentModule {}
