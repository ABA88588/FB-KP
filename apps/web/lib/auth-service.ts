import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@adflow/db";
import { createRequestId } from "@adflow/shared";
import { hashPassword, verifyPassword } from "./password";
import { sessionCookieName } from "./server-auth";

export const authCredentialsSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(256)
});

export const registerSchema = authCredentialsSchema.extend({
  name: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(120)
});

export type CreatedSession = {
  token: string;
  expiresAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
};

const sessionDays = 14;

export async function registerOwner(input: z.infer<typeof registerSchema>, request: Request): Promise<CreatedSession> {
  const passwordHash = await hashPassword(input.password);
  const organizationSlug = await uniqueOrganizationSlug(input.organizationName);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      authAccounts: {
        create: {
          providerId: "credentials",
          providerAccountId: input.email,
          passwordHash
        }
      },
      memberships: {
        create: {
          role: "OWNER",
          organization: {
            create: {
              name: input.organizationName,
              slug: organizationSlug
            }
          }
        }
      }
    },
    select: {
      id: true,
      email: true,
      name: true
    }
  });

  return createDatabaseSession(user, request);
}

export async function loginWithPassword(input: z.infer<typeof authCredentialsSchema>, request: Request): Promise<CreatedSession | null> {
  const account = await prisma.authAccount.findUnique({
    where: {
      providerId_providerAccountId: {
        providerId: "credentials",
        providerAccountId: input.email
      }
    },
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
  if (!account?.passwordHash) return null;

  const valid = await verifyPassword(input.password, account.passwordHash);
  if (!valid) return null;
  return createDatabaseSession(account.user, request);
}

export async function destroySession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt
  };
}

export function expiredSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0
  };
}

export function publicSessionPayload(session: CreatedSession) {
  return {
    authenticated: true,
    user: session.user,
    expiresAt: session.expiresAt.toISOString()
  };
}

async function createDatabaseSession(user: CreatedSession["user"], request: Request): Promise<CreatedSession> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      token,
      expiresAt,
      ipAddress: hashHeader(request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip")),
      userAgent: hashHeader(request.headers.get("user-agent")),
      userId: user.id
    }
  });
  return { token, expiresAt, user };
}

async function uniqueOrganizationSlug(name: string): Promise<string> {
  const base = slugify(name) || `org-${createRequestId("org").slice(-8)}`;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const existing = await prisma.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }
  return `${base}-${randomBytes(4).toString("hex")}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function hashHeader(value: string | null): string | null {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

export { sessionCookieName };
