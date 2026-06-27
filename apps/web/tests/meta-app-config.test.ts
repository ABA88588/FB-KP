import { describe, expect, it } from "vitest";
import { normalizeGraphApiVersion } from "../lib/graph-api-version";
import { maskMetaAppId, metaAppConfigAuditSnapshot, sanitizeAllowedAdAccountIds } from "../lib/meta-app-config";

describe("Meta App config helpers", () => {
  it("normalizes supported Graph API versions", () => {
    expect(normalizeGraphApiVersion("v25.0")).toBe("v25.0");
    expect(normalizeGraphApiVersion("25.0")).toBe("v25.0");
    expect(normalizeGraphApiVersion(" v24.0 ")).toBe("v24.0");
    expect(normalizeGraphApiVersion("24.0")).toBe("v24.0");
    expect(normalizeGraphApiVersion("v20.0")).toBe("v20.0");
    expect(normalizeGraphApiVersion("abc")).toBeNull();
    expect(normalizeGraphApiVersion("v19.0")).toBeNull();
  });

  it("masks app ids without exposing the full value", () => {
    expect(maskMetaAppId("123456789012345")).toBe("1234...2345");
    expect(maskMetaAppId("12345678")).toBe("12345678");
  });

  it("normalizes allowed ad account ids from CSV or array input", () => {
    expect(sanitizeAllowedAdAccountIds("act_1, act_2\nact_1, , act_3")).toEqual(["act_1", "act_2", "act_3"]);
    expect(sanitizeAllowedAdAccountIds([" act_4 ", "act_4", "act_5"])).toEqual(["act_4", "act_5"]);
  });

  it("keeps encrypted secret material out of audit snapshots", () => {
    const snapshot = metaAppConfigAuditSnapshot({
      metaAppId: "123456789012345",
      graphApiVersion: "v25.0",
      oauthRedirectUri: "https://app.example.com/api/meta/oauth/callback",
      enableMetaWrites: false,
      emergencyReadOnly: true,
      allowedAdAccountIds: ["act_1"],
      encryptedMetaAppSecret: {
        ciphertext: "cipher",
        iv: "iv",
        authTag: "tag",
        keyVersion: "v1"
      },
      updatedByUserId: "user_1",
      updatedAt: "2026-06-27T00:00:00.000Z"
    });

    expect(snapshot).toMatchObject({
      metaAppIdMasked: "1234...2345",
      secretConfigured: true
    });
    expect(snapshot).not.toHaveProperty("encryptedMetaAppSecret");
    expect(snapshot).not.toHaveProperty("metaAppSecret");
  });
});
