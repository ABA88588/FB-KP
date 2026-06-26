import { createConnection } from "node:net";
import { createRequestId, envReadiness, normalizeServerEnvInput, safeParseServerEnv, type EnvInput, type ServerEnv } from "@adflow/shared";

export type HealthCheckStatus = "ok" | "degraded" | "unavailable" | "unconfigured";
export type OverallHealthStatus = "ok" | "degraded" | "unavailable";

export type HealthCheck = {
  status: HealthCheckStatus;
  message: string;
  durationMs?: number;
  details?: Record<string, string | number | boolean | null | readonly string[]>;
};

export type HealthResponse = {
  status: OverallHealthStatus;
  service: "adflow-web";
  checks: {
    env: HealthCheck;
    db: HealthCheck;
    redis: HealthCheck;
    worker: HealthCheck;
    mode: HealthCheck;
    writeGates: HealthCheck;
  };
  meta: {
    requestId: string;
    checkedAt: string;
  };
};

export type HealthProbeOptions = {
  now: Date;
  timeoutMs: number;
};

export type BuildReadinessOptions = {
  env?: EnvInput;
  now?: Date;
  requestId?: string;
  timeoutMs?: number;
  probes?: Partial<{
    db: (env: ServerEnv, options: HealthProbeOptions) => Promise<HealthCheck>;
    redis: (env: ServerEnv, options: HealthProbeOptions) => Promise<HealthCheck>;
    worker: (env: ServerEnv, options: HealthProbeOptions) => Promise<HealthCheck>;
  }>;
};

export function buildLivenessResponse(requestId = createRequestId("health")): HealthResponse {
  const checkedAt = new Date().toISOString();
  const ok = { status: "ok", message: "Process is alive" } as const;
  return {
    status: "ok",
    service: "adflow-web",
    checks: {
      env: ok,
      db: ok,
      redis: ok,
      worker: ok,
      mode: ok,
      writeGates: ok
    },
    meta: { requestId, checkedAt }
  };
}

export async function buildReadinessResponse(options: BuildReadinessOptions = {}): Promise<HealthResponse> {
  const now = options.now ?? new Date();
  const requestId = options.requestId ?? createRequestId("health");
  const envInput = options.env ?? process.env;
  const envResult = safeParseServerEnv(envInput);
  const env = envResult.success ? envResult.data : coerceServerEnv(envInput);
  const readiness = envReadiness(env);
  const probeOptions = { now, timeoutMs: options.timeoutMs ?? 250 };

  const checks = {
    env: buildEnvCheck(envResult, readiness, env),
    db: await (options.probes?.db ?? checkDatabase)(env, probeOptions),
    redis: await (options.probes?.redis ?? checkRedis)(env, probeOptions),
    worker: await (options.probes?.worker ?? checkWorker)(env, probeOptions),
    mode: buildModeCheck(env, readiness),
    writeGates: buildWriteGateCheck(env, readiness)
  };

  return {
    status: summarizeChecks(Object.values(checks)),
    service: "adflow-web",
    checks,
    meta: {
      requestId,
      checkedAt: now.toISOString()
    }
  };
}

async function checkDatabase(env: ServerEnv, options: HealthProbeOptions): Promise<HealthCheck> {
  if (!env.DATABASE_URL) return { status: "unconfigured", message: "DATABASE_URL is not configured" };
  return probeTcpUrl(env.DATABASE_URL, "postgresql", 5432, options.timeoutMs);
}

async function checkRedis(env: ServerEnv, options: HealthProbeOptions): Promise<HealthCheck> {
  if (!env.REDIS_URL) return { status: "unconfigured", message: "REDIS_URL is not configured" };
  return probeTcpUrl(env.REDIS_URL, "redis", 6379, options.timeoutMs);
}

async function probeTcpUrl(rawUrl: string, expectedService: string, defaultPort: number, timeoutMs: number): Promise<HealthCheck> {
  const startedAt = Date.now();
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { status: "degraded", message: `${expectedService} URL is invalid` };
  }

  const port = Number(url.port || defaultPort);
  if (!url.hostname || !Number.isInteger(port)) {
    return { status: "degraded", message: `${expectedService} URL host or port is invalid` };
  }

  return new Promise<HealthCheck>((resolve) => {
    const socket = createConnection({ host: url.hostname, port });
    let settled = false;

    const finish = (check: HealthCheck) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ ...check, durationMs: Date.now() - startedAt });
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      finish({
        status: "ok",
        message: `${expectedService} TCP endpoint is reachable`,
        details: { host: url.hostname, port }
      });
    });
    socket.once("timeout", () => {
      finish({
        status: "degraded",
        message: `${expectedService} TCP endpoint timed out`,
        details: { host: url.hostname, port }
      });
    });
    socket.once("error", () => {
      finish({
        status: "degraded",
        message: `${expectedService} TCP endpoint is not reachable`,
        details: { host: url.hostname, port }
      });
    });
  });
}

function checkWorker(env: ServerEnv, options: HealthProbeOptions): Promise<HealthCheck> {
  if (!env.WORKER_HEARTBEAT_ISO) {
    return Promise.resolve({ status: "unconfigured", message: "Worker heartbeat is not configured" });
  }

  const heartbeatAt = new Date(env.WORKER_HEARTBEAT_ISO);
  if (Number.isNaN(heartbeatAt.getTime())) {
    return Promise.resolve({ status: "degraded", message: "Worker heartbeat is invalid" });
  }

  const ageSeconds = Math.floor((options.now.getTime() - heartbeatAt.getTime()) / 1000);
  if (ageSeconds > 120) {
    return Promise.resolve({
      status: "unavailable",
      message: "Worker heartbeat is stale",
      details: { ageSeconds }
    });
  }

  return Promise.resolve({
    status: "ok",
    message: "Worker heartbeat is fresh",
    details: { ageSeconds }
  });
}

function buildEnvCheck(envResult: ReturnType<typeof safeParseServerEnv>, readiness: ReturnType<typeof envReadiness>, env: ServerEnv): HealthCheck {
  const invalid = envResult.success ? [] : envResult.error.issues.map((issue) => issue.path.join(".") || "env");
  const requiredMissing = [
    ...(!env.DATABASE_URL ? ["DATABASE_URL"] : []),
    ...(!env.REDIS_URL ? ["REDIS_URL"] : []),
    ...(!env.AUTH_SECRET ? ["AUTH_SECRET"] : []),
    ...(!readiness.tokenEncryptionConfigured ? ["TOKEN_ENCRYPTION_KEY"] : []),
    ...(!env.DEMO_MODE && !env.META_APP_ID ? ["META_APP_ID"] : []),
    ...(!env.DEMO_MODE && !env.META_APP_SECRET ? ["META_APP_SECRET"] : []),
    ...(!env.DEMO_MODE && !env.META_OAUTH_REDIRECT_URI ? ["META_OAUTH_REDIRECT_URI"] : [])
  ];

  if (invalid.length > 0 || requiredMissing.length > 0) {
    return {
      status: "degraded",
      message: "Environment is incomplete or invalid",
      details: { invalid, missing: requiredMissing }
    };
  }

  return { status: "ok", message: "Environment shape is valid" };
}

function buildModeCheck(env: ServerEnv, readiness: ReturnType<typeof envReadiness>): HealthCheck {
  if (env.DEMO_MODE) {
    return { status: "ok", message: "Demo mode is enabled", details: { mode: "demo" } };
  }

  if (!readiness.metaConfigured) {
    return {
      status: "degraded",
      message: "Live mode requested but Meta OAuth env is incomplete",
      details: { mode: "live" }
    };
  }

  return { status: "ok", message: "Live mode environment is configured", details: { mode: "live" } };
}

function buildWriteGateCheck(env: ServerEnv, readiness: ReturnType<typeof envReadiness>): HealthCheck {
  const gates = {
    enableMetaWrites: readiness.writesEnabled,
    emergencyReadonly: readiness.emergencyReadonly,
    allowlistCount: env.ALLOWED_META_AD_ACCOUNT_IDS.length
  };

  if (!readiness.writesEnabled) {
    return {
      status: "ok",
      message: "Meta writes are disabled by environment",
      details: gates
    };
  }
  if (readiness.emergencyReadonly) {
    return {
      status: "ok",
      message: "Emergency readonly mode blocks Meta writes",
      details: gates
    };
  }
  if (env.ALLOWED_META_AD_ACCOUNT_IDS.length === 0) {
    return {
      status: "degraded",
      message: "Meta writes are enabled without an ad account allowlist",
      details: gates
    };
  }

  return {
    status: "ok",
    message: "Meta write gates are configured",
    details: gates
  };
}

function summarizeChecks(checks: readonly HealthCheck[]): OverallHealthStatus {
  if (checks.some((check) => check.status === "unavailable")) return "unavailable";
  if (checks.some((check) => check.status !== "ok")) return "degraded";
  return "ok";
}

function coerceServerEnv(input: EnvInput): ServerEnv {
  const normalized = normalizeServerEnvInput(input);
  return {
    NODE_ENV: coerceNodeEnv(normalized.NODE_ENV),
    APP_BASE_URL: coerceString(normalized.APP_BASE_URL) ?? "http://localhost:3000",
    DATABASE_URL: coerceString(normalized.DATABASE_URL) ?? "",
    REDIS_URL: coerceString(normalized.REDIS_URL) ?? "",
    AUTH_SECRET: coerceString(normalized.AUTH_SECRET) ?? "",
    TOKEN_ENCRYPTION_KEY: coerceString(normalized.TOKEN_ENCRYPTION_KEY) ?? "",
    TOKEN_ENCRYPTION_KEY_BASE64: coerceString(normalized.TOKEN_ENCRYPTION_KEY_BASE64) ?? "",
    META_APP_ID: coerceString(normalized.META_APP_ID) ?? "",
    META_APP_SECRET: coerceString(normalized.META_APP_SECRET) ?? "",
    META_GRAPH_API_VERSION: coerceString(normalized.META_GRAPH_API_VERSION) ?? "v25.0",
    META_OAUTH_REDIRECT_URI: coerceString(normalized.META_OAUTH_REDIRECT_URI) ?? "",
    ENABLE_META_WRITES: coerceBoolean(normalized.ENABLE_META_WRITES, false),
    EMERGENCY_READONLY: coerceBoolean(normalized.EMERGENCY_READONLY, false),
    DEMO_MODE: coerceBoolean(normalized.DEMO_MODE, true),
    META_DEMO_MODE: coerceBoolean(normalized.META_DEMO_MODE, true),
    ALLOWED_META_AD_ACCOUNT_IDS: splitCsv(coerceString(normalized.ALLOWED_META_AD_ACCOUNT_IDS)),
    WORKER_HEARTBEAT_ISO: coerceString(normalized.WORKER_HEARTBEAT_ISO) ?? ""
  };
}

function coerceNodeEnv(value: string | boolean | undefined): "development" | "test" | "production" {
  if (value === "test" || value === "production") return value;
  return "development";
}

function coerceString(value: string | boolean | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceBoolean(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.toLowerCase().trim();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function splitCsv(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}
