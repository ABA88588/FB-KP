import { envReadiness, parseServerEnv, safeErrorMessage, type ServerEnv } from "@adflow/shared";

export type LoadedServerEnv =
  | {
      ok: true;
      env: ServerEnv;
      readiness: ReturnType<typeof envReadiness>;
    }
  | {
      ok: false;
      message: string;
      missing: string[];
    };

export function loadServerEnv(): LoadedServerEnv {
  try {
    const env = parseServerEnv(process.env);
    return { ok: true, env, readiness: envReadiness(env) };
  } catch (error) {
    return {
      ok: false,
      message: safeErrorMessage(error),
      missing: requiredEnvKeys.filter((key) => !process.env[key])
    };
  }
}

const requiredEnvKeys = [
  "APP_BASE_URL",
  "DATABASE_URL",
  "REDIS_URL",
  "AUTH_SECRET",
  "TOKEN_ENCRYPTION_KEY",
  "META_OAUTH_REDIRECT_URI"
] as const;
