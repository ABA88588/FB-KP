import type { Job } from "bullmq";

import type { Logger } from "../logger.js";
import { DEFAULT_RETRY_POLICY } from "../queues/retry.js";
import type { QueueName } from "../queues/names.js";
import { createProcessorRegistry } from "./index.js";

export function runProcessorSkeleton(queueName: QueueName, job: Job<unknown, unknown, string>, logger: Logger): Promise<unknown> {
  logger.warn("runProcessorSkeleton is deprecated; dispatching to real worker processor", {
    queueName,
    jobName: job.name,
    jobId: job.id ?? null
  });
  const registry = createProcessorRegistry({
    logger,
    retryPolicy: DEFAULT_RETRY_POLICY
  });
  return registry[queueName](job);
}
