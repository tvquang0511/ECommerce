import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { OrderOutboxWorker } from '../modules/order/infrastructure/outbox/order-outbox.worker';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const worker = app.get(OrderOutboxWorker);
    const flushed = await worker.flushPending();
    console.log(`Flushed ${flushed} outbox entr${flushed === 1 ? 'y' : 'ies'}.`);
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
