import { NextResponse, type NextRequest } from "next/server";
import { createRequestId } from "@adflow/shared";
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
    return redirectToConnections(request, { status: "denied" });
  }

  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!code) {
    return redirectToConnections(request, { status: "failed", requestId });
  }
  if (!state) {
    return redirectToConnections(request, { status: "failed", requestId });
  }

  try {
    await consumeMetaOAuthCallback({ env: loaded.env, code, state, requestId });
    return redirectToConnections(request, { status: "connected" });
  } catch {
    return redirectToConnections(request, { status: "failed", requestId });
  }
}

function redirectToConnections(request: NextRequest, params: Record<string, string>): NextResponse {
  const nextUrl = new URL(request.url);
  nextUrl.pathname = `${extractBasePath(nextUrl.pathname, "/api/meta/oauth/callback")}/settings/connections`;
  nextUrl.search = "";
  for (const [key, value] of Object.entries(params)) {
    nextUrl.searchParams.set(key, value);
  }
  return NextResponse.redirect(nextUrl);
}

function extractBasePath(pathname: string, routePath: string): string {
  return pathname.endsWith(routePath) ? pathname.slice(0, -routePath.length) : "";
}
