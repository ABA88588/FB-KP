export type ParsedMetaCursorPage = {
  after?: string;
  before?: string;
  hasNextPage: boolean;
  nextAfter?: string;
};

export function parseMetaCursorPage(paging: unknown): ParsedMetaCursorPage {
  const record = asRecord(paging);
  const cursors = asRecord(record?.cursors);
  const nextUrl = typeof record?.next === "string" ? record.next : undefined;
  const parsed: ParsedMetaCursorPage = {
    hasNextPage: nextUrl !== undefined && nextUrl.length > 0
  };
  const before = readNonEmptyString(cursors?.before);
  const after = readNonEmptyString(cursors?.after);
  const nextAfter = nextUrl === undefined ? undefined : parseAfterFromNextUrl(nextUrl);
  if (before !== undefined) parsed.before = before;
  if (after !== undefined) parsed.after = after;
  if (nextAfter !== undefined) parsed.nextAfter = nextAfter;
  return parsed;
}

function parseAfterFromNextUrl(nextUrl: string): string | undefined {
  const params = parseSearchParams(nextUrl);
  return readNonEmptyString(params.get("after"));
}

function parseSearchParams(nextUrl: string): URLSearchParams {
  try {
    return new URL(nextUrl).searchParams;
  } catch {
    const queryStart = nextUrl.indexOf("?");
    return new URLSearchParams(queryStart >= 0 ? nextUrl.slice(queryStart + 1) : nextUrl);
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
