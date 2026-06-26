import {
  getRolePermissions,
  hasPermission,
  isOrganizationRole,
  type Permission,
  type TenantContext
} from "@adflow/shared";
import { prisma } from "@adflow/db";

export const sessionCookieName = "adflow.session";

export type AuthenticatedUser = {
  id: string;
  email?: string;
  name?: string | null;
};

export type AuthSession = {
  id?: string;
  user: AuthenticatedUser;
  expiresAt?: Date | string | null;
};

export type MembershipRecord = {
  organizationId: string;
  userId: string;
  role: string;
};

export type ServerAuthRepository = {
  getSessionByToken(token: string): Promise<AuthSession | null>;
  getMembership(input: { userId: string; organizationId: string }): Promise<MembershipRecord | null>;
};

export type RequireTenantContextInput = {
  request: Request;
  organizationId: string;
  permission?: Permission;
  repository: ServerAuthRepository;
  now?: Date;
};

export class AuthGuardError extends Error {
  readonly code: "UNAUTHENTICATED" | "SESSION_EXPIRED" | "TENANT_REQUIRED" | "MEMBERSHIP_REQUIRED" | "INVALID_ROLE" | "PERMISSION_DENIED";
  readonly status: 401 | 403;

  constructor(code: AuthGuardError["code"], message: string, status: 401 | 403) {
    super(message);
    this.name = "AuthGuardError";
    this.code = code;
    this.status = status;
  }
}

export function resolveSessionToken(request: Request, cookieName = sessionCookieName): string | null {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (bearerToken) return bearerToken;

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  return parseCookieHeader(cookieHeader).get(cookieName) ?? null;
}

export async function requireTenantContext(input: RequireTenantContextInput): Promise<TenantContext> {
  if (!input.organizationId) {
    throw new AuthGuardError("TENANT_REQUIRED", "organizationId is required", 403);
  }

  const sessionToken = resolveSessionToken(input.request);
  if (!sessionToken) {
    throw new AuthGuardError("UNAUTHENTICATED", "A valid session is required", 401);
  }

  const session = await input.repository.getSessionByToken(sessionToken);
  if (!session) {
    throw new AuthGuardError("UNAUTHENTICATED", "A valid session is required", 401);
  }
  assertSessionActive(session, input.now ?? new Date());

  const membership = await input.repository.getMembership({
    userId: session.user.id,
    organizationId: input.organizationId
  });
  if (!membership || membership.userId !== session.user.id || membership.organizationId !== input.organizationId) {
    throw new AuthGuardError("MEMBERSHIP_REQUIRED", "User is not a member of this organization", 403);
  }
  if (!isOrganizationRole(membership.role)) {
    throw new AuthGuardError("INVALID_ROLE", "Membership role is invalid", 403);
  }
  if (input.permission && !hasPermission(membership.role, input.permission)) {
    throw new AuthGuardError("PERMISSION_DENIED", "Role does not allow this action", 403);
  }

  return {
    organizationId: input.organizationId,
    userId: session.user.id,
    role: membership.role,
    permissions: getRolePermissions(membership.role)
  };
}

export function assertSameTenant(context: TenantContext, resourceOrganizationId: string): void {
  if (context.organizationId !== resourceOrganizationId) {
    throw new AuthGuardError("PERMISSION_DENIED", "Resource does not belong to this organization", 403);
  }
}

export const databaseAuthRepository: ServerAuthRepository = {
  async getSessionByToken(token) {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });
    return session;
  },
  async getMembership(input) {
    return prisma.membership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: input.organizationId,
          userId: input.userId
        }
      },
      select: {
        organizationId: true,
        userId: true,
        role: true
      }
    });
  }
};

function assertSessionActive(session: AuthSession, now: Date): void {
  if (!session.expiresAt) return;
  const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt);
  if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
    throw new AuthGuardError("SESSION_EXPIRED", "Session has expired", 401);
  }
}

function parseCookieHeader(header: string): Map<string, string> {
  const cookies = new Map<string, string>();
  for (const pair of header.split(";")) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (key) cookies.set(key, decodeURIComponent(value));
  }
  return cookies;
}
