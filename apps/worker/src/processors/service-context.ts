import { Prisma, prisma } from "@adflow/db";
import { createLiveMetaAdsProviderFromEnv, MetaApiError } from "@adflow/meta-client";
import { decryptToken, parseServerEnv, safeErrorMessage } from "@adflow/shared";

export async function getAccessToken(connectionId: string): Promise<string> {
  const env = parseServerEnv(process.env);
  const token = await prisma.encryptedToken.findFirst({
    where: {
      connectionId,
      revokedAt: null
    },
    orderBy: { createdAt: "desc" }
  });
  if (token) {
    return decryptToken(
      {
        ciphertext: token.ciphertext,
        iv: token.iv,
        authTag: token.authTag,
        keyVersion: token.keyVersion
      },
      env.TOKEN_ENCRYPTION_KEY_BASE64 || env.TOKEN_ENCRYPTION_KEY
    );
  }

  const connection = await prisma.metaConnection.findUnique({ where: { id: connectionId } });
  if (!connection?.tokenCiphertext || !connection.tokenIv || !connection.tokenAuthTag || !connection.tokenKeyVersion) {
    throw new Error("Meta connection does not have an encrypted access token.");
  }
  return decryptToken(
    {
      ciphertext: connection.tokenCiphertext,
      iv: connection.tokenIv,
      authTag: connection.tokenAuthTag,
      keyVersion: connection.tokenKeyVersion
    },
    env.TOKEN_ENCRYPTION_KEY_BASE64 || env.TOKEN_ENCRYPTION_KEY
  );
}

export function createProvider() {
  return createLiveMetaAdsProviderFromEnv(process.env);
}

export type WorkerCursorScope =
  | "AD_ACCOUNTS"
  | "CAMPAIGNS"
  | "ADSETS"
  | "ADS"
  | "CREATIVES"
  | "INSIGHTS"
  | "PAGES"
  | "INSTAGRAM_ACCOUNTS"
  | "PIXELS"
  | "CUSTOM_AUDIENCES"
  | "REPORT";

export type WorkerErrorJson = {
  message: string;
  retryable: boolean;
  meta?: {
    status: number;
    requestId: string;
    code?: number;
    subcode?: number;
    fbtraceId?: string;
    internalCode: string;
  };
};

export async function markSyncJob(input: {
  organizationId: string;
  idempotencyKey: string;
  status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED";
  progress: number;
  checkpointJson?: unknown;
  resultSummaryJson?: unknown;
  error?: unknown;
  incrementAttempt?: boolean;
}) {
  const data: Prisma.SyncJobUpdateManyMutationInput = {
    status: input.status,
    progress: input.progress
  };
  if (input.status === "RUNNING") data.startedAt = new Date();
  if (input.status === "SUCCEEDED" || input.status === "PARTIAL" || input.status === "FAILED") data.completedAt = new Date();
  if (input.incrementAttempt === true) data.attemptCount = { increment: 1 };
  if (input.checkpointJson !== undefined) data.checkpointJson = toPrismaJson(input.checkpointJson);
  if (input.resultSummaryJson !== undefined) data.resultSummaryJson = toPrismaJson(input.resultSummaryJson);
  if (input.error !== undefined) data.errorJson = toPrismaJson(errorJson(input.error));
  await prisma.syncJob.updateMany({
    where: {
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey
    },
    data
  });
}

export async function saveCursorCheckpoint(input: {
  organizationId: string;
  connectionId?: string;
  adAccountId?: string;
  scope: WorkerCursorScope;
  objectKey: string;
  after?: string;
  since?: Date;
  until?: Date;
  checkpointJson?: unknown;
  completed?: boolean;
}) {
  const data: Prisma.CursorUncheckedCreateInput = {
    organizationId: input.organizationId,
    scope: input.scope,
    objectKey: input.objectKey
  };
  if (input.connectionId !== undefined) data.connectionId = input.connectionId;
  if (input.adAccountId !== undefined) data.adAccountId = input.adAccountId;
  if (input.after !== undefined) data.after = input.after;
  if (input.since !== undefined) data.since = input.since;
  if (input.until !== undefined) data.until = input.until;
  if (input.checkpointJson !== undefined) data.checkpointJson = toPrismaJson(input.checkpointJson);
  if (input.completed === true) data.completedAt = new Date();

  const update: Prisma.CursorUncheckedUpdateInput = {
    after: input.after ?? null,
    completedAt: input.completed === true ? new Date() : null
  };
  if (input.connectionId !== undefined) update.connectionId = input.connectionId;
  if (input.adAccountId !== undefined) update.adAccountId = input.adAccountId;
  if (input.since !== undefined) update.since = input.since;
  if (input.until !== undefined) update.until = input.until;
  if (input.checkpointJson !== undefined) update.checkpointJson = toPrismaJson(input.checkpointJson);

  await prisma.cursor.upsert({
    where: {
      organizationId_scope_objectKey: {
        organizationId: input.organizationId,
        scope: input.scope,
        objectKey: input.objectKey
      }
    },
    create: data,
    update
  });
}

export async function writeMetaApiLog(input: {
  organizationId: string;
  operation: string;
  requestId: string;
  startedAt: number;
  outcome: "SUCCESS" | "FAILED" | "DENIED" | "UNKNOWN";
  error?: unknown;
  rateLimitJson?: unknown;
}) {
  const error = input.error === undefined ? null : errorJson(input.error);
  await prisma.apiRequestLog.create({
    data: {
      organizationId: input.organizationId,
      service: "meta",
      operation: input.operation,
      requestId: input.requestId,
      durationMs: Math.max(0, Date.now() - input.startedAt),
      outcome: input.outcome,
      httpStatus: error?.meta?.status ?? null,
      metaErrorCode: error?.meta?.code ?? null,
      metaErrorSubcode: error?.meta?.subcode ?? null,
      fbtraceId: error?.meta?.fbtraceId ?? null,
      rateLimitJson: input.rateLimitJson === undefined ? Prisma.JsonNull : toPrismaJson(input.rateLimitJson)
    }
  });
}

export async function writeAudit(input: { organizationId: string; actorUserId?: string | undefined; action: string; resourceType: string; resourceId?: string | undefined; outcome: "SUCCESS" | "PARTIAL" | "DENIED" | "FAILED" | "UNKNOWN"; requestId: string; beforeJson?: unknown; afterJson?: unknown; summaryJson?: unknown }) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    organizationId: input.organizationId,
    action: input.action,
    resourceType: input.resourceType,
    outcome: input.outcome,
    requestId: input.requestId
  };
  if (input.actorUserId !== undefined) data.actorUserId = input.actorUserId;
  if (input.resourceId !== undefined) data.resourceId = input.resourceId;
  if (input.beforeJson !== undefined) data.beforeJson = toPrismaJson(input.beforeJson);
  if (input.afterJson !== undefined) data.afterJson = toPrismaJson(input.afterJson);
  if (input.summaryJson !== undefined) data.summaryJson = toPrismaJson(input.summaryJson);
  await prisma.auditLog.create({
    data
  });
}

export function toBigInt(value: string | number | undefined | null): bigint | null {
  if (value === undefined || value === null || value === "") return null;
  return BigInt(String(value));
}

export function asDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return makeJsonSafe(value ?? {}) as Prisma.InputJsonValue;
}

export function toNullablePrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return toPrismaJson(value);
}

export function errorJson(error: unknown): WorkerErrorJson {
  if (error instanceof MetaApiError) {
    const meta: WorkerErrorJson["meta"] = {
      status: error.status,
      requestId: error.requestId,
      internalCode: error.meta.internalCode
    };
    if (error.meta.code !== undefined) meta.code = error.meta.code;
    if (error.meta.subcode !== undefined) meta.subcode = error.meta.subcode;
    if (error.meta.fbtraceId !== undefined) meta.fbtraceId = error.meta.fbtraceId;
    return {
      message: safeErrorMessage(error),
      retryable: error.meta.retryable,
      meta
    };
  }
  const record = typeof error === "object" && error !== null ? error as { retryable?: unknown } : null;
  return {
    message: safeErrorMessage(error),
    retryable: typeof record?.retryable === "boolean" ? record.retryable : false
  };
}

function makeJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(makeJsonSafe).filter((item) => item !== undefined);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, makeJsonSafe(entry)] as const)
        .filter(([, entry]) => entry !== undefined)
    );
  }
  return value;
}
