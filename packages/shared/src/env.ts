import { z } from "zod";

export type EnvInput = Record<string, string | boolean | undefined>;

function blankToUndefined(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function booleanEnv(defaultValue: boolean) {
  return z
    .preprocess((value) => blankToUndefined(value) ?? defaultValue, z.union([z.boolean(), z.string()]))
    .transform((value, context) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const normalized = value.toLowerCase().trim();
        if (["1", "true", "yes", "on"].includes(normalized)) return true;
        if (["0", "false", "no", "off"].includes(normalized)) return false;
      }
      context.addIssue({ code: "custom", message: "Expected a boolean-like value" });
      return false;
    });
}

const optionalString = z.preprocess(blankToUndefined, z.string().min(1).optional());
const stringEnv = optionalString.transform((value) => value ?? "");
const urlEnv = z.preprocess(blankToUndefined, z.string().url().optional()).transform((value) => value ?? "");

const optionalCsv = z
  .preprocess(blankToUndefined, z.string().optional())
  .transform((value) => value?.split(",").map((item) => item.trim()).filter(Boolean) ?? []);

const graphApiVersion = z.preprocess(
  (value) => blankToUndefined(value) ?? "v25.0",
  z.string().regex(/^v\d+\.\d+$/, "Expected a Meta Graph API version like v25.0")
);

const optionalIsoDate = optionalString
  .refine((value) => value === undefined || !Number.isNaN(Date.parse(value)), {
    message: "Expected an ISO date string"
  })
  .transform((value) => value ?? "");

const optionalAes256GcmKey = optionalString
  .refine((value) => value === undefined || decodeBase64Length(value) === 32, {
    message: "Expected base64 for exactly 32 bytes"
  })
  .transform((value) => value ?? "");

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: urlEnv.default("http://localhost:3000"),
  DATABASE_URL: stringEnv,
  REDIS_URL: stringEnv,
  AUTH_SECRET: stringEnv.refine((value) => value.length === 0 || value.length >= 32, {
    message: "AUTH_SECRET must be at least 32 characters"
  }),
  TOKEN_ENCRYPTION_KEY: optionalAes256GcmKey,
  TOKEN_ENCRYPTION_KEY_BASE64: optionalAes256GcmKey,
  META_APP_ID: stringEnv,
  META_APP_SECRET: stringEnv,
  META_GRAPH_API_VERSION: graphApiVersion,
  META_OAUTH_REDIRECT_URI: urlEnv,
  ENABLE_META_WRITES: booleanEnv(false),
  EMERGENCY_READONLY: booleanEnv(false),
  DEMO_MODE: booleanEnv(true),
  META_DEMO_MODE: booleanEnv(true).optional(),
  ALLOWED_META_AD_ACCOUNT_IDS: optionalCsv,
  WORKER_HEARTBEAT_ISO: optionalIsoDate
});

export const requiredServerEnvSchema = serverEnvSchema.superRefine((env, context) => {
  requireEnv(context, env.DATABASE_URL, "DATABASE_URL");
  requireEnv(context, env.REDIS_URL, "REDIS_URL");
  requireEnv(context, env.AUTH_SECRET, "AUTH_SECRET");
  requireEnv(context, env.TOKEN_ENCRYPTION_KEY_BASE64 ?? env.TOKEN_ENCRYPTION_KEY, "TOKEN_ENCRYPTION_KEY");

  if (!env.DEMO_MODE) {
    requireEnv(context, env.META_APP_ID, "META_APP_ID");
    requireEnv(context, env.META_APP_SECRET, "META_APP_SECRET");
    requireEnv(context, env.META_OAUTH_REDIRECT_URI, "META_OAUTH_REDIRECT_URI");
  }
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export type EnvReadiness = {
  databaseConfigured: boolean;
  redisConfigured: boolean;
  authConfigured: boolean;
  metaConfigured: boolean;
  tokenEncryptionConfigured: boolean;
  workerConfigured: boolean;
  demoMode: boolean;
  writesEnabled: boolean;
  emergencyReadonly: boolean;
  missing: readonly string[];
};

export function normalizeServerEnvInput(input: EnvInput): EnvInput {
  return {
    ...input,
    DEMO_MODE: input.DEMO_MODE ?? input.META_DEMO_MODE ?? "true",
    TOKEN_ENCRYPTION_KEY_BASE64: input.TOKEN_ENCRYPTION_KEY_BASE64 ?? input.TOKEN_ENCRYPTION_KEY
  };
}

export function parseServerEnv(input: EnvInput): ServerEnv {
  return serverEnvSchema.parse(normalizeServerEnvInput(input));
}

export function parseRequiredServerEnv(input: EnvInput): ServerEnv {
  return requiredServerEnvSchema.parse(normalizeServerEnvInput(input));
}

export function safeParseServerEnv(input: EnvInput): ReturnType<typeof serverEnvSchema.safeParse> {
  return serverEnvSchema.safeParse(normalizeServerEnvInput(input));
}

export function envReadiness(env: Partial<ServerEnv>): EnvReadiness {
  const missing: string[] = [];
  if (!env.META_APP_ID) missing.push("META_APP_ID");
  if (!env.META_APP_SECRET) missing.push("META_APP_SECRET");
  if (!env.META_OAUTH_REDIRECT_URI) missing.push("META_OAUTH_REDIRECT_URI");
  if (!env.TOKEN_ENCRYPTION_KEY_BASE64 && !env.TOKEN_ENCRYPTION_KEY) missing.push("TOKEN_ENCRYPTION_KEY");

  return {
    databaseConfigured: Boolean(env.DATABASE_URL),
    redisConfigured: Boolean(env.REDIS_URL),
    authConfigured: Boolean(env.AUTH_SECRET),
    metaConfigured: Boolean(env.META_APP_ID && env.META_APP_SECRET && env.META_OAUTH_REDIRECT_URI),
    tokenEncryptionConfigured: Boolean(env.TOKEN_ENCRYPTION_KEY_BASE64 ?? env.TOKEN_ENCRYPTION_KEY),
    workerConfigured: Boolean(env.WORKER_HEARTBEAT_ISO),
    demoMode: env.DEMO_MODE ?? true,
    writesEnabled: env.ENABLE_META_WRITES ?? false,
    emergencyReadonly: env.EMERGENCY_READONLY ?? false,
    missing
  };
}

function requireEnv(context: z.RefinementCtx, value: string | undefined, path: string): void {
  if (value) return;
  context.addIssue({
    code: "custom",
    message: `${path} is required`,
    path: [path]
  });
}

function decodeBase64Length(value: string): number | null {
  try {
    return atob(value).length;
  } catch {
    return null;
  }
}
