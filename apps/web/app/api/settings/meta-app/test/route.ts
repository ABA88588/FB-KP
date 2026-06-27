import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@adflow/db";
import { createRequestId, hasPermission, isOrganizationRole, redactSensitiveText, safeErrorMessage } from "@adflow/shared";
import { loadMetaAppConfigForServer, maskMetaAppId, type MetaAppConfigError } from "@/lib/meta-app-config";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";
import { loadServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const testSchema = z.object({
  organizationId: z.string().uuid().optional()
});

const appInfoSchema = z.object({
  id: z.string(),
  name: z.string().optional()
}).passthrough();

export async function POST(request: NextRequest) {
  const requestId = createRequestId("meta_app_test");
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.message, missing: loaded.missing, meta: { requestId } }, { status: 503 });
  }

  const body: unknown = await request.json().catch((): Record<string, never> => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message, meta: { requestId } }, { status: 400 });
  }

  const auth = await resolveMembership(request, parsed.data.organizationId ?? null, requestId);
  if (!auth.ok) return auth.response;

  try {
    const config = await loadMetaAppConfigForServer(auth.organizationId, loaded.env);
    const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${encodeURIComponent(config.metaAppId)}`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", `${config.metaAppId}|${config.metaAppSecret}`);

    const response = await fetch(url, {
      headers: { "x-adflow-request-id": requestId },
      signal: AbortSignal.timeout(8000)
    });
    const payload = await response.json().catch(() => ({})) as unknown;

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: describeMetaError(payload),
          data: {
            status: "failed",
            source: config.source,
            metaAppIdMasked: maskMetaAppId(config.metaAppId),
            graphApiVersion: config.graphApiVersion
          },
          meta: { requestId }
        },
        { status: 502 }
      );
    }

    const app = appInfoSchema.parse(payload);
    return NextResponse.json({
      ok: true,
      data: {
        status: "valid",
        source: config.source,
        metaAppIdMasked: maskMetaAppId(config.metaAppId),
        graphApiVersion: config.graphApiVersion,
        appName: app.name ?? null
      },
      meta: { requestId }
    });
  } catch (error) {
    const status = isMetaAppConfigError(error) ? 503 : 500;
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), meta: { requestId } }, { status });
  }
}

type MembershipResult =
  | { ok: true; organizationId: string }
  | { ok: false; response: NextResponse };

async function resolveMembership(request: Request, organizationId: string | null, requestId: string): Promise<MembershipResult> {
  const token = resolveSessionToken(request);
  if (!token) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "UNAUTHENTICATED", meta: { requestId } }, { status: 401 }) };
  }

  const session = await databaseAuthRepository.getSessionByToken(token);
  if (!session) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "UNAUTHENTICATED", meta: { requestId } }, { status: 401 }) };
  }

  const membership = organizationId
    ? await prisma.membership.findUnique({
        where: { organizationId_userId: { organizationId, userId: session.user.id } },
        select: { organizationId: true, role: true }
      })
    : await prisma.membership.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true, role: true }
      });

  if (!membership) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED", meta: { requestId } }, { status: 403 }) };
  }
  if (!isOrganizationRole(membership.role) || !hasPermission(membership.role, "connection:read")) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "PERMISSION_DENIED", meta: { requestId } }, { status: 403 }) };
  }

  return { ok: true, organizationId: membership.organizationId };
}

function describeMetaError(payload: unknown): string {
  const parsed = z.object({ error: z.object({ message: z.string().optional(), code: z.union([z.string(), z.number()]).optional() }).optional() }).safeParse(payload);
  if (parsed.success && parsed.data.error?.message) {
    return redactSensitiveText(parsed.data.error.message);
  }
  return "Meta App validation request failed.";
}

function isMetaAppConfigError(error: unknown): error is MetaAppConfigError {
  return error instanceof Error && ["META_APP_UNCONFIGURED", "TOKEN_ENCRYPTION_KEY_MISSING", "META_APP_SECRET_INVALID"].includes((error as { code?: string }).code ?? "");
}
