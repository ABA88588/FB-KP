import { NextResponse, type NextRequest } from "next/server";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { loadServerEnv } from "@/lib/server-env";
import { consumeMetaOAuthCallback } from "@/lib/meta-oauth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requestId = createRequestId("oauth");
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, status: "unconfigured", missing: loaded.missing }, { status: 503 });
  }

  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return redirectToOnboarding(loaded.env.APP_BASE_URL, "oauth_denied");
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ ok: false, status: "missing_oauth_code" }, { status: 400 });
  }
  if (!state) {
    return NextResponse.json({ ok: false, status: "missing_oauth_state" }, { status: 400 });
  }

  try {
    const result = await consumeMetaOAuthCallback({ env: loaded.env, code, state, requestId });
    const nextUrl = new URL(result.returnTo || "/onboarding/meta", loaded.env.APP_BASE_URL);
    nextUrl.searchParams.set("status", "oauth_connected");
    nextUrl.searchParams.set("accounts", String(result.adAccountCount));
    return NextResponse.redirect(nextUrl);
  } catch (cause) {
    const nextUrl = new URL("/onboarding/meta", loaded.env.APP_BASE_URL);
    nextUrl.searchParams.set("status", "oauth_failed");
    nextUrl.searchParams.set("requestId", requestId);
    nextUrl.searchParams.set("message", safeErrorMessage(cause));
    return NextResponse.redirect(nextUrl);
  }
}

function redirectToOnboarding(baseUrl: string, status: string): NextResponse {
  const nextUrl = new URL("/onboarding/meta", baseUrl);
  nextUrl.searchParams.set("status", status);
  return NextResponse.redirect(nextUrl);
}
