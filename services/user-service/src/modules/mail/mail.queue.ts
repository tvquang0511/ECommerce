import { Queue } from "bullmq";
import { env } from "../../env.js";
import type { MailJob } from "./mail.types.js";

let queue: Queue<MailJob> | undefined;

function getQueue(): Queue<MailJob> {
  if (queue) return queue;

  const connection = redisConnectionOptions();
  queue = new Queue<MailJob>("mail", {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
  });
  return queue;
}

function redisConnectionOptions() {
  const url = new URL(env.REDIS_URL);
  const port = url.port ? Number(url.port) : 6379;
  const db =
    url.pathname && url.pathname !== "/"
      ? Number(url.pathname.replace("/", ""))
      : undefined;
  return {
    host: url.hostname,
    port,
    username: url.username || undefined,
    password: url.password || undefined,
    db,
    maxRetriesPerRequest: null as any,
  };
}

function smtpConfigured() {
  return Boolean(env.SMTP_HOST && env.SMTP_FROM);
}

export const mailQueue = {
  smtpConfigured,

  async enqueue(job: MailJob) {
    if (!smtpConfigured()) {
      // Allow API to run without SMTP in dev; caller can fall back to dev helpers.
      return { enqueued: false } as const;
    }
    await getQueue().add(job.type, job);
    return { enqueued: true } as const;
  },
};
