import { z } from "zod";

import { DEFAULT_RETRY_POLICY, type RetryPolicy } from "./queues/retry.js";

export type WorkerQueueMode = "enabled" | "disabled" | "degraded";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface RedisConfig {
  readonly mode: WorkerQueueMode;
  readonly url: string | null;
  readonly reason: string | null;
  readonly connectTimeoutMs: number;
}

export interface HealthConfig {
  readonly host: string;
  readonly port: number;
  readonly httpEnabled: boolean;
  readonly heartbeatPath: string;
  readonly heartbeatIntervalMs: number;
}

export interface WorkerConfig {
  readonly nodeEnv: "development" | "test" | "production";
  readonly logLevel: LogLevel;
  readonly appName: "@adflow/worker";
  readonly queuePrefix: string;
  readonly concurrency: number;
  readonly shutdownTimeoutMs: number;
  readonly redis: RedisConfig;
  readonly health: HealthConfig;
  readonly retryPolicy: RetryPolicy;
}

const blankToUndefined = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }

  return value;
};

const optionalTrimmedString = z.preprocess(blankToUndefined, z.string().trim().optional());

const RawEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional().default("info"),
  REDIS_URL: optionalTrimmedString,
  WORKER_QUEUE_PREFIX: optionalTrimmedString.default("adflow"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).optional().default(2),
  WORKER_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(300_000).optional().default(30_000),
  WORKER_REDIS_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(500).max(60_000).optional().default(5_000),
  WORKER_HEALTH_HOST: optionalTrimmedString.default("0.0.0.0"),
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65_535).optional().default(3008),
  WORKER_DISABLE_HTTP_HEALTH: z
    .enum(["true", "false", "1", "0"])
    .optional()
    .default("false")
    .transform((value) => value === "true" || value === "1"),
  WORKER_HEARTBEAT_PATH: optionalTrimmedString.default(".worker-heartbeat.json"),
  WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1_000).max(300_000).optional().default(10_000)
});

export function loadWorkerConfig(env: NodeJS.ProcessEnv): WorkerConfig {
  const raw = RawEnvSchema.parse(env);
  const redis = normalizeRedisConfig(raw.REDIS_URL, raw.WORKER_REDIS_CONNECT_TIMEOUT_MS);

  return {
    nodeEnv: raw.NODE_ENV,
    logLevel: raw.LOG_LEVEL,
    appName: "@adflow/worker",
    queuePrefix: raw.WORKER_QUEUE_PREFIX,
    concurrency: raw.WORKER_CONCURRENCY,
    shutdownTimeoutMs: raw.WORKER_SHUTDOWN_TIMEOUT_MS,
    redis,
    health: {
      host: raw.WORKER_HEALTH_HOST,
      port: raw.WORKER_HEALTH_PORT,
      httpEnabled: !raw.WORKER_DISABLE_HTTP_HEALTH,
      heartbeatPath: raw.WORKER_HEARTBEAT_PATH,
      heartbeatIntervalMs: raw.WORKER_HEARTBEAT_INTERVAL_MS
    },
    retryPolicy: DEFAULT_RETRY_POLICY
  };
}

function normalizeRedisConfig(redisUrl: string | undefined, connectTimeoutMs: number): RedisConfig {
  if (redisUrl === undefined) {
    return {
      mode: "disabled",
      url: null,
      reason: "REDIS_URL is not configured; queue workers are disabled.",
      connectTimeoutMs
    };
  }

  try {
    const parsed = new URL(redisUrl);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      return {
        mode: "degraded",
        url: null,
        reason: "REDIS_URL must use redis:// or rediss://; queue workers are disabled.",
        connectTimeoutMs
      };
    }

    return {
      mode: "enabled",
      url: redisUrl,
      reason: null,
      connectTimeoutMs
    };
  } catch {
    return {
      mode: "degraded",
      url: null,
      reason: "REDIS_URL is invalid; queue workers are disabled.",
      connectTimeoutMs
    };
  }
}
