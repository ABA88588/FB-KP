import { NextResponse, type NextRequest } from "next/server";
import { loadServerEnv } from "@/lib/server-env";
import { metaOAuthCookieName, verifyOAuthState } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
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
  const cookieValue = request.cookies.get(metaOAuthCookieName)?.value;
  if (!verifyOAuthState(state, cookieValue, loaded.env.AUTH_SECRET)) {
    return NextResponse.json({ ok: false, status: "invalid_oauth_state" }, { status: 400 });
  }
  if (!code) {
    return NextResponse.json({ ok: false, status: "missing_oauth_code" }, { status: 400 });
  }

  const response = redirectToOnboarding(loaded.env.APP_BASE_URL, "oauth_code_received");
  response.cookies.delete(metaOAuthCookieName);
  return response;
}

function redirectToOnboarding(baseUrl: string, status: string): NextResponse {
  const nextUrl = new URL("/onboarding/meta", baseUrl);
  nextUrl.searchParams.set("status", status);
  return NextResponse.redirect(nextUrl);
}
