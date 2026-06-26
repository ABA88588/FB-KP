import { describe, expect, it } from "vitest";

import { calculateBoundedBackoffMs, shouldRetryJobFailure } from "./queues/retry.js";
import { parseWorkerJobData } from "./queues/schemas.js";
import { QUEUE_NAMES } from "./queues/names.js";

const baseJob = {
  jobVersion: 1,
  organizationId: "org_1",
  connectionId: "conn_1",
  adAccountId: "act_1",
  requestId: "req_1",
  idempotencyKey: "idem_1"
} as const;

describe("worker queue schemas", () => {
  it("validates known queue job payloads", () => {
    const parsed = parseWorkerJobData(QUEUE_NAMES.sync, "sync-insights", {
      ...baseJob,
      payload: {
        level: "AD",
        dateRange: {
          since: "2026-06-01",
          until: "2026-06-26"
        }
      }
    });

    expect(parsed.requestId).toBe("req_1");
  });

  it("rejects unknown jobs", () => {
    expect(() => parseWorkerJobData(QUEUE_NAMES.sync, "unknown-job", baseJob)).toThrow("Unknown job");
  });
});

describe("bounded retry helper", () => {
  it("caps exponential backoff and applies deterministic jitter", () => {
    const delay = calculateBoundedBackoffMs(
      10,
      {
        maxAttempts: 5,
        baseDelayMs: 1_000,
        maxDelayMs: 60_000,
        jitterRatio: 0.2
      },
      () => 1
    );

    expect(delay).toBe(60_000);
  });

  it("does not retry non-retryable or exhausted failures", () => {
    expect(shouldRetryJobFailure({ retryable: false }, 1)).toBe(false);
    expect(shouldRetryJobFailure({ statusCode: 429 }, 5)).toBe(false);
    expect(shouldRetryJobFailure({ statusCode: 429 }, 1)).toBe(true);
  });
});
