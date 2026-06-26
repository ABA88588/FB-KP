import { NextResponse, type NextRequest } from "next/server";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { publicSessionPayload, registerOwner, registerSchema, sessionCookieName, sessionCookieOptions } from "@/lib/auth-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const requestId = createRequestId("auth");
  try {
    const parsed = registerSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "INVALID_REGISTRATION", requestId }, { status: 400 });
    }

    const session = await registerOwner(parsed.data, request);
    const response = NextResponse.json({ ok: true, data: publicSessionPayload(session), requestId }, { status: 201 });
    response.cookies.set(sessionCookieName, session.token, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    const message = safeErrorMessage(error);
    const status = message.includes("Unique constraint") ? 409 : 500;
    return NextResponse.json({ ok: false, error: status === 409 ? "EMAIL_ALREADY_REGISTERED" : message, requestId }, { status });
  }
}
