export const BOUNDED_BACKOFF_TYPE = "bounded-exponential-jitter";

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
  jitterRatio: 0.2
};

const RETRYABLE_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "META_RATE_LIMITED",
  "META_TRANSIENT_ERROR",
  "META_TIMEOUT",
  "NETWORK_TIMEOUT"
]);

export function calculateBoundedBackoffMs(
  attemptsMade: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random
): number {
  const safeAttempt = Math.max(1, attemptsMade);
  const exponentialDelay = policy.baseDelayMs * 2 ** (safeAttempt - 1);
  const cappedDelay = Math.min(exponentialDelay, policy.maxDelayMs);
  const jitterWindow = cappedDelay * policy.jitterRatio;
  const jitter = (random() * 2 - 1) * jitterWindow;

  return Math.max(0, Math.min(policy.maxDelayMs, Math.round(cappedDelay + jitter)));
}

export function shouldRetryJobFailure(error: unknown, attemptsMade: number, policy: RetryPolicy = DEFAULT_RETRY_POLICY): boolean {
  if (attemptsMade >= policy.maxAttempts) {
    return false;
  }

  return isRetryableWorkerError(error);
}

export function isRetryableWorkerError(error: unknown): boolean {
  const details = extractErrorDetails(error);

  if (details.retryable === false) {
    return false;
  }

  if (details.retryable === true) {
    return true;
  }

  if (details.statusCode !== null) {
    if (details.statusCode === 408 || details.statusCode === 409 || details.statusCode === 425 || details.statusCode === 429) {
      return true;
    }

    if (details.statusCode >= 500 && details.statusCode <= 599) {
      return true;
    }
  }

  if (details.code !== null && RETRYABLE_ERROR_CODES.has(details.code)) {
    return true;
  }

  const message = details.message.toLowerCase();
  return message.includes("timeout") || message.includes("rate limit") || message.includes("temporarily unavailable");
}

export function backoffForBullMq(attemptsMade: number, error: Error | undefined, policy: RetryPolicy = DEFAULT_RETRY_POLICY): number {
  if (!shouldRetryJobFailure(error, attemptsMade, policy)) {
    return -1;
  }

  return calculateBoundedBackoffMs(attemptsMade, policy);
}

interface ErrorDetails {
  readonly message: string;
  readonly code: string | null;
  readonly statusCode: number | null;
  readonly retryable: boolean | null;
}

function extractErrorDetails(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    const record = error as Error & {
      readonly code?: unknown;
      readonly status?: unknown;
      readonly statusCode?: unknown;
      readonly retryable?: unknown;
    };

    return {
      message: error.message,
      code: typeof record.code === "string" ? record.code : null,
      statusCode: coerceStatusCode(record.statusCode ?? record.status),
      retryable: typeof record.retryable === "boolean" ? record.retryable : null
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as {
      readonly message?: unknown;
      readonly code?: unknown;
      readonly status?: unknown;
      readonly statusCode?: unknown;
      readonly retryable?: unknown;
    };

    return {
      message: typeof record.message === "string" ? record.message : "Unknown object error",
      code: typeof record.code === "string" ? record.code : null,
      statusCode: coerceStatusCode(record.statusCode ?? record.status),
      retryable: typeof record.retryable === "boolean" ? record.retryable : null
    };
  }

  return {
    message: String(error),
    code: null,
    statusCode: null,
    retryable: null
  };
}

function coerceStatusCode(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
}
