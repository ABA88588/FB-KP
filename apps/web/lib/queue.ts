import { Queue } from "bullmq";
import { Redis } from "ioredis";

let connection: Redis | null = null;

export function getRedisConnection(): Redis {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL is required to enqueue worker jobs.");
  }
  connection ??= new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true
  });
  return connection;
}

export async function enqueueWorkerJob(queueName: string, jobName: string, data: unknown, idempotencyKey: string): Promise<void> {
  const queue = new Queue(queueName, {
    connection: getRedisConnection(),
    prefix: process.env.WORKER_QUEUE_PREFIX || "adflow"
  });
  try {
    await queue.add(jobName, data, {
      jobId: idempotencyKey,
      attempts: 3,
      removeOnComplete: 1_000,
      removeOnFail: 5_000
    });
  } finally {
    await queue.close();
  }
}
