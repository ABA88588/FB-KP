import type { WorkerQueueMode } from "./config.js";
import type { QueueSnapshot } from "./queues/runtime.js";

export type WorkerRuntimeStatus = "starting" | "ready" | "disabled" | "degraded" | "shutting_down" | "stopped";

export interface WorkerRuntimeSnapshot {
  readonly appName: "@adflow/worker";
  readonly pid: number;
  readonly status: WorkerRuntimeStatus;
  readonly queueMode: WorkerQueueMode;
  readonly redisConfigured: boolean;
  readonly redisReason: string | null;
  readonly heartbeatPath: string;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly queues: readonly QueueSnapshot[];
  readonly lastError: string | null;
}

export interface MutableRuntimeState {
  status: WorkerRuntimeStatus;
  queueMode: WorkerQueueMode;
  redisConfigured: boolean;
  redisReason: string | null;
  queues: readonly QueueSnapshot[];
  lastError: string | null;
}
