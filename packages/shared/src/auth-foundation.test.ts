import { describe, expect, it } from "vitest";
import { evaluateMetaWriteGate, hasPermission } from "./authz";
import { decryptToken, encodeBase64, encryptToken } from "./crypto";
import { envReadiness, parseRequiredServerEnv, parseServerEnv } from "./env";

const dummyAesKey = encodeBase64(new Uint8Array(32).fill(7));

describe("role permissions", () => {
  it("maps product roles to explicit actions", () => {
    expect(hasPermission("OWNER", "org:manage")).toBe(true);
    expect(hasPermission("ADMIN", "connection:write")).toBe(true);
    expect(hasPermission("ADMIN", "member:write")).toBe(false);
    expect(hasPermission("OPERATOR", "ads:write")).toBe(true);
    expect(hasPermission("ANALYST", "ads:write")).toBe(false);
    expect(hasPermission("ANALYST", "reports:export")).toBe(true);
    expect(hasPermission("VIEWER", "reports:export")).toBe(false);
  });
});

describe("Meta write gate", () => {
  it("allows writes only when every guard passes", () => {
    const result = evaluateMetaWriteGate(
      {
        enableMetaWrites: true,
        emergencyReadonly: false,
        role: "OPERATOR",
        scopes: ["ads_read", "ads_management"],
        adAccountMetaId: "act_123",
        allowedMetaAdAccountIds: ["act_123"],
        accountReadOnly: false,
        connectionHealthy: true
      },
      "op_test"
    );

    expect(result).toEqual({ allowed: true, operationId: "op_test", reasons: [] });
  });

  it("reports each blocking reason independently", () => {
    const result = evaluateMetaWriteGate({
      enableMetaWrites: false,
      emergencyReadonly: true,
      role: "VIEWER",
      scopes: ["ads_read"],
      adAccountMetaId: "act_123",
      allowedMetaAdAccountIds: [],
      accountReadOnly: true,
      connectionHealthy: false
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toEqual([
      "ENABLE_META_WRITES=false",
      "EMERGENCY_READONLY=true",
      "ROLE_LACKS_ADS_WRITE",
      "MISSING_ADS_MANAGEMENT_SCOPE",
      "AD_ACCOUNT_ALLOWLIST_EMPTY",
      "AD_ACCOUNT_READONLY",
      "CONNECTION_NOT_HEALTHY"
    ]);
  });
});

describe("server env", () => {
  it("normalizes booleans, CSV allowlists, and demo mode aliases", () => {
    const env = parseServerEnv({
      META_DEMO_MODE: "false",
      ENABLE_META_WRITES: "1",
      EMERGENCY_READONLY: "off",
      ALLOWED_META_AD_ACCOUNT_IDS: "act_1, act_2",
      TOKEN_ENCRYPTION_KEY_BASE64: dummyAesKey
    });

    expect(env.DEMO_MODE).toBe(false);
    expect(env.ENABLE_META_WRITES).toBe(true);
    expect(env.EMERGENCY_READONLY).toBe(false);
    expect(env.ALLOWED_META_AD_ACCOUNT_IDS).toEqual(["act_1", "act_2"]);
  });

  it("separates readiness from strict startup requirements", () => {
    const env = parseServerEnv({});
    const readiness = envReadiness(env);

    expect(readiness.demoMode).toBe(true);
    expect(readiness.databaseConfigured).toBe(false);
    expect(() => parseRequiredServerEnv({ NODE_ENV: "production", AUTH_SECRET: "short" })).toThrow();
  });
});

describe("AES-256-GCM token encryption", () => {
  it("round trips without storing plaintext", async () => {
    const encrypted = await encryptToken("demo-access-token", dummyAesKey, "test-key");

    expect(encrypted.keyVersion).toBe("test-key");
    expect(encrypted.ciphertext).not.toContain("demo-access-token");
    await expect(decryptToken(encrypted, dummyAesKey)).resolves.toBe("demo-access-token");
  });

  it("fails when the auth tag is tampered", async () => {
    const encrypted = await encryptToken("demo-access-token", dummyAesKey);
    const tampered = { ...encrypted, authTag: encodeBase64(new Uint8Array(16)) };

    await expect(decryptToken(tampered, dummyAesKey)).rejects.toThrow();
  });
});
