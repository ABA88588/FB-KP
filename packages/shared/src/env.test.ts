import { describe, expect, it } from "vitest";
import { envReadiness, parseServerEnv } from "./env";

const baseEnv = {
  APP_BASE_URL: "https://app.example.com",
  DATABASE_URL: "postgres://user:pass@localhost:5432/adflow",
  REDIS_URL: "redis://localhost:6379",
  AUTH_SECRET: "a".repeat(32),
  META_OAUTH_REDIRECT_URI: "https://app.example.com/api/meta/oauth/callback"
};

describe("parseServerEnv", () => {
  it("normalizes demo mode, boolean switches, and account allowlists", () => {
    const env = parseServerEnv({
      ...baseEnv,
      META_DEMO_MODE: "false",
      ENABLE_META_WRITES: "true",
      EMERGENCY_READONLY: "false",
      ALLOWED_META_AD_ACCOUNT_IDS: "act_1, act_2, , act_3"
    });

    expect(env.DEMO_MODE).toBe(false);
    expect(env.ENABLE_META_WRITES).toBe(true);
    expect(env.EMERGENCY_READONLY).toBe(false);
    expect(env.ALLOWED_META_AD_ACCOUNT_IDS).toEqual(["act_1", "act_2", "act_3"]);
  });

  it("rejects unversioned Meta Graph API values", () => {
    expect(() => parseServerEnv({ ...baseEnv, META_GRAPH_API_VERSION: "25.0" })).toThrow();
  });
});

describe("envReadiness", () => {
  it("reports Meta and token inputs that require external configuration", () => {
    const readiness = envReadiness({
      META_OAUTH_REDIRECT_URI: baseEnv.META_OAUTH_REDIRECT_URI
    });

    expect(readiness.metaConfigured).toBe(false);
    expect(readiness.tokenEncryptionConfigured).toBe(false);
    expect(readiness.missing).toEqual(["META_APP_ID", "META_APP_SECRET", "TOKEN_ENCRYPTION_KEY"]);
  });
});
