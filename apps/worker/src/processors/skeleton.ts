import { UnrecoverableError, type Job } from "bullmq";

import { JobValidationError, ProcessorNotImplementedError } from "../errors.js";
import type { Logger } from "../logger.js";
import type { QueueName } from "../queues/names.js";
import { parseWorkerJobData } from "../queues/schemas.js";

export function runProcessorSkeleton(queueName: QueueName, job: Job<unknown, unknown, string>, logger: Logger): Promise<never> {
  try {
    const parsed = parseWorkerJobData(queueName, job.name, job.data);
    logger.warn("worker processor skeleton received a job but did not execute it", {
      queueName,
      jobName: job.name,
      jobId: job.id ?? null,
      requestId: parsed.requestId
    });

    return Promise.reject(new UnrecoverableError(new ProcessorNotImplementedError(queueName, job.name).message));
  } catch (error) {
    if (error instanceof JobValidationError || error instanceof ProcessorNotImplementedError) {
      return Promise.reject(new UnrecoverableError(error.message));
    }

    return Promise.reject(error instanceof Error ? error : new Error("Worker processor failed with a non-Error rejection."));
  }
}
