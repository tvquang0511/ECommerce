import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('inventory.port') ?? 4010;
  const nodeEnv = configService.get<string>('inventory.nodeEnv') ?? 'development';

  await app.listen(port);

  console.log(`[Nest] Inventory Service is running on: http://localhost:${port}`);
  console.log(`[Nest] Environment: ${nodeEnv}`);
}

bootstrap();
