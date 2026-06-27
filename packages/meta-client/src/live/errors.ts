import { z } from "zod";
import { redactSensitiveText } from "@adflow/shared";

const metaErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
    fbtrace_id: z.string().optional(),
    is_transient: z.boolean().optional()
  }).passthrough()
}).passthrough();

export type NormalizedMetaError = {
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
  fbtraceId?: string;
  isTransient: boolean;
  internalCode: MetaInternalErrorCode;
  retryable: boolean;
};

export type MetaInternalErrorCode =
  | "META_TOKEN_EXPIRED"
  | "META_PERMISSION_DENIED"
  | "META_RATE_LIMITED"
  | "META_INVALID_PARAMETER"
  | "META_OBJECT_NOT_FOUND"
  | "META_ACCOUNT_DISABLED"
  | "META_TRANSIENT_ERROR"
  | "META_ASYNC_REPORT_FAILED"
  | "META_UNKNOWN_ERROR";

export class MetaApiError extends Error {
  readonly status: number;
  readonly requestId: string;
  readonly meta: NormalizedMetaError;

  constructor(status: number, requestId: string, meta: NormalizedMetaError) {
    super(redactSensitiveText(meta.message));
    this.name = "MetaApiError";
    this.status = status;
    this.requestId = requestId;
    this.meta = meta;
  }
}

export class MetaProviderConfigurationError extends Error {
  readonly code = "META_PROVIDER_UNCONFIGURED";
  readonly disabled = true;
  readonly missing: readonly string[];

  constructor(missing: readonly string[]) {
    super(`Live Meta provider is unconfigured: missing ${missing.join(", ")}`);
    this.name = "MetaProviderConfigurationError";
    this.missing = [...missing];
  }
}

export function normalizeMetaError(payload: unknown, status?: number): NormalizedMetaError {
  const parsed = metaErrorResponseSchema.safeParse(payload);
  if (!parsed.success) {
    const internalCode = classifyMetaError({ status });
    return {
      message: "Meta API request failed with an unrecognized error payload",
      isTransient: false,
      internalCode,
      retryable: isRetryable(internalCode)
    };
  }
  const internalCode = classifyMetaError({
    code: parsed.data.error.code,
    subcode: parsed.data.error.error_subcode,
    message: parsed.data.error.message,
    status,
    isTransient: parsed.data.error.is_transient
  });
  const normalized: NormalizedMetaError = {
    message: parsed.data.error.message,
    isTransient: parsed.data.error.is_transient ?? false,
    internalCode,
    retryable: isRetryable(internalCode)
  };
  if (parsed.data.error.type !== undefined) normalized.type = parsed.data.error.type;
  if (parsed.data.error.code !== undefined) normalized.code = parsed.data.error.code;
  if (parsed.data.error.error_subcode !== undefined) normalized.subcode = parsed.data.error.error_subcode;
  if (parsed.data.error.fbtrace_id !== undefined) normalized.fbtraceId = parsed.data.error.fbtrace_id;
  return normalized;
}

function classifyMetaError(input: { code?: number | undefined; subcode?: number | undefined; message?: string | undefined; status?: number | undefined; isTransient?: boolean | undefined }): MetaInternalErrorCode {
  if (input.code === 190 || input.status === 401) return "META_TOKEN_EXPIRED";
  if (input.status === 429 || input.subcode === 80004 || input.code === 4 || input.code === 17 || input.code === 32 || input.code === 613) return "META_RATE_LIMITED";
  if (input.status === 403 || input.code === 10 || input.code === 200 || input.code === 202 || input.code === 299) return "META_PERMISSION_DENIED";
  if (input.code === 100) return "META_INVALID_PARAMETER";
  if (input.code === 803 || input.code === 33) return "META_OBJECT_NOT_FOUND";
  if (input.code === 1487890 || /account.+(disabled|closed)|disabled.+account/i.test(input.message ?? "")) return "META_ACCOUNT_DISABLED";
  if (input.isTransient === true || input.code === 1 || input.code === 2 || (input.status !== undefined && input.status >= 500)) return "META_TRANSIENT_ERROR";
  if (/async.+report.+fail|report run.+fail/i.test(input.message ?? "")) return "META_ASYNC_REPORT_FAILED";
  return "META_UNKNOWN_ERROR";
}

function isRetryable(code: MetaInternalErrorCode): boolean {
  switch (code) {
    case "META_RATE_LIMITED":
    case "META_TRANSIENT_ERROR":
    case "META_ASYNC_REPORT_FAILED":
      return true;
    case "META_TOKEN_EXPIRED":
    case "META_PERMISSION_DENIED":
    case "META_INVALID_PARAMETER":
    case "META_OBJECT_NOT_FOUND":
    case "META_ACCOUNT_DISABLED":
    case "META_UNKNOWN_ERROR":
      return false;
  }
}
