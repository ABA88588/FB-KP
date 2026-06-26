import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { runProcessorSkeleton } from "./skeleton.js";
import { QUEUE_NAMES } from "../queues/names.js";

export function createReportsProcessor(context: ProcessorContext) {
  return async (job: Job<unknown, unknown, string>): Promise<never> => runProcessorSkeleton(QUEUE_NAMES.reports, job, context.logger);
}
