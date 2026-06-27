import { Prisma } from "@adflow/db";

export function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return makeJsonSafe(value ?? {}) as Prisma.InputJsonValue;
}

export function toNullablePrismaJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  if (value === undefined || value === null) return Prisma.JsonNull;
  return toPrismaJson(value);
}

function makeJsonSafe(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(makeJsonSafe).filter((item) => item !== undefined);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, entry]) => [key, makeJsonSafe(entry)] as const)
        .filter(([, entry]) => entry !== undefined)
    );
  }
  return value;
}
