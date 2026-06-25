import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: Number(process.env.PORT ?? 4004),
  nodeEnv: (process.env.NODE_ENV ?? 'development') as
    | 'development'
    | 'production'
    | 'test',
  outboxWorkerEnabled: process.env.OUTBOX_WORKER_ENABLED !== 'false',
  outboxWorkerIntervalMs: Number(process.env.OUTBOX_WORKER_INTERVAL_MS ?? 1000),
  outboxWorkerBatchSize: Number(process.env.OUTBOX_WORKER_BATCH_SIZE ?? 20),
}));
