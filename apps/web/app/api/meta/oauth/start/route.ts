import { NextResponse } from "next/server";
import { prisma } from "@adflow/db";
import { loadServerEnv } from "@/lib/server-env";
import { createPersistentOAuthStart } from "@/lib/meta-oauth-service";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, status: "unconfigured", missing: loaded.missing }, { status: 503 });
  }
  if (!loaded.readiness.metaConfigured) {
    return NextResponse.json({ ok: false, status: "meta_unconfigured", missing: loaded.readiness.missing }, { status: 503 });
  }

  const token = resolveSessionToken(request);
  if (!token) return NextResponse.json({ ok: false, status: "unauthenticated" }, { status: 401 });
  const session = await databaseAuthRepository.getSessionByToken(token);
  if (!session) return NextResponse.json({ ok: false, status: "unauthenticated" }, { status: 401 });

  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("organizationId");
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {})
    },
    orderBy: { createdAt: "asc" }
  });
  if (!membership) return NextResponse.json({ ok: false, status: "membership_required" }, { status: 403 });

  const oauthUrl = await createPersistentOAuthStart({
    env: loaded.env,
    userId: session.user.id,
    organizationId: membership.organizationId,
    returnTo: url.searchParams.get("returnTo") ?? "/onboarding/meta"
  });
  const response = NextResponse.redirect(oauthUrl);
  return response;
}
