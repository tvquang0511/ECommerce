import { Worker, type Job } from 'bullmq';
import { env } from '../env.js';
import type { MailJob } from '../modules/mail/mail.types.js';
import { createSmtpTransport } from './mail/smtp.js';
import { buildMail } from './mail/templates/index.js';

export function startMailWorker() {
  if (!env.SMTP_HOST || !env.SMTP_FROM) {
    // eslint-disable-next-line no-console
    console.warn('[mail-worker] SMTP is not configured; jobs will fail until configured');
  }

  const connection = redisConnectionOptions();

  const transport = (() => {
    try {
      return createSmtpTransport();
    } catch {
      return undefined;
    }
  })();

  const worker = new Worker<MailJob>(
    'mail',
    async (job: Job<MailJob>) => {
      if (!transport) {
        throw new Error('SMTP transport not configured');
      }

      const message = buildMail(job.data);
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: job.data.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    },
    { connection },
  );

  worker.on('ready', () => {
    // eslint-disable-next-line no-console
    console.log('[mail-worker] ready');
  });

  worker.on('failed', (job: Job<MailJob> | undefined, err: unknown) => {
    // eslint-disable-next-line no-console
    console.error('[mail-worker] job failed', { id: job?.id, name: job?.name, type: job?.data?.type }, err);
  });

  worker.on('completed', (job: Job<MailJob>) => {
    // eslint-disable-next-line no-console
    console.log('[mail-worker] job completed', { id: job.id, name: job.name, type: job.data.type });
  });

  return worker;
}

function redisConnectionOptions() {
  const url = new URL(env.REDIS_URL);
  const port = url.port ? Number(url.port) : 6379;
  const db = url.pathname && url.pathname !== '/' ? Number(url.pathname.replace('/', '')) : undefined;
  return {
    host: url.hostname,
    port,
    username: url.username || undefined,
    password: url.password || undefined,
    db,
    maxRetriesPerRequest: null as any,
  };
}
