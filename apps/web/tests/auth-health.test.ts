import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encodeBase64 } from "@adflow/shared";
import { buildReadinessResponse, type HealthCheck } from "../app/api/health/_lib";
import { expiredSessionCookieOptions, sessionCookieOptions } from "../lib/auth-service";
import { AuthGuardError, requireTenantContext, type ServerAuthRepository } from "../lib/server-auth";

const dummyAesKey = encodeBase64(new Uint8Array(32).fill(9));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("server tenant auth guard", () => {
  it("builds a tenant context from a valid session and membership", async () => {
    const repository = createRepository("OPERATOR");
    const request = new Request("http://localhost/api/demo", {
      headers: { cookie: "adflow.session=valid-token" }
    });

    const context = await requireTenantContext({
      request,
      organizationId: "org_1",
      permission: "ads:write",
      repository
    });

    expect(context).toMatchObject({
      organizationId: "org_1",
      userId: "user_1",
      role: "OPERATOR"
    });
    expect(context.permissions).toContain("ads:write");
  });

  it("rejects roles that lack the requested permission", async () => {
    const request = new Request("http://localhost/api/demo", {
      headers: { authorization: "Bearer valid-token" }
    });

    await expect(
      requireTenantContext({
        request,
        organizationId: "org_1",
        permission: "ads:write",
        repository: createRepository("ANALYST")
      })
    ).rejects.toMatchObject({
      code: "PERMISSION_DENIED",
      status: 403
    } satisfies Partial<AuthGuardError>);
  });
});

describe("auth cookies", () => {
  it("uses non-secure cookies for HTTP deployment URLs", () => {
    vi.stubEnv("APP_BASE_URL", "http://89.208.252.84");
    vi.stubEnv("NODE_ENV", "production");

    expect(sessionCookieOptions(new Date("2026-06-26T00:00:00.000Z")).secure).toBe(false);
    expect(expiredSessionCookieOptions().secure).toBe(false);
  });

  it("uses secure cookies for HTTPS deployment URLs", () => {
    vi.stubEnv("APP_BASE_URL", "https://ads.example.com");
    vi.stubEnv("NODE_ENV", "production");

    expect(sessionCookieOptions(new Date("2026-06-26T00:00:00.000Z")).secure).toBe(true);
    expect(expiredSessionCookieOptions().secure).toBe(true);
  });
});

describe("health readiness", () => {
  it("reports degraded and unconfigured when dependencies are absent", async () => {
    const response = await buildReadinessResponse({
      env: {},
      now: new Date("2026-06-26T00:00:00.000Z"),
      requestId: "health_test"
    });

    expect(response.status).toBe("degraded");
    expect(response.checks.db.status).toBe("unconfigured");
    expect(response.checks.redis.status).toBe("unconfigured");
    expect(response.checks.worker.status).toBe("unconfigured");
    expect(response.checks.writeGates.status).toBe("ok");
  });

  it("can be fully healthy with injected dependency probes", async () => {
    const response = await buildReadinessResponse({
      env: {
        DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/adflow",
        REDIS_URL: "redis://127.0.0.1:6379",
        AUTH_SECRET: "test_auth_secret_with_32_chars_min",
        TOKEN_ENCRYPTION_KEY_BASE64: dummyAesKey,
        META_DEMO_MODE: "true",
        WORKER_HEARTBEAT_ISO: "2026-06-26T00:00:00.000Z"
      },
      now: new Date("2026-06-26T00:00:30.000Z"),
      probes: {
        db: () => Promise.resolve(okCheck("db")),
        redis: () => Promise.resolve(okCheck("redis"))
      }
    });

    expect(response.status).toBe("ok");
    expect(response.checks.mode.details?.mode).toBe("demo");
    expect(response.checks.worker.status).toBe("ok");
  });

  it("reads worker readiness from a heartbeat file", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "adflow-health-"));
    const heartbeatPath = path.join(tempDir, "heartbeat.json");
    try {
      await writeFile(
        heartbeatPath,
        JSON.stringify({
          appName: "@adflow/worker",
          status: "ready",
          updatedAt: "2026-06-26T00:00:20.000Z",
          queues: [{ name: "meta-sync" }]
        }),
        "utf8"
      );

      const response = await buildReadinessResponse({
        env: {
          DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:5432/adflow",
          REDIS_URL: "redis://127.0.0.1:6379",
          AUTH_SECRET: "test_auth_secret_with_32_chars_min",
          TOKEN_ENCRYPTION_KEY_BASE64: dummyAesKey,
          META_DEMO_MODE: "true",
          WORKER_HEARTBEAT_PATH: heartbeatPath
        },
        now: new Date("2026-06-26T00:00:30.000Z"),
        probes: {
          db: () => Promise.resolve(okCheck("db")),
          redis: () => Promise.resolve(okCheck("redis"))
        }
      });

      expect(response.status).toBe("ok");
      expect(response.checks.worker).toMatchObject({
        status: "ok",
        message: "Worker heartbeat file is fresh"
      });
      expect(response.checks.worker.details?.queueCount).toBe(1);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function createRepository(role: "OPERATOR" | "ANALYST"): ServerAuthRepository {
  return {
    getSessionByToken: (token) =>
      Promise.resolve(
        token === "valid-token"
          ? {
              user: { id: "user_1", email: "operator@example.test" },
              expiresAt: "2099-01-01T00:00:00.000Z"
            }
          : null
      ),
    getMembership: ({ userId, organizationId }) => Promise.resolve({
      userId,
      organizationId,
      role
    })
  };
}

function okCheck(name: string): HealthCheck {
  return { status: "ok", message: `${name} ok` };
}
