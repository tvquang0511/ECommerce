import 'reflect-metadata';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: true,
  });

  await app.listen(env.PORT);

  const logger = new Logger('Bootstrap');
  logger.log(`product-subgraph (apollo-first) running at http://localhost:${env.PORT}/graphql`);
  logger.log(`healthcheck at http://localhost:${env.PORT}/health`);
}

void bootstrap();
