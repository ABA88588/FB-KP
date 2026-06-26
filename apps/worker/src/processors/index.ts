import type { Job } from "bullmq";

import type { ProcessorContext } from "./context.js";
import { createExportsProcessor } from "./exports.js";
import { createMaintenanceProcessor } from "./maintenance.js";
import { createMutationsProcessor } from "./mutations.js";
import { createReportsProcessor } from "./reports.js";
import { createSyncProcessor } from "./sync.js";
import { QUEUE_NAMES, type QueueName } from "../queues/names.js";

export type WorkerProcessor = (job: Job<unknown, unknown, string>) => Promise<unknown>;

export function createProcessorRegistry(context: ProcessorContext): Record<QueueName, WorkerProcessor> {
  return {
    [QUEUE_NAMES.sync]: createSyncProcessor(context),
    [QUEUE_NAMES.reports]: createReportsProcessor(context),
    [QUEUE_NAMES.mutations]: createMutationsProcessor(context),
    [QUEUE_NAMES.exports]: createExportsProcessor(),
    [QUEUE_NAMES.maintenance]: createMaintenanceProcessor(context)
  };
}
