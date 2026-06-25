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

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
