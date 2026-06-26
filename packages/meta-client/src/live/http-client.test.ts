import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DEFAULT_META_MUTATION_STATUS, buildMetaMutationGuardInput, evaluateMetaMutationGuard } from "../provider";
import { evaluateBreakdownCompatibility } from "../schemas/version-registry";
import { MetaProviderConfigurationError, normalizeMetaError } from "./errors";
import { MetaHttpClient } from "./http-client";
import { createLiveMetaAdsProviderFromEnv, LiveMetaAdsProvider } from "./live-provider";
import { parseMetaCursorPage } from "./cursor";

describe("MetaHttpClient", () => {
  it("adds appsecret_proof to server-side Graph requests", async () => {
    const fetchImpl = vi.fn((input: string | URL | Request) => {
      const url = toRequestUrl(input);
      expect(url.searchParams.get("access_token")).toBe("token_123");
      expect(url.searchParams.get("appsecret_proof")).toBe(createHmac("sha256", "secret_123").update("token_123").digest("hex"));
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    });
    const client = new MetaHttpClient({
      appSecret: "secret_123",
      graphApiVersion: "v25.0",
      graphBaseUrl: "https://graph.example.test",
      fetchImpl
    });

    await expect(client.get({ accessToken: "token_123" }, "/me", {}, z.object({ ok: z.boolean() }))).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

function toRequestUrl(input: string | URL | Request): URL {
  if (typeof input === "string") return new URL(input);
  if (input instanceof URL) return input;
  return new URL(input.url);
}

describe("LiveMetaAdsProvider", () => {
  it("does not call Meta when a write gate blocks mutation", async () => {
    const fetchImpl = vi.fn();
    const provider = new LiveMetaAdsProvider({
      appId: "app_123",
      appSecret: "secret_123",
      accessToken: "token_123",
      graphApiVersion: "v25.0",
      graphBaseUrl: "https://graph.example.test",
      fetchImpl
    });
    const guard = evaluateMetaMutationGuard({
      enableMetaWrites: false,
      emergencyReadonly: false,
      role: "OPERATOR",
      scopes: ["ads_read", "ads_management"],
      adAccountMetaId: "act_1",
      allowedMetaAdAccountIds: ["act_1"],
      accountReadOnly: false,
      connectionHealthy: true
    }, "op_blocked");

    await expect(provider.createCampaign({}, {
      adAccountMetaId: "act_1",
      name: "Blocked Campaign",
      objective: "OUTCOME_SALES",
      operationId: "op_blocked",
      guard
    })).rejects.toThrow("Meta write denied");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports explicit disabled availability when live env is missing credentials", async () => {
    const fetchImpl = vi.fn();
    const provider = createLiveMetaAdsProviderFromEnv({ META_GRAPH_API_VERSION: "v25.0" }, { fetchImpl });

    expect(provider.getAvailability()).toMatchObject({
      mode: "live",
      configured: false,
      disabled: true,
      status: "unconfigured",
      reason: "MISSING_CREDENTIALS",
      missing: ["META_APP_ID", "META_APP_SECRET", "META_ACCESS_TOKEN"]
    });
    await expect(provider.listAdAccounts({})).rejects.toBeInstanceOf(MetaProviderConfigurationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("defaults creates to PAUSED when the write gate allows mutation", async () => {
    const fetchImpl = vi.fn((_input: string | URL | Request, init?: RequestInit) => {
      const body = init?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      expect((body as URLSearchParams).get("status")).toBe(DEFAULT_META_MUTATION_STATUS);
      return Promise.resolve(new Response(JSON.stringify({ id: "cmp_1" }), { status: 200 }));
    });
    const provider = new LiveMetaAdsProvider({
      appId: "app_123",
      appSecret: "secret_123",
      accessToken: "token_123",
      graphApiVersion: "v25.0",
      graphBaseUrl: "https://graph.example.test",
      fetchImpl
    });
    const guard = evaluateMetaMutationGuard({
      enableMetaWrites: true,
      emergencyReadonly: false,
      role: "OPERATOR",
      scopes: ["ads_management"],
      adAccountMetaId: "act_1",
      allowedMetaAdAccountIds: ["act_1"],
      accountReadOnly: false,
      connectionHealthy: true
    }, "op_allowed");

    await expect(provider.createCampaign({}, {
      adAccountMetaId: "act_1",
      name: "Allowed Campaign",
      objective: "OUTCOME_SALES",
      operationId: "op_allowed",
      guard
    })).resolves.toEqual({ metaId: "cmp_1", operationId: "op_allowed", status: DEFAULT_META_MUTATION_STATUS });
  });
});

describe("parseMetaCursorPage", () => {
  it("keeps only cursors and extracts after from next URL", () => {
    const parsed = parseMetaCursorPage({
      cursors: { before: "before_1", after: "after_1" },
      next: "https://graph.facebook.com/v25.0/act_1/campaigns?after=after_2&access_token=secret"
    });

    expect(parsed).toEqual({
      before: "before_1",
      after: "after_1",
      hasNextPage: true,
      nextAfter: "after_2"
    });
    expect(JSON.stringify(parsed)).not.toContain("secret");
    expect(JSON.stringify(parsed)).not.toContain("graph.facebook.com");
  });
});

describe("normalizeMetaError", () => {
  it("maps Graph token, permission, rate-limit, parameter, and transient errors", () => {
    expect(normalizeMetaError({ error: { message: "expired", code: 190, fbtrace_id: "trace_1" } }, 400)).toMatchObject({
      internalCode: "META_TOKEN_EXPIRED",
      retryable: false,
      fbtraceId: "trace_1"
    });
    expect(normalizeMetaError({ error: { message: "missing permission", code: 200 } }, 403)).toMatchObject({
      internalCode: "META_PERMISSION_DENIED",
      retryable: false
    });
    expect(normalizeMetaError({ error: { message: "too many calls", code: 4, error_subcode: 80004 } }, 429)).toMatchObject({
      internalCode: "META_RATE_LIMITED",
      retryable: true
    });
    expect(normalizeMetaError({ error: { message: "bad field", code: 100 } }, 400)).toMatchObject({
      internalCode: "META_INVALID_PARAMETER",
      retryable: false
    });
    expect(normalizeMetaError({ error: { message: "temporary", is_transient: true } }, 500)).toMatchObject({
      internalCode: "META_TRANSIENT_ERROR",
      retryable: true
    });
  });
});

describe("breakdown compatibility", () => {
  it("allows only registry-backed breakdown and action_breakdown combinations", () => {
    expect(evaluateBreakdownCompatibility({
      breakdowns: ["publisher_platform", "platform_position"],
      actionBreakdowns: ["action_type"]
    }).compatible).toBe(true);

    const platformOnly = evaluateBreakdownCompatibility({ breakdowns: ["platform_position"] });
    expect(platformOnly.compatible).toBe(false);
    expect(platformOnly.reasons).toContain("PLATFORM_POSITION_REQUIRES_PUBLISHER_PLATFORM");

    const productMixed = evaluateBreakdownCompatibility({ breakdowns: ["product_id", "age"] });
    expect(productMixed.compatible).toBe(false);
    expect(productMixed.reasons).toContain("PRODUCT_ID_CANNOT_BE_COMBINED_WITH_OTHER_BREAKDOWNS");
  });
});

describe("Meta mutation guard defaults", () => {
  it("defaults writes to disabled and an empty account allowlist", () => {
    expect(DEFAULT_META_MUTATION_STATUS).toBe("PAUSED");
    expect(buildMetaMutationGuardInput({ adAccountMetaId: "act_1" })).toMatchObject({
      enableMetaWrites: false,
      role: "VIEWER",
      scopes: [],
      allowedMetaAdAccountIds: [],
      accountReadOnly: true,
      connectionHealthy: false
    });

    const blocked = evaluateMetaMutationGuard({ adAccountMetaId: "act_1" }, "op_default_block");
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasons).toContain("ENABLE_META_WRITES=false");
    expect(blocked.reasons).toContain("AD_ACCOUNT_ALLOWLIST_EMPTY");
  });

  it("allows writes only when the target account is allowlisted", () => {
    const denied = evaluateMetaMutationGuard({
      adAccountMetaId: "act_2",
      enableMetaWrites: true,
      role: "OPERATOR",
      scopes: ["ads_management"],
      allowedMetaAdAccountIds: ["act_1"],
      accountReadOnly: false,
      connectionHealthy: true
    }, "op_denied");
    expect(denied.allowed).toBe(false);
    expect(denied.reasons).toContain("AD_ACCOUNT_NOT_ALLOWLISTED");

    const allowed = evaluateMetaMutationGuard({
      adAccountMetaId: "act_1",
      enableMetaWrites: true,
      role: "OPERATOR",
      scopes: ["ads_management"],
      allowedMetaAdAccountIds: ["act_1"],
      accountReadOnly: false,
      connectionHealthy: true
    }, "op_allowed");
    expect(allowed).toMatchObject({ allowed: true, operationId: "op_allowed", reasons: [] });
  });
});
