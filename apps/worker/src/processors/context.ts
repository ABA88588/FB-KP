import type { Logger } from "../logger.js";
import type { RetryPolicy } from "../queues/retry.js";

export interface ProcessorContext {
  readonly logger: Logger;
  readonly retryPolicy: RetryPolicy;
}
