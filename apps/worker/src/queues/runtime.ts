import { Queue, QueueEvents, Worker, type JobsOptions } from "bullmq";

import type { WorkerConfig } from "../config.js";
import type { Logger } from "../logger.js";
import { serializeError } from "../logger.js";
import { createProcessorRegistry } from "../processors/index.js";
import { createRedisConnection } from "./redis.js";
import { backoffForBullMq, BOUNDED_BACKOFF_TYPE } from "./retry.js";
import { QUEUE_NAME_LIST, type QueueName } from "./names.js";

export interface QueueSnapshot {
  readonly name: QueueName;
  readonly enabled: boolean;
  readonly concurrency: number;
}

export interface QueueRuntime {
  readonly snapshots: () => readonly QueueSnapshot[];
  readonly close: () => Promise<void>;
}

export async function startQueueRuntime(config: WorkerConfig, logger: Logger): Promise<QueueRuntime> {
  if (config.redis.url === null) {
    throw new Error(config.redis.reason ?? "Redis is not configured.");
  }

  const connection = createRedisConnection(config.redis);
  connection.on("error", (error: Error) => {
    logger.error("redis connection error", { error: serializeError(error) });
  });

  await connection.connect();
  await connection.ping();

  const processorRegistry = createProcessorRegistry({
    logger,
    retryPolicy: config.retryPolicy
  });

  const defaultJobOptions: JobsOptions = {
    attempts: config.retryPolicy.maxAttempts,
    backoff: {
      type: BOUNDED_BACKOFF_TYPE
    },
    removeOnComplete: 1_000,
    removeOnFail: 5_000
  };

  const queues = QUEUE_NAME_LIST.map(
    (queueName) =>
      new Queue(queueName, {
        connection,
        prefix: config.queuePrefix,
        defaultJobOptions
      })
  );

  const queueEvents = QUEUE_NAME_LIST.map((queueName) => {
    const events = new QueueEvents(queueName, {
      connection,
      prefix: config.queuePrefix
    });

    events.on("failed", ({ jobId, failedReason }) => {
      logger.warn("queue job failed", {
        queueName,
        jobId,
        failedReason
      });
    });

    return events;
  });

  const workers = QUEUE_NAME_LIST.map((queueName) => {
    const worker = new Worker(queueName, processorRegistry[queueName], {
      connection,
      prefix: config.queuePrefix,
      concurrency: config.concurrency,
      settings: {
        backoffStrategy: (attemptsMade: number, type?: string, error?: Error) => {
          if (type !== BOUNDED_BACKOFF_TYPE) {
            return -1;
          }

          return backoffForBullMq(attemptsMade, error, config.retryPolicy);
        }
      }
    });

    worker.on("ready", () => {
      logger.info("worker queue ready", { queueName });
    });

    worker.on("failed", (job, error) => {
      logger.warn("worker job failed", {
        queueName,
        jobName: job?.name ?? null,
        jobId: job?.id ?? null,
        error: serializeError(error)
      });
    });

    worker.on("error", (error) => {
      logger.error("worker queue error", {
        queueName,
        error: serializeError(error)
      });
    });

    return worker;
  });

  logger.info("worker queues started", {
    queues: QUEUE_NAME_LIST.map((queueName) => ({ name: queueName }))
  });

  return {
    snapshots: () =>
      QUEUE_NAME_LIST.map((queueName) => ({
        name: queueName,
        enabled: true,
        concurrency: config.concurrency
      })),
    close: async () => {
      await Promise.all(workers.map((worker) => worker.close()));
      await Promise.all(queueEvents.map((events) => events.close()));
      await Promise.all(queues.map((queue) => queue.close()));
      await connection.quit();
    }
  };
}
