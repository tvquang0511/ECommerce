import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { AppModule } from './app.module';
import { GatewayBootstrapService } from './modules/gateway/gateway-bootstrap.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const gatewayBootstrapService = app.get(GatewayBootstrapService);
  await gatewayBootstrapService.mount(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('gateway.port') ?? 4000;
  const nodeEnv = configService.get<string>('gateway.nodeEnv') ?? 'development';

  await app.listen(port);

  console.log(`[Nest] GraphQL Gateway is running on: http://localhost:${port}/graphql`);
  console.log(`[Nest] Environment: ${nodeEnv}`);
  console.log(
    `[Nest] Composing subgraph: product -> ${configService.get<string>('gateway.productSubgraphUrl')}`,
  );
  console.log(
    `[Nest] Composing subgraph: cart    -> ${configService.get<string>('gateway.cartSubgraphUrl')}`,
  );
  console.log(
    `[Nest] Composing subgraph: order   -> ${configService.get<string>('gateway.orderSubgraphUrl')}`,
  );
}

bootstrap();
