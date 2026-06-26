import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.ts";

export { Prisma, type PrismaClient } from "./generated/prisma/client.ts";

type PrismaGlobal = typeof globalThis & {
  __adflowPrisma?: PrismaClient;
};

export function createPrismaClient(databaseUrl = process.env.DATABASE_URL): PrismaClient {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to create PrismaClient.");
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  const globalForPrisma = globalThis as PrismaGlobal;
  if (process.env.NODE_ENV === "production") {
    return createPrismaClient();
  }
  globalForPrisma.__adflowPrisma ??= createPrismaClient();
  return globalForPrisma.__adflowPrisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property): unknown {
    const client = getPrismaClient();
    const value = (client as unknown as Record<PropertyKey, unknown>)[property];
    if (typeof value === "function") {
      return value.bind(client) as unknown;
    }
    return value;
  }
});
