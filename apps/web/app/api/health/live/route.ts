import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    ok: true,
    status: "live",
    service: "web",
    timestamp: new Date().toISOString()
  });
}
