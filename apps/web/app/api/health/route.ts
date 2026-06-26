import { buildReadinessResponse } from "./_lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const body = await buildReadinessResponse();
  return Response.json(body, {
    status: body.status === "unavailable" ? 503 : 200,
    headers: { "Cache-Control": "no-store" }
  });
}
