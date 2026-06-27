import { z } from "zod";
import { prisma, Prisma } from "@adflow/db";
import { decryptSecret, encryptSecret, type ServerEnv } from "@adflow/shared";
import { appPath } from "./app-paths";
import { toPrismaJson } from "./prisma-json";

export type MetaAppConfigSource = "database" | "environment" | "unconfigured";

export type MetaAppConfigStatus = {
  organizationId: string;
  source: MetaAppConfigSource;
  configured: boolean;
  metaAppId: string;
  metaAppIdMasked: string;
  graphApiVersion: string;
  oauthRedirectUri: string;
  enableMetaWrites: boolean;
  emergencyReadOnly: boolean;
  allowedAdAccountIds: string[];
  secretConfigured: boolean;
  updatedAt: string | null;
  updatedByUserId: string | null;
  missing: string[];
};

export type LoadedMetaAppConfig = {
  organizationId: string;
  source: Exclude<MetaAppConfigSource, "unconfigured">;
  metaAppId: string;
  metaAppSecret: string;
  graphApiVersion: string;
  oauthRedirectUri: string;
  enableMetaWrites: boolean;
  emergencyReadOnly: boolean;
  allowedAdAccountIds: string[];
};

export class MetaAppConfigError extends Error {
  readonly code: "META_APP_UNCONFIGURED" | "TOKEN_ENCRYPTION_KEY_MISSING" | "META_APP_SECRET_INVALID";
  readonly missing: string[];

  constructor(code: MetaAppConfigError["code"], message: string, missing: string[] = []) {
    super(message);
    this.name = "MetaAppConfigError";
    this.code = code;
    this.missing = missing;
  }
}

const encryptedSecretSchema = z.object({
  ciphertext: z.string().min(1),
  iv: z.string().min(1),
  authTag: z.string().min(1),
  keyVersion: z.string().min(1)
});

export async function getMetaAppConfigStatus(organizationId: string, env: ServerEnv): Promise<MetaAppConfigStatus> {
  const record = await prisma.metaAppConfig.findUnique({ where: { organizationId } });
  if (record) {
    const secretConfigured = encryptedSecretSchema.safeParse(record.encryptedMetaAppSecret).success;
    const missing = configMissing({
      metaAppId: record.metaAppId,
      metaAppSecret: secretConfigured ? "configured" : "",
      oauthRedirectUri: record.oauthRedirectUri
    });
    return {
      organizationId,
      source: "database",
      configured: missing.length === 0,
      metaAppId: record.metaAppId,
      metaAppIdMasked: maskMetaAppId(record.metaAppId),
      graphApiVersion: record.graphApiVersion,
      oauthRedirectUri: record.oauthRedirectUri,
      enableMetaWrites: record.enableMetaWrites,
      emergencyReadOnly: record.emergencyReadOnly,
      allowedAdAccountIds: record.allowedAdAccountIds,
      secretConfigured,
      updatedAt: record.updatedAt.toISOString(),
      updatedByUserId: record.updatedByUserId,
      missing
    };
  }

  const missing = configMissing({
    metaAppId: env.META_APP_ID,
    metaAppSecret: env.META_APP_SECRET,
    oauthRedirectUri: env.META_OAUTH_REDIRECT_URI
  });
  const metaAppId = env.META_APP_ID;
  return {
    organizationId,
    source: missing.length === 0 ? "environment" : "unconfigured",
    configured: missing.length === 0,
    metaAppId,
    metaAppIdMasked: maskMetaAppId(metaAppId),
    graphApiVersion: env.META_GRAPH_API_VERSION,
    oauthRedirectUri: env.META_OAUTH_REDIRECT_URI || defaultOAuthRedirectUri(env),
    enableMetaWrites: env.ENABLE_META_WRITES,
    emergencyReadOnly: env.EMERGENCY_READONLY,
    allowedAdAccountIds: env.ALLOWED_META_AD_ACCOUNT_IDS,
    secretConfigured: Boolean(env.META_APP_SECRET),
    updatedAt: null,
    updatedByUserId: null,
    missing
  };
}

export async function loadMetaAppConfigForServer(organizationId: string, env: ServerEnv): Promise<LoadedMetaAppConfig> {
  const record = await prisma.metaAppConfig.findUnique({ where: { organizationId } });
  if (record) {
    const encrypted = encryptedSecretSchema.safeParse(record.encryptedMetaAppSecret);
    if (!encrypted.success) {
      throw new MetaAppConfigError("META_APP_UNCONFIGURED", "Meta App Secret is not configured for this organization.", ["META_APP_SECRET"]);
    }
    const key = tokenEncryptionKey(env);
    const metaAppSecret = await decryptSecret(encrypted.data, key).catch(() => {
      throw new MetaAppConfigError("META_APP_SECRET_INVALID", "Stored Meta App Secret could not be decrypted.", ["META_APP_SECRET"]);
    });
    const loaded = {
      organizationId,
      source: "database" as const,
      metaAppId: record.metaAppId,
      metaAppSecret,
      graphApiVersion: record.graphApiVersion,
      oauthRedirectUri: record.oauthRedirectUri,
      enableMetaWrites: record.enableMetaWrites,
      emergencyReadOnly: record.emergencyReadOnly,
      allowedAdAccountIds: record.allowedAdAccountIds
    };
    assertConfigured(loaded);
    return loaded;
  }

  const loaded = {
    organizationId,
    source: "environment" as const,
    metaAppId: env.META_APP_ID,
    metaAppSecret: env.META_APP_SECRET,
    graphApiVersion: env.META_GRAPH_API_VERSION,
    oauthRedirectUri: env.META_OAUTH_REDIRECT_URI,
    enableMetaWrites: env.ENABLE_META_WRITES,
    emergencyReadOnly: env.EMERGENCY_READONLY,
    allowedAdAccountIds: env.ALLOWED_META_AD_ACCOUNT_IDS
  };
  assertConfigured(loaded);
  return loaded;
}

export async function encryptMetaAppSecret(metaAppSecret: string, env: ServerEnv): Promise<Prisma.InputJsonValue> {
  const encrypted = await encryptSecret(metaAppSecret, tokenEncryptionKey(env));
  return toPrismaJson(encrypted);
}

export function applyMetaAppConfigToEnv(env: ServerEnv, config: LoadedMetaAppConfig): ServerEnv {
  return {
    ...env,
    META_APP_ID: config.metaAppId,
    META_APP_SECRET: config.metaAppSecret,
    META_GRAPH_API_VERSION: config.graphApiVersion,
    META_OAUTH_REDIRECT_URI: config.oauthRedirectUri,
    ENABLE_META_WRITES: config.enableMetaWrites,
    EMERGENCY_READONLY: config.emergencyReadOnly,
    ALLOWED_META_AD_ACCOUNT_IDS: config.allowedAdAccountIds
  };
}

export function sanitizeAllowedAdAccountIds(value: unknown): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,]/)
      : [];
  return Array.from(
    new Set(
      items
        .map((item) => String(item).trim())
        .filter(Boolean)
    )
  );
}

export function maskMetaAppId(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function metaAppConfigAuditSnapshot(input: {
  metaAppId: string;
  graphApiVersion: string;
  oauthRedirectUri: string;
  enableMetaWrites: boolean;
  emergencyReadOnly: boolean;
  allowedAdAccountIds: string[];
  encryptedMetaAppSecret?: Prisma.JsonValue | null;
  updatedByUserId?: string | null;
  updatedAt?: Date | string | null;
}): Record<string, unknown> {
  return {
    metaAppIdMasked: maskMetaAppId(input.metaAppId),
    graphApiVersion: input.graphApiVersion,
    oauthRedirectUri: input.oauthRedirectUri,
    enableMetaWrites: input.enableMetaWrites,
    emergencyReadOnly: input.emergencyReadOnly,
    allowedAdAccountIds: input.allowedAdAccountIds,
    secretConfigured: encryptedSecretSchema.safeParse(input.encryptedMetaAppSecret).success,
    updatedByUserId: input.updatedByUserId ?? null,
    updatedAt: input.updatedAt instanceof Date ? input.updatedAt.toISOString() : (input.updatedAt ?? null)
  };
}

export function defaultOAuthRedirectUri(env: ServerEnv): string {
  if (!env.APP_BASE_URL) return "";
  return new URL(appPath("/api/meta/oauth/callback"), env.APP_BASE_URL).toString();
}

function tokenEncryptionKey(env: ServerEnv): string {
  const key = env.TOKEN_ENCRYPTION_KEY_BASE64 || env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new MetaAppConfigError("TOKEN_ENCRYPTION_KEY_MISSING", "TOKEN_ENCRYPTION_KEY is required for Meta App Secret encryption.", ["TOKEN_ENCRYPTION_KEY"]);
  }
  return key;
}

function assertConfigured(config: LoadedMetaAppConfig): void {
  const missing = configMissing(config);
  if (missing.length > 0) {
    throw new MetaAppConfigError("META_APP_UNCONFIGURED", `Meta App configuration is incomplete: ${missing.join(", ")}`, missing);
  }
}

function configMissing(input: { metaAppId: string; metaAppSecret: string; oauthRedirectUri: string }): string[] {
  const missing: string[] = [];
  if (!input.metaAppId) missing.push("META_APP_ID");
  if (!input.metaAppSecret) missing.push("META_APP_SECRET");
  if (!input.oauthRedirectUri) missing.push("META_OAUTH_REDIRECT_URI");
  return missing;
}
