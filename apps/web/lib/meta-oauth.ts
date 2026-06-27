import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { ServerEnv } from "@adflow/shared";

export const metaOAuthCookieName = "adflow_meta_oauth_state";
export const metaOAuthScopes = ["ads_read", "ads_management", "business_management", "pages_read_engagement", "instagram_basic"] as const;

export function createOAuthState(authSecret: string): { state: string; cookieValue: string } {
  const state = randomBytes(24).toString("base64url");
  return { state, cookieValue: `${state}.${signState(state, authSecret)}` };
}

export function verifyOAuthState(state: string | null, cookieValue: string | undefined, authSecret: string): boolean {
  if (!state || !cookieValue) return false;
  const [cookieState, signature] = cookieValue.split(".");
  if (!cookieState || !signature || cookieState !== state) return false;
  const expected = signState(state, authSecret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

export function buildMetaOAuthUrl(env: ServerEnv, state: string): URL {
  const url = new URL(`https://www.facebook.com/${env.META_GRAPH_API_VERSION}/dialog/oauth`);
  url.searchParams.set("client_id", env.META_APP_ID);
  url.searchParams.set("redirect_uri", env.META_OAUTH_REDIRECT_URI);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", metaOAuthScopes.join(","));
  return url;
}

function signState(state: string, authSecret: string): string {
  return createHmac("sha256", authSecret).update(state).digest("base64url");
}
