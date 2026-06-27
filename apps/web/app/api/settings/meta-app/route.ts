import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@adflow/db";
import { createRequestId, hasPermission, isOrganizationRole, safeErrorMessage, type Permission } from "@adflow/shared";
import {
  encryptMetaAppSecret,
  getMetaAppConfigStatus,
  maskMetaAppId,
  metaAppConfigAuditSnapshot,
  sanitizeAllowedAdAccountIds,
  type MetaAppConfigError
} from "@/lib/meta-app-config";
import { toNullablePrismaJson, toPrismaJson } from "@/lib/prisma-json";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";
import { loadServerEnv } from "@/lib/server-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const graphApiVersionSchema = z.string().trim().regex(/^v\d+\.\d+$/, "Expected a Meta Graph API version like v25.0");

const updateSchema = z.object({
  organizationId: z.string().uuid().optional(),
  metaAppId: z.string().trim().min(1),
  metaAppSecret: z.string().optional(),
  graphApiVersion: graphApiVersionSchema,
  oauthRedirectUri: z.string().trim().url(),
  enableMetaWrites: z.boolean(),
  emergencyReadOnly: z.boolean(),
  allowedAdAccountIds: z.union([z.array(z.string()), z.string()]).optional()
});

type SettingsMembership = {
  organizationId: string;
  userId: string;
  role: string;
};

type AuthResult =
  | { ok: true; membership: SettingsMembership }
  | { ok: false; response: NextResponse };

export async function GET(request: NextRequest) {
  const requestId = createRequestId("meta_app");
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.message, missing: loaded.missing, meta: { requestId } }, { status: 503 });
  }

  const url = new URL(request.url);
  const auth = await resolveSettingsMembership(request, url.searchParams.get("organizationId"), "connection:read", requestId);
  if (!auth.ok) return auth.response;

  try {
    const data = await getMetaAppConfigStatus(auth.membership.organizationId, loaded.env);
    return NextResponse.json({ ok: true, data, meta: { requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), meta: { requestId } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const requestId = createRequestId("meta_app");
  const loaded = loadServerEnv();
  if (!loaded.ok) {
    return NextResponse.json({ ok: false, error: loaded.message, missing: loaded.missing, meta: { requestId } }, { status: 503 });
  }

  const body: unknown = await request.json().catch((): Record<string, never> => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.message, meta: { requestId } }, { status: 400 });
  }

  const auth = await resolveSettingsMembership(request, parsed.data.organizationId ?? null, "connection:write", requestId);
  if (!auth.ok) return auth.response;

  const metaAppSecret = parsed.data.metaAppSecret?.trim();
  const allowedAdAccountIds = sanitizeAllowedAdAccountIds(parsed.data.allowedAdAccountIds);

  try {
    const savedId = await prisma.$transaction(async (tx) => {
      const before = await tx.metaAppConfig.findUnique({ where: { organizationId: auth.membership.organizationId } });
      if (!before && !metaAppSecret) {
        throw new Error("Meta App Secret is required when creating Meta App configuration.");
      }

      const encryptedMetaAppSecret = metaAppSecret ? await encryptMetaAppSecret(metaAppSecret, loaded.env) : undefined;
      const saved = before
        ? await tx.metaAppConfig.update({
            where: { id: before.id },
            data: {
              metaAppId: parsed.data.metaAppId,
              ...(encryptedMetaAppSecret ? { encryptedMetaAppSecret } : {}),
              graphApiVersion: parsed.data.graphApiVersion,
              oauthRedirectUri: parsed.data.oauthRedirectUri,
              enableMetaWrites: parsed.data.enableMetaWrites,
              emergencyReadOnly: parsed.data.emergencyReadOnly,
              allowedAdAccountIds,
              updatedByUserId: auth.membership.userId
            }
          })
        : await tx.metaAppConfig.create({
            data: {
              organizationId: auth.membership.organizationId,
              metaAppId: parsed.data.metaAppId,
              encryptedMetaAppSecret: encryptedMetaAppSecret ?? toPrismaJson({}),
              graphApiVersion: parsed.data.graphApiVersion,
              oauthRedirectUri: parsed.data.oauthRedirectUri,
              enableMetaWrites: parsed.data.enableMetaWrites,
              emergencyReadOnly: parsed.data.emergencyReadOnly,
              allowedAdAccountIds,
              updatedByUserId: auth.membership.userId
            }
          });

      await tx.auditLog.create({
        data: {
          organizationId: auth.membership.organizationId,
          actorUserId: auth.membership.userId,
          action: before ? "settings.meta_app.updated" : "settings.meta_app.created",
          resourceType: "MetaAppConfig",
          resourceId: saved.id,
          metaIdMasked: maskMetaAppId(saved.metaAppId),
          outcome: "SUCCESS",
          requestId,
          beforeJson: before ? toPrismaJson(metaAppConfigAuditSnapshot(before)) : toNullablePrismaJson(null),
          afterJson: toPrismaJson(metaAppConfigAuditSnapshot(saved)),
          summaryJson: toPrismaJson({ secretChanged: Boolean(metaAppSecret), source: "database" })
        }
      });

      return saved.id;
    });

    const data = await getMetaAppConfigStatus(auth.membership.organizationId, loaded.env);
    return NextResponse.json({ ok: true, data: { ...data, id: savedId }, meta: { requestId } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = isMetaAppConfigError(error) ? 400 : 500;
    return NextResponse.json({ ok: false, error: safeErrorMessage(error), meta: { requestId } }, { status });
  }
}

async function resolveSettingsMembership(request: Request, organizationId: string | null, permission: Permission, requestId: string): Promise<AuthResult> {
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
        select: { organizationId: true, userId: true, role: true }
      })
    : await prisma.membership.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true, userId: true, role: true }
      });

  if (!membership) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "MEMBERSHIP_REQUIRED", meta: { requestId } }, { status: 403 }) };
  }
  if (!isOrganizationRole(membership.role) || !hasPermission(membership.role, permission)) {
    return { ok: false, response: NextResponse.json({ ok: false, error: "PERMISSION_DENIED", meta: { requestId } }, { status: 403 }) };
  }

  return { ok: true, membership };
}

function isMetaAppConfigError(error: unknown): error is MetaAppConfigError {
  return error instanceof Error && ["META_APP_UNCONFIGURED", "TOKEN_ENCRYPTION_KEY_MISSING", "META_APP_SECRET_INVALID"].includes((error as { code?: string }).code ?? "");
}
