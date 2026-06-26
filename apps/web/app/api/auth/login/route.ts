import { NextResponse, type NextRequest } from "next/server";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { authCredentialsSchema, loginWithPassword, publicSessionPayload, sessionCookieName, sessionCookieOptions } from "@/lib/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = createRequestId("auth");
  try {
    const parsed = authCredentialsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", requestId }, { status: 400 });
    }

    const session = await loginWithPassword(parsed.data, request);
    if (!session) {
      return NextResponse.json({ ok: false, error: "INVALID_CREDENTIALS", requestId }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true, data: publicSessionPayload(session), requestId });
    response.cookies.set(sessionCookieName, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), requestId }, { status: 500 });
  }
}
