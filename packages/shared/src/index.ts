export type DataState =
  | "idle"
  | "loading"
  | "refreshing"
  | "success"
  | "empty"
  | "filtered-empty"
  | "stale"
  | "partial"
  | "permission-denied"
  | "connection-expired"
  | "recoverable-error"
  | "fatal-error";

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return value.toLocaleString("en-US");
  return String(value);
}

export function safeCsvCell(value: string | number): string {
  const raw = String(value);
  const escaped = raw.replaceAll("\"", "\"\"");
  const safe = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
  return `"${safe}"`;
}

export function rowsToCsv(rows: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return rows.map((row) => row.map(safeCsvCell).join(",")).join("\n");
}

export type StatusBadgeTone = "active" | "warning" | "error" | "paused";

export function effectiveStatusTone(status: string): StatusBadgeTone {
  if (status === "投放中" || status === "ACTIVE") return "active";
  if (status.includes("学习") || status.includes("受限")) return "warning";
  if (status.includes("失败")) return "error";
  return "paused";
}

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export * from "./authz";
export * from "./crypto";
export * from "./env";
export * from "./security";
