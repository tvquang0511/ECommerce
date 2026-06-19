import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4002;
  const nodeEnv = configService.get<string>('app.nodeEnv') ?? 'development';

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port);

  console.log(
    `[Nest] Product Subgraph is running on: http://localhost:${port}/graphql`,
  );
  console.log(`[Nest] Environment: ${nodeEnv}`);
}

bootstrap();