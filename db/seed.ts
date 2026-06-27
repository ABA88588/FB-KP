import { scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { prisma } from "@adflow/db";

const scrypt = promisify(scryptCallback);

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "true") {
    throw new Error("Refusing to seed demo data in production Live mode.");
  }

  const email = process.env.SEED_OWNER_EMAIL || "owner@example.com";
  const password = process.env.SEED_OWNER_PASSWORD || "password123";
  const org = await prisma.organization.upsert({
    where: { slug: "demo-adflow" },
    create: { name: "Demo AdFlow", slug: "demo-adflow" },
    update: {}
  });
  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name: "Demo Owner",
      authAccounts: {
        create: {
          providerId: "credentials",
          providerAccountId: email,
          passwordHash: await hashPassword(password)
        }
      }
    },
    update: { name: "Demo Owner" }
  });
  await prisma.authAccount.upsert({
    where: { providerId_providerAccountId: { providerId: "credentials", providerAccountId: email } },
    create: {
      providerId: "credentials",
      providerAccountId: email,
      passwordHash: await hashPassword(password),
      userId: user.id
    },
    update: {}
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    create: { organizationId: org.id, userId: user.id, role: "OWNER" },
    update: { role: "OWNER" }
  });
  const connection = await prisma.metaConnection.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: org.id,
      mode: "DEMO",
      status: "DISCONNECTED",
      scopes: []
    },
    update: {}
  });
  const account = await prisma.adAccount.upsert({
    where: { organizationId_metaId: { organizationId: org.id, metaId: "act_demo_seed" } },
    create: {
      organizationId: org.id,
      connectionId: connection.id,
      metaId: "act_demo_seed",
      accountId: "demo_seed",
      name: "Demo Seed Account",
      status: "1",
      currency: "USD",
      timezoneName: "UTC",
      dataSource: "DEMO",
      isSelected: true,
      isReadOnly: true
    },
    update: {}
  });
  await prisma.campaign.upsert({
    where: { organizationId_adAccountId_metaId: { organizationId: org.id, adAccountId: account.id, metaId: "cmp_demo_seed" } },
    create: {
      organizationId: org.id,
      adAccountId: account.id,
      metaId: "cmp_demo_seed",
      name: "Demo Seed Campaign",
      configuredStatus: "PAUSED",
      effectiveStatus: "PAUSED",
      specialAdCategories: []
    },
    update: {}
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$v1$${salt}$${derived.toString("base64url")}`;
}

await main();
await prisma.$disconnect();
