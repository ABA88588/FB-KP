import { NextResponse } from "next/server";
import { loadServerEnv } from "@/lib/server-env";
import { buildMetaOAuthUrl, createOAuthState, metaOAuthCookieName } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, status: "unconfigured", missing: loaded.missing }, { status: 503 });
  }
  if (!loaded.readiness.metaConfigured) {
    return NextResponse.json({ ok: false, status: "meta_unconfigured", missing: loaded.readiness.missing }, { status: 503 });
  }

  const { state, cookieValue } = createOAuthState(loaded.env.AUTH_SECRET);
  const response = NextResponse.redirect(buildMetaOAuthUrl(loaded.env, state));
  response.cookies.set(metaOAuthCookieName, cookieValue, {
    httpOnly: true,
    secure: loaded.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/meta/oauth",
    maxAge: 600
  });
  return response;
}
