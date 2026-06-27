import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@adflow/db";
import { MetaHttpClient } from "@adflow/meta-client";
import { createRequestId, encryptToken, redactSensitiveText, type ServerEnv } from "@adflow/shared";
import { buildMetaOAuthUrl, metaOAuthScopes } from "./meta-oauth";
import { applyMetaAppConfigToEnv, loadMetaAppConfigForServer } from "./meta-app-config";
import { toPrismaJson } from "./prisma-json";

const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional()
}).passthrough();

const businessesResponseSchema = z.object({
  data: z.array(z.object({ id: z.string(), name: z.string().optional() }).passthrough()).default([])
}).passthrough();

export type OAuthStartInput = {
  env: ServerEnv;
  userId: string;
  organizationId: string;
  returnTo?: string;
};

export async function createPersistentOAuthStart(input: OAuthStartInput): Promise<URL> {
  const metaConfig = await loadMetaAppConfigForServer(input.organizationId, input.env);
  const effectiveEnv = applyMetaAppConfigToEnv(input.env, metaConfig);
  const state = randomBytes(24).toString("base64url");
  await prisma.oAuthState.create({
    data: {
      stateHash: hashState(state),
      intent: "meta_connect",
      returnTo: sanitizeReturnTo(input.returnTo),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      organizationId: input.organizationId,
      userId: input.userId
    }
  });
  return buildMetaOAuthUrl(effectiveEnv, state);
}

export async function consumeMetaOAuthCallback(input: { env: ServerEnv; code: string; state: string; requestId?: string }) {
  const requestId = input.requestId ?? createRequestId("oauth");
  const stateHash = hashState(input.state);
  const oauthState = await prisma.$transaction(async (tx) => {
    const existing = await tx.oAuthState.findUnique({ where: { stateHash } });
    if (!existing || existing.consumedAt || existing.expiresAt <= new Date()) return null;
    await tx.oAuthState.update({ where: { id: existing.id }, data: { consumedAt: new Date() } });
    return existing;
  });
  if (!oauthState) {
    throw new Error("Invalid or expired OAuth state.");
  }

  const metaConfig = await loadMetaAppConfigForServer(oauthState.organizationId, input.env);
  const effectiveEnv = applyMetaAppConfigToEnv(input.env, metaConfig);
  const shortToken = await exchangeCodeForToken(effectiveEnv, input.code, requestId);
  const longToken = await exchangeForLongLivedToken(effectiveEnv, shortToken.access_token, requestId);
  const accessToken = longToken.access_token;
  const expiresAt = longToken.expires_in ? new Date(Date.now() + longToken.expires_in * 1000) : null;
  const encrypted = await encryptToken(accessToken, effectiveEnv.TOKEN_ENCRYPTION_KEY_BASE64 || effectiveEnv.TOKEN_ENCRYPTION_KEY);
  const client = new MetaHttpClient({
    appSecret: effectiveEnv.META_APP_SECRET,
    graphApiVersion: effectiveEnv.META_GRAPH_API_VERSION
  });
  const me = await client.get({ accessToken, requestId }, "/me", { fields: "id,name" }, z.object({ id: z.string(), name: z.string().optional() }).passthrough());
  const businesses = await client.get({ accessToken, requestId }, "/me/businesses", { fields: "id,name", limit: 50 }, businessesResponseSchema).catch(() => ({ data: [] }));
  const businessIds = businesses.data.map((business) => business.id);
  const adAccounts = await client.getPaged({ accessToken, requestId }, "/me/adaccounts", {
    fields: "id,account_id,name,currency,timezone_name,account_status,disable_reason,business",
    limit: 50
  }, z.object({
    id: z.string(),
    account_id: z.string().optional(),
    name: z.string().optional(),
    currency: z.string().optional(),
    timezone_name: z.string().optional(),
    account_status: z.union([z.string(), z.number()]).optional(),
    disable_reason: z.union([z.string(), z.number()]).optional(),
    business: z.object({ id: z.string().optional() }).passthrough().optional()
  }).passthrough());

  const existingConnection = await prisma.metaConnection.findFirst({
    where: {
      organizationId: oauthState.organizationId,
      metaUserId: me.id
    },
    orderBy: { updatedAt: "desc" }
  });
  const connectionData = {
    mode: "LIVE" as const,
    status: "HEALTHY" as const,
    metaUserId: me.id,
    metaBusinessIds: toPrismaJson(businessIds),
    scopes: [...metaOAuthScopes],
    tokenCiphertext: encrypted.ciphertext,
    tokenIv: encrypted.iv,
    tokenAuthTag: encrypted.authTag,
    tokenKeyVersion: encrypted.keyVersion,
    tokenExpiresAt: expiresAt,
    lastValidatedAt: new Date(),
    revokedAt: null,
    lastErrorCode: null,
    lastErrorSummary: null
  };
  const connection = existingConnection
    ? await prisma.metaConnection.update({
      where: { id: existingConnection.id },
      data: connectionData
    })
    : await prisma.metaConnection.create({
      data: {
        ...connectionData,
        organizationId: oauthState.organizationId
      }
    });

  await prisma.encryptedToken.upsert({
    where: {
      organizationId_connectionId_type_subjectMetaId: {
        organizationId: oauthState.organizationId,
        connectionId: connection.id,
        type: "META_USER",
        subjectMetaId: me.id
      }
    },
    create: {
      type: "META_USER",
      subjectMetaId: me.id,
      scopes: [...metaOAuthScopes],
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      expiresAt,
      organizationId: oauthState.organizationId,
      connectionId: connection.id
    },
    update: {
      scopes: [...metaOAuthScopes],
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      expiresAt,
      revokedAt: null
    }
  });

  for (const [index, account] of adAccounts.entries()) {
    await prisma.adAccount.upsert({
      where: { organizationId_metaId: { organizationId: oauthState.organizationId, metaId: account.id } },
      create: {
        metaId: account.id,
        accountId: account.account_id ?? account.id.replace(/^act_/, ""),
        name: account.name ?? account.id,
        status: String(account.account_status ?? "UNKNOWN"),
        disableReason: account.disable_reason === undefined ? null : String(account.disable_reason),
        currency: account.currency ?? "USD",
        timezoneName: account.timezone_name ?? "UTC",
        businessMetaId: account.business?.id ?? null,
        dataSource: "LIVE",
        isSelected: index === 0,
        isReadOnly: String(account.account_status ?? "") !== "1",
        rawJson: toPrismaJson(account),
        sourceLastSeenAt: new Date(),
        organizationId: oauthState.organizationId,
        connectionId: connection.id
      },
      update: {
        name: account.name ?? account.id,
        status: String(account.account_status ?? "UNKNOWN"),
        disableReason: account.disable_reason === undefined ? null : String(account.disable_reason),
        currency: account.currency ?? "USD",
        timezoneName: account.timezone_name ?? "UTC",
        businessMetaId: account.business?.id ?? null,
        dataSource: "LIVE",
        rawJson: toPrismaJson(account),
        sourceLastSeenAt: new Date(),
        connectionId: connection.id
      }
    });
  }

  if (adAccounts.length > 0) {
    const firstAdAccount = adAccounts[0];
    const selectedAccount = await prisma.adAccount.findFirst({
      where: { organizationId: oauthState.organizationId, isSelected: true }
    });
    if (!selectedAccount && firstAdAccount) {
      await prisma.adAccount.update({
        where: { organizationId_metaId: { organizationId: oauthState.organizationId, metaId: firstAdAccount.id } },
        data: { isSelected: true }
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "meta.oauth.connected",
      resourceType: "MetaConnection",
      resourceId: connection.id,
      metaIdMasked: maskMetaId(me.id),
      outcome: "SUCCESS",
      requestId,
      summaryJson: toPrismaJson({ adAccountCount: adAccounts.length, businessCount: businesses.data.length }),
      organizationId: oauthState.organizationId,
      actorUserId: oauthState.userId
    }
  });

  return { connectionId: connection.id, adAccountCount: adAccounts.length, returnTo: oauthState.returnTo };
}

async function exchangeCodeForToken(env: ServerEnv, code: string, requestId: string) {
  return fetchToken(env, {
    client_id: env.META_APP_ID,
    redirect_uri: env.META_OAUTH_REDIRECT_URI,
    client_secret: env.META_APP_SECRET,
    code
  }, requestId);
}

async function exchangeForLongLivedToken(env: ServerEnv, accessToken: string, requestId: string) {
  return fetchToken(env, {
    grant_type: "fb_exchange_token",
    client_id: env.META_APP_ID,
    client_secret: env.META_APP_SECRET,
    fb_exchange_token: accessToken
  }, requestId);
}

async function fetchToken(env: ServerEnv, params: Record<string, string>, requestId: string) {
  const response = await fetch(graphUrl(env, "/oauth/access_token"), {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-adflow-request-id": requestId
    },
    body: new URLSearchParams(params)
  });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) throw new Error(redactSensitiveText(`Meta token exchange failed (${response.status}): ${extractMetaErrorMessage(payload)}`));
  return tokenResponseSchema.parse(payload);
}

function graphUrl(env: ServerEnv, path: string): URL {
  return new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}${path}`);
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function sanitizeReturnTo(returnTo: string | undefined): string {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return "/settings/connections";
  return returnTo;
}

function extractMetaErrorMessage(payload: unknown): string {
  const parsed = z.object({
    error: z.object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.union([z.string(), z.number()]).optional()
    }).passthrough().optional()
  }).passthrough().safeParse(payload);
  if (!parsed.success || !parsed.data.error) return "request failed";
  const details = [
    parsed.data.error.message,
    parsed.data.error.type,
    parsed.data.error.code === undefined ? undefined : `code ${parsed.data.error.code}`
  ].filter(Boolean);
  return details.join(" / ") || "request failed";
}

function maskMetaId(value: string): string {
  if (value.length <= 6) return value;
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
