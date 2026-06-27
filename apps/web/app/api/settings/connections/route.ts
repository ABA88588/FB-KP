import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@adflow/db";
import { createRequestId, hasPermission, isOrganizationRole, safeErrorMessage, type Permission } from "@adflow/shared";
import { getMetaAppConfigStatus } from "@/lib/meta-app-config";
import { loadServerEnv } from "@/lib/server-env";
import { toNullablePrismaJson, toPrismaJson } from "@/lib/prisma-json";
import { databaseAuthRepository, resolveSessionToken, type AuthSession } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MissingConnectionItem = {
  id: string;
  label: string;
  detail: string;
};

type AuthContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
};

export async function GET(request: NextRequest) {
  const requestId = createRequestId("connections");
  try {
    const loaded = loadServerEnv();
    const context = await resolveAuthContext(request, "connection:read", request.nextUrl.searchParams.get("organizationId"));
    const connection = await prisma.metaConnection.findFirst({
      where: { organizationId: context.organizationId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        mode: true,
        status: true,
        metaUserId: true,
        metaBusinessIds: true,
        scopes: true,
        tokenExpiresAt: true,
        lastValidatedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
        adAccounts: {
          orderBy: [{ isSelected: "desc" }, { updatedAt: "desc" }],
          select: {
            id: true,
            metaId: true,
            accountId: true,
            name: true,
            status: true,
            disableReason: true,
            currency: true,
            timezoneName: true,
            businessMetaId: true,
            isSelected: true,
            isReadOnly: true,
            sourceLastSeenAt: true,
            updatedAt: true
          }
        }
      }
    });
    const activeUsers = await prisma.metaConnection.findMany({
      where: {
        organizationId: context.organizationId,
        status: { not: "DISCONNECTED" },
        metaUserId: { not: null }
      },
      distinct: ["metaUserId"],
      select: { metaUserId: true }
    });
    const businessIds = stringArrayFromJson(connection?.metaBusinessIds);
    const metaStatus = loaded.ok ? await getMetaAppConfigStatus(context.organizationId, loaded.env) : null;
    const envMissing = loaded.ok ? [] : loaded.missing;
    const tokenMissing = loaded.ok && loaded.readiness.tokenEncryptionConfigured ? [] : ["TOKEN_ENCRYPTION_KEY"];
    const metaMissing = Array.from(new Set([...(metaStatus?.missing ?? envMissing), ...tokenMissing]));
    const metaConfigured = Boolean(loaded.ok && metaStatus?.configured && loaded.readiness.tokenEncryptionConfigured);
    const tokenExpired = Boolean(connection?.tokenExpiresAt && connection.tokenExpiresAt <= new Date());
    const missingItems = buildMissingItems({
      metaConfigured,
      metaMissing,
      hasConnection: Boolean(connection),
      adAccountCount: connection?.adAccounts.length ?? 0,
      tokenExpired
    });
    const canManage = isOrganizationRole(context.role) && hasPermission(context.role, "connection:write");

    return NextResponse.json(
      {
        ok: true,
        data: {
          organization: {
            id: context.organizationId,
            name: context.organizationName,
            role: context.role
          },
          permissions: {
            canManageConnections: canManage
          },
          metaConfig: {
            configured: metaConfigured,
            source: metaStatus?.source ?? "unconfigured",
            missing: metaMissing
          },
          state: connectionState({
            metaConfigured,
            hasConnection: Boolean(connection),
            status: connection?.status,
            adAccountCount: connection?.adAccounts.length ?? 0,
            tokenExpired
          }),
          counts: {
            users: activeUsers.length,
            businesses: businessIds.length,
            adAccounts: connection?.adAccounts.length ?? 0
          },
          connection: connection
            ? {
              id: connection.id,
              mode: connection.mode,
              status: connection.status,
              metaUserIdMasked: connection.metaUserId ? maskMetaId(connection.metaUserId) : null,
              businessIdsMasked: businessIds.map(maskMetaId),
              scopes: connection.scopes,
              tokenExpiresAt: connection.tokenExpiresAt?.toISOString() ?? null,
              lastValidatedAt: connection.lastValidatedAt?.toISOString() ?? null,
              revokedAt: connection.revokedAt?.toISOString() ?? null,
              createdAt: connection.createdAt.toISOString(),
              updatedAt: connection.updatedAt.toISOString(),
              accounts: connection.adAccounts.map((account) => ({
                id: account.id,
                metaIdMasked: maskMetaId(account.metaId),
                accountIdMasked: maskMetaId(account.accountId),
                name: account.name,
                status: account.status,
                disableReason: account.disableReason,
                currency: account.currency,
                timezoneName: account.timezoneName,
                businessMetaIdMasked: account.businessMetaId ? maskMetaId(account.businessMetaId) : null,
                isSelected: account.isSelected,
                isReadOnly: account.isReadOnly,
                sourceLastSeenAt: account.sourceLastSeenAt?.toISOString() ?? null,
                updatedAt: account.updatedAt.toISOString()
              }))
            }
            : null,
          missingItems,
          actions: {
            connectUrl: buildLocalPath(
              request.nextUrl.pathname,
              "/api/settings/connections",
              `/api/meta/oauth/start?organizationId=${encodeURIComponent(context.organizationId)}&returnTo=${encodeURIComponent("/settings/connections")}`
            ),
            disconnectAvailable: canManage && Boolean(connection && connection.status !== "DISCONNECTED")
          }
        },
        requestId
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    const status = error instanceof ConnectionsAuthError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof ConnectionsAuthError ? error.code : safeErrorMessage(error), requestId }, { status });
  }
}

export async function POST(request: NextRequest) {
  const requestId = createRequestId("connections");
  try {
    const body = (await request.json().catch(() => ({}))) as { action?: string; organizationId?: string; connectionId?: string };
    if (body.action !== "disconnect") {
      return NextResponse.json({ ok: false, error: "UNSUPPORTED_ACTION", requestId }, { status: 400 });
    }
    const context = await resolveAuthContext(request, "connection:write", body.organizationId ?? request.nextUrl.searchParams.get("organizationId"));
    const connection = body.connectionId
      ? await prisma.metaConnection.findFirst({ where: { id: body.connectionId, organizationId: context.organizationId } })
      : await prisma.metaConnection.findFirst({ where: { organizationId: context.organizationId }, orderBy: { updatedAt: "desc" } });
    if (!connection) {
      return NextResponse.json({ ok: false, error: "CONNECTION_NOT_FOUND", requestId }, { status: 404 });
    }

    const now = new Date();
    await prisma.metaConnection.update({
      where: { id: connection.id },
      data: {
        status: "DISCONNECTED",
        revokedAt: now,
        tokenCiphertext: null,
        tokenIv: null,
        tokenAuthTag: null,
        tokenKeyVersion: null,
        tokenExpiresAt: null,
        lastValidatedAt: now
      }
    });
    await prisma.encryptedToken.updateMany({
      where: {
        organizationId: context.organizationId,
        connectionId: connection.id,
        revokedAt: null
      },
      data: { revokedAt: now }
    });
    await prisma.adAccount.updateMany({
      where: {
        organizationId: context.organizationId,
        connectionId: connection.id
      },
      data: { isReadOnly: true }
    });
    await prisma.auditLog.create({
      data: {
        organizationId: context.organizationId,
        actorUserId: context.userId,
        action: "meta.oauth.disconnected",
        resourceType: "MetaConnection",
        resourceId: connection.id,
        outcome: "SUCCESS",
        requestId,
        beforeJson: toNullablePrismaJson({ status: connection.status }),
        afterJson: toPrismaJson({ status: "DISCONNECTED" }),
        summaryJson: toPrismaJson({ disconnectedAt: now.toISOString() })
      }
    });

    return NextResponse.json({ ok: true, data: { connectionId: connection.id, status: "DISCONNECTED" }, requestId });
  } catch (error) {
    const status = error instanceof ConnectionsAuthError ? error.status : 500;
    return NextResponse.json({ ok: false, error: error instanceof ConnectionsAuthError ? error.code : safeErrorMessage(error), requestId }, { status });
  }
}

async function resolveAuthContext(request: Request, permission: Permission, requestedOrganizationId: string | null | undefined): Promise<AuthContext> {
  const token = resolveSessionToken(request);
  if (!token) throw new ConnectionsAuthError("UNAUTHENTICATED", 401);
  const session = await databaseAuthRepository.getSessionByToken(token);
  if (!session || isSessionExpired(session)) throw new ConnectionsAuthError("UNAUTHENTICATED", 401);

  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
      ...(requestedOrganizationId ? { organizationId: requestedOrganizationId } : {})
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "asc" }
  });
  if (memberships.length === 0) throw new ConnectionsAuthError("MEMBERSHIP_REQUIRED", 403);
  const membership = memberships.find((item) => isOrganizationRole(item.role) && hasPermission(item.role, permission));
  if (!membership) throw new ConnectionsAuthError("PERMISSION_DENIED", 403);

  return {
    userId: session.user.id,
    organizationId: membership.organizationId,
    organizationName: membership.organization.name,
    role: membership.role
  };
}

function isSessionExpired(session: AuthSession): boolean {
  if (!session.expiresAt) return false;
  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date();
}

function buildMissingItems(input: {
  metaConfigured: boolean;
  metaMissing: readonly string[];
  hasConnection: boolean;
  adAccountCount: number;
  tokenExpired: boolean;
}): MissingConnectionItem[] {
  const items: MissingConnectionItem[] = [];
  if (!input.metaConfigured) {
    items.push({
      id: "meta-app-config",
      label: "Meta 连接配置缺失",
      detail: input.metaMissing.length > 0 ? `补齐 ${input.metaMissing.join(", ")} 后重新连接。` : "补齐 Meta App ID、Secret 和 OAuth 回调地址后重新连接。"
    });
  }
  if (input.metaConfigured && !input.hasConnection) {
    items.push({
      id: "meta-oauth-required",
      label: "尚未授权 Meta",
      detail: "使用 Owner/Admin 账号发起授权，完成后会写入连接、Token 和广告账户。"
    });
  }
  if (input.hasConnection && input.adAccountCount === 0) {
    items.push({
      id: "meta-ad-account-access",
      label: "未发现广告账户",
      detail: "确认授权用户在 Meta Business 中拥有广告账户访问权，然后重新授权。"
    });
  }
  if (input.tokenExpired) {
    items.push({
      id: "meta-token-expired",
      label: "授权已过期",
      detail: "重新授权以刷新长效访问 Token。"
    });
  }
  return items;
}

function connectionState(input: {
  metaConfigured: boolean;
  hasConnection: boolean;
  status: string | undefined;
  adAccountCount: number;
  tokenExpired: boolean;
}): string {
  if (!input.metaConfigured) return "missing_config";
  if (!input.hasConnection) return "not_connected";
  if (input.status === "DISCONNECTED" || input.status === "REVOKED") return "disconnected";
  if (input.tokenExpired || input.status === "EXPIRED") return "expired";
  if (input.status === "ERROR") return "error";
  if (input.adAccountCount === 0) return "missing_accounts";
  return "connected";
}

function stringArrayFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function maskMetaId(value: string): string {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildLocalPath(currentPathname: string, routePath: string, targetPath: string): string {
  const basePath = currentPathname.endsWith(routePath) ? currentPathname.slice(0, -routePath.length) : "";
  return `${basePath}${targetPath}`;
}

class ConnectionsAuthError extends Error {
  constructor(readonly code: string, readonly status: 401 | 403) {
    super(code);
  }
}
