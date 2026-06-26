const sensitiveKeys = ["access_token", "appsecret_proof", "authorization", "cookie", "meta_app_secret", "password", "refresh_token", "token"];

export function redactSensitiveText(value: string): string {
  return sensitiveKeys.reduce((text, key) => redactKey(text, key), value);
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return redactSensitiveText(error.message);
  return "Unknown error";
}

export function createRequestId(prefix = "req"): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function redactKey(value: string, key: string): string {
  return value
    .replace(new RegExp(`(${key}=)[^&\\s]+`, "gi"), "$1[REDACTED]")
    .replace(new RegExp(`("${key}"\\s*:\\s*")[^"]+(")`, "gi"), "$1[REDACTED]$2")
    .replace(new RegExp(`(${key}\\s*:\\s*)[^\\r\\n]+`, "gi"), "$1[REDACTED]");
}
