import { createRequestId } from "@adflow/shared";
import { resolveSessionToken } from "@/lib/server-auth";

export function GET(request: Request): Response {
  const sessionToken = resolveSessionToken(request);
  return Response.json(
    {
      data: {
        authenticated: false,
        sessionTokenPresent: Boolean(sessionToken),
        authProvider: "unconfigured"
      },
      meta: { requestId: createRequestId("auth") }
    },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
}
