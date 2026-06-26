import { Prisma, prisma } from "@adflow/db";
import { createLiveMetaAdsProviderFromEnv } from "@adflow/meta-client";
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

export async function markSyncJob(input: { organizationId: string; idempotencyKey: string; status: "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED"; progress: number; resultSummaryJson?: unknown; error?: unknown }) {
  const data: Prisma.SyncJobUpdateManyMutationInput = {
    status: input.status,
    progress: input.progress
  };
  if (input.status === "RUNNING") data.startedAt = new Date();
  if (input.status === "SUCCEEDED" || input.status === "PARTIAL" || input.status === "FAILED") data.completedAt = new Date();
  if (input.resultSummaryJson !== undefined) data.resultSummaryJson = toPrismaJson(input.resultSummaryJson);
  if (input.error !== undefined) data.errorJson = { message: safeErrorMessage(input.error) };
  await prisma.syncJob.updateMany({
    where: {
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey
    },
    data
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
