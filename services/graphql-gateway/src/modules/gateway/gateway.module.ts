import { Module } from '@nestjs/common';

import { GatewayBootstrapService } from './gateway-bootstrap.service';
import { GatewayService } from './gateway.service';

@Module({
  providers: [GatewayService, GatewayBootstrapService],
  exports: [GatewayService, GatewayBootstrapService],
})
export class GatewayModule {}
