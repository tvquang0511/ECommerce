import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 4002);

  await app.listen(port);
  console.log(`product-subgraph running at http://localhost:${port}`);
}

void bootstrap();
