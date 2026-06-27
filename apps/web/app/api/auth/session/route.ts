import { prisma } from "@adflow/db";
import { createRequestId, safeErrorMessage } from "@adflow/shared";
import { expiredSessionCookieOptions, sessionCookieName } from "@/lib/auth-service";
import { databaseAuthRepository, resolveSessionToken } from "@/lib/server-auth";

export async function GET(request: Request): Promise<Response> {
  const requestId = createRequestId("auth");
  const sessionToken = resolveSessionToken(request);
  if (!sessionToken) return unauthenticated(requestId);

  try {
    const session = await databaseAuthRepository.getSessionByToken(sessionToken);
    if (!session) return unauthenticated(requestId, true);

    const expiresAt = session.expiresAt instanceof Date ? session.expiresAt : new Date(session.expiresAt ?? 0);
    if (!session.expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      await prisma.session.deleteMany({ where: { token: sessionToken } });
      return unauthenticated(requestId, true);
    }

    const memberships = await prisma.membership.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    return Response.json(
      {
        data: {
          authenticated: true,
          user: session.user,
          expiresAt: expiresAt.toISOString(),
          organizations: memberships.map((membership) => ({
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
            role: membership.role
          }))
        },
        meta: { requestId }
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return Response.json({ data: { authenticated: false }, error: safeErrorMessage(error), meta: { requestId } }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

function unauthenticated(requestId: string, clearCookie = false): Response {
  const response = Response.json(
    {
      data: {
        authenticated: false,
        authProvider: "database"
      },
      meta: { requestId }
    },
    {
      headers: { "Cache-Control": "no-store" }
    }
  );
  if (clearCookie) {
    const options = expiredSessionCookieOptions();
    response.headers.append("Set-Cookie", `${sessionCookieName}=; Max-Age=${options.maxAge}; Path=${options.path}; HttpOnly; SameSite=Lax`);
  }
  return response;
}
