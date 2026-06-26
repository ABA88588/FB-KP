import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@adflow/db";
import { MetaHttpClient } from "@adflow/meta-client";
import { createRequestId, encryptToken, safeErrorMessage, type ServerEnv } from "@adflow/shared";
import { buildMetaOAuthUrl } from "./meta-oauth";
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
  const state = randomBytes(24).toString("base64url");
  await prisma.oAuthState.create({
    data: {
      stateHash: hashState(state),
      intent: "meta_connect",
      returnTo: input.returnTo ?? "/onboarding/meta",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      organizationId: input.organizationId,
      userId: input.userId
    }
  });
  return buildMetaOAuthUrl(input.env, state);
}

export async function consumeMetaOAuthCallback(input: { env: ServerEnv; code: string; state: string; requestId?: string }) {
  const requestId = input.requestId ?? createRequestId("oauth");
  const stateHash = hashState(input.state);
  const oauthState = await prisma.oAuthState.findUnique({ where: { stateHash } });
  if (!oauthState || oauthState.consumedAt || oauthState.expiresAt <= new Date()) {
    throw new Error("Invalid or expired OAuth state.");
  }

  const shortToken = await exchangeCodeForToken(input.env, input.code, requestId);
  const longToken = await exchangeForLongLivedToken(input.env, shortToken.access_token, requestId);
  const accessToken = longToken.access_token;
  const expiresAt = longToken.expires_in ? new Date(Date.now() + longToken.expires_in * 1000) : null;
  const encrypted = await encryptToken(accessToken, input.env.TOKEN_ENCRYPTION_KEY_BASE64 || input.env.TOKEN_ENCRYPTION_KEY);
  const client = new MetaHttpClient({
    appSecret: input.env.META_APP_SECRET,
    graphApiVersion: input.env.META_GRAPH_API_VERSION
  });
  const me = await client.get({ accessToken, requestId }, "/me", { fields: "id,name" }, z.object({ id: z.string(), name: z.string().optional() }).passthrough());
  const businesses = await client.get({ accessToken, requestId }, "/me/businesses", { fields: "id,name", limit: 50 }, businessesResponseSchema).catch(() => ({ data: [] }));
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

  const connection = await prisma.metaConnection.create({
    data: {
      mode: "LIVE",
      status: "HEALTHY",
      metaUserId: me.id,
      metaBusinessIds: businesses.data.map((business) => business.id),
      scopes: ["ads_read", "ads_management", "business_management", "pages_read_engagement", "instagram_basic"],
      tokenCiphertext: encrypted.ciphertext,
      tokenIv: encrypted.iv,
      tokenAuthTag: encrypted.authTag,
      tokenKeyVersion: encrypted.keyVersion,
      tokenExpiresAt: expiresAt,
      lastValidatedAt: new Date(),
      organizationId: oauthState.organizationId
    }
  });

  await prisma.encryptedToken.create({
    data: {
      type: "META_USER",
      subjectMetaId: me.id,
      scopes: ["ads_read", "ads_management", "business_management", "pages_read_engagement", "instagram_basic"],
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyVersion: encrypted.keyVersion,
      expiresAt,
      organizationId: oauthState.organizationId,
      connectionId: connection.id
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

  await prisma.oAuthState.update({ where: { id: oauthState.id }, data: { consumedAt: new Date() } });
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
  const url = graphUrl(env, "/oauth/access_token");
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("redirect_uri", env.META_OAUTH_REDIRECT_URI);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("code", code);
  return fetchToken(url, requestId);
}

async function exchangeForLongLivedToken(env: ServerEnv, accessToken: string, requestId: string) {
  const url = graphUrl(env, "/oauth/access_token");
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("client_secret", env.META_APP_SECRET);
  url.searchParams.set("fb_exchange_token", accessToken);
  return fetchToken(url, requestId);
}

async function fetchToken(url: URL, requestId: string) {
  const response = await fetch(url, { headers: { "x-adflow-request-id": requestId } });
  const payload = (await response.json().catch(() => ({}))) as unknown;
  if (!response.ok) throw new Error(safeErrorMessage(payload));
  return tokenResponseSchema.parse(payload);
}

function graphUrl(env: ServerEnv, path: string): URL {
  return new URL(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}${path}`);
}

function hashState(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}

function maskMetaId(value: string): string {
  if (value.length <= 6) return value;
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}
