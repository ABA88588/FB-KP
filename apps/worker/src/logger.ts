import type { LogLevel } from "./config.js";

export interface LogFields {
  readonly [key: string]: string | number | boolean | null | undefined | LogFields | readonly LogFields[];
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export function createLogger(minimumLevel: LogLevel): Logger {
  const shouldLog = (level: LogLevel): boolean => LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minimumLevel];

  const write = (level: LogLevel, message: string, fields: LogFields | undefined): void => {
    if (!shouldLog(level)) {
      return;
    }

    const line = JSON.stringify({
      level,
      message,
      time: new Date().toISOString(),
      ...sanitizeFields(fields)
    });

    if (level === "error") {
      console.error(line);
      return;
    }

    if (level === "warn") {
      console.warn(line);
      return;
    }

    console.log(line);
  };

  return {
    debug: (message, fields) => {
      write("debug", message, fields);
    },
    info: (message, fields) => {
      write("info", message, fields);
    },
    warn: (message, fields) => {
      write("warn", message, fields);
    },
    error: (message, fields) => {
      write("error", message, fields);
    }
  };
}

export function serializeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack ?? null
    };
  }

  if (typeof error === "object" && error !== null) {
    return {
      message: "Non-Error object thrown",
      valueType: "object"
    };
  }

  return {
    message: String(error),
    valueType: typeof error
  };
}

function sanitizeFields(fields: LogFields | undefined): LogFields {
  if (fields === undefined) {
    return {};
  }

  const sanitized: Record<string, LogFields[string]> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (isSecretLikeKey(key)) {
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

function isSecretLikeKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    normalized.includes("token") ||
    normalized.includes("secret") ||
    normalized.includes("password") ||
    normalized.includes("authorization")
  );
}
