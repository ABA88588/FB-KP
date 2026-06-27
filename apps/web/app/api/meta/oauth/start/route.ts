import { NextResponse } from "next/server";
import { prisma } from "@adflow/db";
import { safeErrorMessage } from "@adflow/shared";
import type { MetaAppConfigError } from "@/lib/meta-app-config";
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
  if (!loaded.readiness.tokenEncryptionConfigured) {
    return NextResponse.json({ ok: false, status: "meta_unconfigured", missing: loaded.readiness.missing }, { status: 503 });
  }

  const token = resolveSessionToken(request);
  if (!token) return NextResponse.json({ ok: false, status: "unauthenticated" }, { status: 401 });
  const session = await databaseAuthRepository.getSessionByToken(token);
  if (!session) return NextResponse.json({ ok: false, status: "unauthenticated" }, { status: 401 });
  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt ?? 0);
  if (session.expiresAt && (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date())) {
    return NextResponse.json({ ok: false, status: "unauthenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedOrganizationId = url.searchParams.get("organizationId");
  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      role: { in: ["OWNER", "ADMIN"] },
      ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {})
    },
    orderBy: { createdAt: "asc" }
  });
  if (!membership) return NextResponse.json({ ok: false, status: "permission_denied" }, { status: 403 });

  try {
    const oauthUrl = await createPersistentOAuthStart({
      env: loaded.env,
      userId: session.user.id,
      organizationId: membership.organizationId,
      returnTo: url.searchParams.get("returnTo") ?? "/settings/connections"
    });
    return NextResponse.redirect(oauthUrl);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "meta_unconfigured",
        error: safeErrorMessage(error),
        missing: isMetaAppConfigError(error) ? error.missing : []
      },
      { status: isMetaAppConfigError(error) ? 503 : 500 }
    );
  }
}

function isMetaAppConfigError(error: unknown): error is MetaAppConfigError {
  return error instanceof Error && ["META_APP_UNCONFIGURED", "TOKEN_ENCRYPTION_KEY_MISSING", "META_APP_SECRET_INVALID"].includes((error as { code?: string }).code ?? "");
}
