import { describe, expect, it } from "vitest";

import { MetaApiError, normalizeMetaError } from "@adflow/meta-client";
import { calculateBoundedBackoffMs, shouldRetryJobFailure } from "./queues/retry.js";
import { parseWorkerJobData } from "./queues/schemas.js";
import { QUEUE_NAMES } from "./queues/names.js";
import { errorJson } from "./processors/service-context.js";

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

  it("retries normalized Meta rate-limit errors", () => {
    const error = new MetaApiError(429, "req_meta_1", normalizeMetaError({
      error: {
        message: "Too many calls",
        code: 4,
        error_subcode: 80004,
        fbtrace_id: "trace_1"
      }
    }, 429));

    expect(shouldRetryJobFailure(error, 1)).toBe(true);
  });
});

describe("worker Meta error metadata", () => {
  it("keeps Meta code, subcode, and fbtrace id for persistence", () => {
    const error = new MetaApiError(429, "req_meta_1", normalizeMetaError({
      error: {
        message: "Too many calls",
        code: 4,
        error_subcode: 80004,
        fbtrace_id: "trace_1"
      }
    }, 429));

    expect(errorJson(error)).toEqual({
      message: "Too many calls",
      retryable: true,
      meta: {
        status: 429,
        requestId: "req_meta_1",
        code: 4,
        subcode: 80004,
        fbtraceId: "trace_1",
        internalCode: "META_RATE_LIMITED"
      }
    });
  });
});
