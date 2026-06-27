import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/adflow?schema=public";

export default defineConfig({
  schema: "db/schema.prisma",
  migrations: {
    path: "db/migrations"
  },
  datasource: {
    url: databaseUrl
  }
});
