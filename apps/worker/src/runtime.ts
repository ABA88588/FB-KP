import type { WorkerConfig } from "./config.js";
import { HeartbeatWriter, resolveHeartbeatPath } from "./health/heartbeat.js";
import { startHealthServer, type HealthServer } from "./health/server.js";
import { createLogger, serializeError } from "./logger.js";
import { startQueueRuntime, type QueueRuntime } from "./queues/runtime.js";
import type { MutableRuntimeState, WorkerRuntimeSnapshot } from "./runtime-state.js";

export interface WorkerApplication {
  readonly snapshot: () => WorkerRuntimeSnapshot;
  readonly shutdown: (reason: string) => Promise<void>;
}

export async function bootWorkerApp(config: WorkerConfig): Promise<WorkerApplication> {
  const logger = createLogger(config.logLevel);
  const startedAt = new Date().toISOString();
  const heartbeatPath = resolveHeartbeatPath(config.health.heartbeatPath);
  let queueRuntime: QueueRuntime | null = null;
  let healthServer: HealthServer | null = null;
  let shutdownStarted = false;

  const state: MutableRuntimeState = {
    status: "starting",
    queueMode: config.redis.mode,
    redisConfigured: config.redis.url !== null,
    redisReason: config.redis.reason,
    queues: [],
    lastError: null
  };

  const snapshot = (): WorkerRuntimeSnapshot => ({
    appName: config.appName,
    pid: process.pid,
    status: state.status,
    queueMode: state.queueMode,
    redisConfigured: state.redisConfigured,
    redisReason: state.redisReason,
    heartbeatPath,
    startedAt,
    updatedAt: new Date().toISOString(),
    queues: state.queues,
    lastError: state.lastError
  });

  const heartbeat = new HeartbeatWriter(config.health.heartbeatPath, config.health.heartbeatIntervalMs, snapshot);
  heartbeat.start();

  if (config.health.httpEnabled) {
    healthServer = await startHealthServer(config, snapshot, logger);
  } else {
    logger.warn("worker http health server disabled by WORKER_DISABLE_HTTP_HEALTH");
  }

  if (config.redis.mode !== "enabled") {
    state.status = config.redis.mode;
    logger.warn("worker queues disabled", {
      mode: config.redis.mode,
      reason: config.redis.reason
    });
  } else {
    try {
      queueRuntime = await startQueueRuntime(config, logger);
      state.queues = queueRuntime.snapshots();
      state.status = "ready";
      state.queueMode = "enabled";
      state.redisReason = null;
    } catch (error) {
      const serializedError = serializeError(error);
      state.status = "degraded";
      state.queueMode = "degraded";
      state.redisReason = "Redis connection failed; queue workers are disabled.";
      state.lastError = typeof serializedError.message === "string" ? serializedError.message : "Redis connection failed";
      logger.error("worker queues failed to start", {
        error: serializedError
      });
    }
  }

  await heartbeat.writeNow();

  const shutdown = async (reason: string): Promise<void> => {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    state.status = "shutting_down";
    await heartbeat.writeNow();
    logger.info("worker shutdown started", { reason });

    await withTimeout(
      async () => {
        if (queueRuntime !== null) {
          await queueRuntime.close();
        }

        if (healthServer !== null) {
          await healthServer.close();
        }
      },
      config.shutdownTimeoutMs,
      `Worker shutdown exceeded ${config.shutdownTimeoutMs}ms`
    );

    state.status = "stopped";
    await heartbeat.stop();
    logger.info("worker shutdown complete", { reason });
  };

  return {
    snapshot,
    shutdown
  };
}

export async function runWorkerApp(config: WorkerConfig): Promise<void> {
  const app = await bootWorkerApp(config);

  await new Promise<void>((resolve) => {
    const shutdownFromSignal = (signal: NodeJS.Signals): void => {
      void app
        .shutdown(signal)
        .catch((error: unknown) => {
          console.error(JSON.stringify({ level: "error", message: "worker shutdown failed", error: serializeError(error) }));
          process.exitCode = 1;
        })
        .finally(resolve);
    };

    process.once("SIGINT", shutdownFromSignal);
    process.once("SIGTERM", shutdownFromSignal);
  });
}

async function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
  }
}
