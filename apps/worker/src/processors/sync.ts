import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { runProcessorSkeleton } from "./skeleton.js";
import { QUEUE_NAMES } from "../queues/names.js";

export function createSyncProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<never> => runProcessorSkeleton(QUEUE_NAMES.sync, job, context.logger);
}
