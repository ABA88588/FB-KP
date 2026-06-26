import { NextResponse, type NextRequest } from "next/server";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { destroySession, expiredSessionCookieOptions, sessionCookieName } from "@/lib/auth-service";
import { resolveSessionToken } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = createRequestId("auth");
  try {
    const token = resolveSessionToken(request);
    if (token) await destroySession(token);
    const response = NextResponse.json({ ok: true, requestId });
    response.cookies.set(sessionCookieName, "", expiredSessionCookieOptions());
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), requestId }, { status: 500 });
  }
}
